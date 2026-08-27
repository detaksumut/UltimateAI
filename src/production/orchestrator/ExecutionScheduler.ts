import { ExecutionStateStore } from "./ExecutionStateStore";
import { IScheduler } from "./IScheduler";

export type RequestPriority = "high" | "normal" | "low";

export interface ScheduledRequest {
  readonly requestId: string;
  readonly priority: RequestPriority;
  readonly queuedAt: string;
  readonly resourceBudget: ResourceBudget;
}

export interface ResourceBudget {
  /** Maximum total execution time in milliseconds. */
  readonly maxTimeMs: number;
  /** Maximum memory allowed in megabytes (advisory; enforced by Orchestrator). */
  readonly maxMemoryMb: number;
}

export const DEFAULT_RESOURCE_BUDGET: ResourceBudget = {
  maxTimeMs: 120_000,   // 2 minutes
  maxMemoryMb: 512
};

const PRIORITY_ORDER: Record<RequestPriority, number> = {
  high: 0,
  normal: 1,
  low: 2
};

/**
 * ExecutionScheduler manages a priority queue of OrchestrationRequests.
 * Supports enqueueing, priority-based dequeue, cancellation, and status queries.
 */
export class ExecutionScheduler implements IScheduler {
  private readonly queue: ScheduledRequest[] = [];
  private readonly stateStore: ExecutionStateStore;
  private readonly cancelledIds = new Set<string>();

  constructor(stateStore: ExecutionStateStore) {
    this.stateStore = stateStore;
  }

  /** Enqueue a request. Returns the ScheduledRequest. */
  enqueue(
    requestId: string,
    priority: RequestPriority = "normal",
    budget: Partial<ResourceBudget> = {}
  ): ScheduledRequest {
    const request: ScheduledRequest = {
      requestId,
      priority,
      queuedAt: new Date().toISOString(),
      resourceBudget: { ...DEFAULT_RESOURCE_BUDGET, ...budget }
    };
    this.queue.push(request);
    // Sort by priority (high first), then by queuedAt (FIFO within same priority)
    this.queue.sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return a.queuedAt.localeCompare(b.queuedAt);
    });
    this.stateStore.init(requestId);
    return request;
  }

  /** Dequeue the next request (highest priority, FIFO within priority). */
  dequeue(): ScheduledRequest | undefined {
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (this.cancelledIds.has(next.requestId)) continue; // skip cancelled
      this.stateStore.transition(next.requestId, "running", { incrementAttempt: true });
      return next;
    }
    return undefined;
  }

  /**
   * Cancel a queued or running request.
   * If already running, the Orchestrator must check isCancelled() to halt.
   */
  cancel(requestId: string): boolean {
    this.cancelledIds.add(requestId);
    // Remove from queue if still queued
    const idx = this.queue.findIndex(r => r.requestId === requestId);
    if (idx !== -1) this.queue.splice(idx, 1);
    // Update state store
    try {
      this.stateStore.transition(requestId, "cancelled", {
        failureReason: "Cancelled by user or system"
      });
    } catch {
      // requestId may not yet be in store if cancel called before enqueue completes
    }
    return true;
  }

  isCancelled(requestId: string): boolean {
    return this.cancelledIds.has(requestId);
  }

  queueLength(): number {
    return this.queue.length;
  }

  peek(): ScheduledRequest | undefined {
    return this.queue[0];
  }

  getQueueSnapshot(): ScheduledRequest[] {
    return [...this.queue];
  }
}
