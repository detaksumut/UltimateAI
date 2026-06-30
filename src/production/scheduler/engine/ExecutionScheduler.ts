import { ExecutionUnit, ExecutionState } from "../contracts/ExecutionUnit";
import { DispatchStrategy } from "../strategy/DispatchStrategy";
import { ResourceManager, ResourceSlot } from "../resource/ResourceManager";
import { SchedulerSnapshot } from "../contracts/SchedulerSnapshot";
import { CancellationToken } from "../contracts/CancellationToken";
import { IRuntimeCoordinator } from "../../runtime/coordinator/RuntimeCoordinator";
import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";
import { SchedulerEvent } from "../contracts/SchedulerEvent";
import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";

export class ExecutionScheduler {
  private readyQueue: ExecutionUnit[] = [];
  private waitingQueue: ExecutionUnit[] = []; // Waiting for slots
  private runningUnits: Map<string, ExecutionUnit> = new Map();
  private completedUnits: Map<string, ExecutionUnit> = new Map();
  private failedUnits: Map<string, ExecutionUnit> = new Map();
  private cancelledUnits: Map<string, ExecutionUnit> = new Map();

  private activeSlots: Map<string, ResourceSlot> = new Map();
  private activeTokens: Map<string, CancellationToken> = new Map();

  // Async lock for the event-driven dispatcher
  private isDispatching = false;

  constructor(
    private readonly strategy: DispatchStrategy,
    private readonly resourceManager: ResourceManager,
    private readonly coordinator: IRuntimeCoordinator, // This is usually the ReliabilityInterceptor
    private readonly eventBus: IRuntimeEventBus
  ) {}

  /**
   * Submit a new execution unit to the scheduler.
   */
  public submit(unit: ExecutionUnit): void {
    unit.state = ExecutionState.READY;
    this.readyQueue.push(unit);
    this.strategy.sort(this.readyQueue);
    
    this.emitEvent("TaskQueued", unit);
    
    // Trigger dispatch asynchronously (Event-Driven transition)
    setImmediate(() => this.tryDispatch());
  }

  /**
   * Request cancellation of a running or queued unit.
   */
  public cancel(unitId: string, reason: string): void {
    // 1. Check if running
    if (this.runningUnits.has(unitId)) {
      const unit = this.runningUnits.get(unitId)!;
      // Emit cancellation requested event (before actual cancellation)
      
      // Cancel the token
      const token = this.activeTokens.get(unitId);
      if (token) {
        token.cancel(reason);
      }
      
      // Transition state
      this.transitionToCancelled(unit);
      return;
    }

    // 2. Check if ready/waiting
    const readyIdx = this.readyQueue.findIndex(u => u.id === unitId);
    if (readyIdx >= 0) {
      const unit = this.readyQueue.splice(readyIdx, 1)[0];
      this.transitionToCancelled(unit);
      return;
    }

    const waitIdx = this.waitingQueue.findIndex(u => u.id === unitId);
    if (waitIdx >= 0) {
      const unit = this.waitingQueue.splice(waitIdx, 1)[0];
      this.transitionToCancelled(unit);
      return;
    }
  }

  /**
   * The core event-driven dispatch loop. 
   * Activated whenever a task is submitted or completed.
   */
  private async tryDispatch(): Promise<void> {
    if (this.isDispatching) return;
    this.isDispatching = true;

    try {
      // Re-evaluate waiting queue first (they have priority over new READY tasks)
      // Moving them back to readyQueue so strategy can sort them
      if (this.waitingQueue.length > 0) {
        this.readyQueue.push(...this.waitingQueue);
        this.waitingQueue = [];
        this.strategy.sort(this.readyQueue);
      }

      let nextUnit = this.strategy.getNext(this.readyQueue);
      
      while (nextUnit) {
        if (this.resourceManager.hasAvailableSlot(nextUnit.capability)) {
          // Slot is available! 
          const slot = this.resourceManager.allocate(nextUnit.capability);
          this.activeSlots.set(nextUnit.id, slot);
          this.emitEvent("ResourceAllocated", nextUnit, slot);
          
          this.transitionToRunning(nextUnit);
        } else {
          // Resource unavailable, move to WAITING
          nextUnit.state = ExecutionState.WAITING;
          this.waitingQueue.push(nextUnit);
          this.emitEvent("TaskWaiting", nextUnit);
        }
        
        // Grab the next highest priority task
        nextUnit = this.strategy.getNext(this.readyQueue);
      }
    } finally {
      this.isDispatching = false;
    }
  }

  private async transitionToRunning(unit: ExecutionUnit) {
    unit.state = ExecutionState.RUNNING;
    unit.startedAt = Date.now();
    this.runningUnits.set(unit.id, unit);
    
    const token = new CancellationToken();
    this.activeTokens.set(unit.id, token);

    this.emitEvent("TaskStarted", unit);

    try {
      // Execute the task via Coordinator (ReliabilityInterceptor)
      // We pass the token for the interceptor to respect.
      // We pass the runtime context.
      const result = await this.coordinator.executeCapability(
        unit.capability, 
        unit.context.runtimeContext
        // NOTE: In a real system, the token would be passed into the context 
        // to allow runtimes to abort internal operations.
      );

      // Check if cancelled during execution
      if (token.isCancellationRequested) {
        throw new Error("Cancelled");
      }

      this.transitionToCompleted(unit, result);
    } catch (error: any) {
      if (token.isCancellationRequested) {
        // Handled in cancel() directly, but just in case
      } else {
        this.transitionToFailed(unit, error);
      }
    }
  }

  private transitionToCompleted(unit: ExecutionUnit, result: any) {
    this.releaseResources(unit);
    
    unit.state = ExecutionState.COMPLETED;
    unit.completedAt = Date.now();
    
    this.runningUnits.delete(unit.id);
    this.completedUnits.set(unit.id, unit);
    
    this.emitEvent("TaskFinished", unit);
    if (unit.resolve) unit.resolve(result);

    // Trigger next dispatch
    setImmediate(() => this.tryDispatch());
  }

  private transitionToFailed(unit: ExecutionUnit, error: any) {
    this.releaseResources(unit);
    
    unit.state = ExecutionState.FAILED;
    unit.completedAt = Date.now();
    
    this.runningUnits.delete(unit.id);
    this.failedUnits.set(unit.id, unit);
    
    // In a real system, emit failure
    this.emitEvent("TaskFinished", unit, { error: error.message });
    if (unit.reject) unit.reject(error);

    // Trigger next dispatch
    setImmediate(() => this.tryDispatch());
  }

  private transitionToCancelled(unit: ExecutionUnit) {
    this.releaseResources(unit);
    
    unit.state = ExecutionState.CANCELLED;
    unit.completedAt = Date.now();
    
    this.runningUnits.delete(unit.id);
    this.cancelledUnits.set(unit.id, unit);
    
    this.emitEvent("TaskCancelled", unit);
    if (unit.reject) unit.reject(new Error("Task Cancelled"));

    // Trigger next dispatch
    setImmediate(() => this.tryDispatch());
  }

  private releaseResources(unit: ExecutionUnit) {
    const slot = this.activeSlots.get(unit.id);
    if (slot) {
      this.resourceManager.release(slot);
      this.activeSlots.delete(unit.id);
      this.emitEvent("ResourceReleased", unit, slot);
    }
    this.activeTokens.delete(unit.id);
  }

  private emitEvent(type: SchedulerEvent["eventType"], unit: ExecutionUnit, extraPayload?: any) {
    const evt: SchedulerEvent = {
      eventId: `sevt-${Math.random().toString(36).substring(2)}`,
      traceId: unit.context.traceId,
      eventType: type,
      unitId: unit.id,
      newState: unit.state,
      timestamp: Date.now(),
      payload: extraPayload || unit
    };
    this.eventBus.publish(evt as any);
  }

  public getSnapshot(): SchedulerSnapshot {
    return {
      timestamp: Date.now(),
      totalUnits: this.readyQueue.length + this.waitingQueue.length + this.runningUnits.size + this.completedUnits.size + this.failedUnits.size + this.cancelledUnits.size,
      states: {
        [ExecutionState.READY]: this.readyQueue.length,
        [ExecutionState.WAITING]: this.waitingQueue.length,
        [ExecutionState.RUNNING]: this.runningUnits.size,
        [ExecutionState.COMPLETED]: this.completedUnits.size,
        [ExecutionState.FAILED]: this.failedUnits.size,
        [ExecutionState.CANCELLED]: this.cancelledUnits.size
      },
      activeRuntimes: {
        // Just mocking the return for snapshot
        "PLANNING": this.resourceManager.getActiveCount(RuntimeCapability.PLANNING)
      }
    };
  }
}
