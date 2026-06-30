// src/production/runtime/coordinator/RuntimeCoordinator.ts

import { IRuntimeResolver } from "../resolver/RuntimeResolver";
import { IRuntimeEventBus } from "../events/RuntimeEventBus";
import { RuntimeCapability } from "../contracts/RuntimeCapability";
import { IRuntimeContext } from "../contracts/IRuntimeContext";
import { IRuntimeResult } from "../contracts/IRuntimeResult";
import { RuntimePolicy, DEFAULT_RUNTIME_POLICY } from "../policies/RuntimePolicy";
import { TelemetryEmitter } from "../../observability/emitters/TelemetryEmitter";
import { RuntimeTelemetryPhase } from "../../observability/events/RuntimeTelemetryPhase";

export interface IRuntimeCoordinator {
  executeCapability(
    capability: RuntimeCapability, 
    context: IRuntimeContext, 
    policy?: RuntimePolicy
  ): Promise<IRuntimeResult>;
}

export class RuntimeCoordinatorImpl implements IRuntimeCoordinator {
  private readonly telemetryEmitter: TelemetryEmitter;

  constructor(
    private readonly resolver: IRuntimeResolver,
    eventBus: IRuntimeEventBus
  ) {
    this.telemetryEmitter = new TelemetryEmitter(eventBus);
  }

  async executeCapability(
    capability: RuntimeCapability, 
    context: IRuntimeContext, 
    policy: RuntimePolicy = DEFAULT_RUNTIME_POLICY
  ): Promise<IRuntimeResult> {
    
    // 1. Resolution
    const runtime = this.resolver.resolve(capability);
    
    // QUEUED -> STARTING -> RUNNING sequence could be richer in a distributed system
    // For now we emit STARTING immediately before execution.
    
    const causationEvent = this.telemetryEmitter.emit({
      traceId: context.trace.traceId,
      parentTraceId: context.trace.parentTraceId,
      runtimeId: runtime.manifest.id,
      phase: RuntimeTelemetryPhase.STARTING,
      eventType: "RuntimeExecutionStarted",
      payload: { capability }
    });

    try {
      // 2. Execution (with timeout policy)
      const executionPromise = runtime.execute(context);
      
      const timeoutPromise = new Promise<IRuntimeResult>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), policy.timeoutMs);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);

      this.telemetryEmitter.emit({
        traceId: context.trace.traceId,
        parentTraceId: context.trace.parentTraceId,
        causationId: causationEvent.eventId,
        runtimeId: runtime.manifest.id,
        phase: RuntimeTelemetryPhase.COMPLETED,
        eventType: "RuntimeExecutionCompleted",
        payload: { status: result.status, durationMs: result.durationMs }
      });

      return result;

    } catch (error: any) {
      this.telemetryEmitter.emit({
        traceId: context.trace.traceId,
        parentTraceId: context.trace.parentTraceId,
        causationId: causationEvent.eventId,
        runtimeId: runtime.manifest.id,
        phase: RuntimeTelemetryPhase.FAILED,
        eventType: "RuntimeExecutionFailed",
        payload: { error: error.message }
      });

      throw error;
    }
  }
}
