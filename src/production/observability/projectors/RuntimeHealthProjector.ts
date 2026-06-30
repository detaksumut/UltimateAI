import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";
import { IRuntimeTelemetryEvent } from "../events/IRuntimeTelemetryEvent";
import { RuntimeHealth } from "../contracts/ObservabilityMetrics";
import { RuntimeTelemetryPhase } from "../events/RuntimeTelemetryPhase";

export class RuntimeHealthProjector {
  private healthState = new Map<string, RuntimeHealth>();

  constructor(eventBus: IRuntimeEventBus) {
    eventBus.subscribe("RuntimeExecutionStarted", (e) => this.handleEvent(e as any));
    eventBus.subscribe("RuntimeExecutionCompleted", (e) => this.handleEvent(e as any));
    eventBus.subscribe("RuntimeExecutionFailed", (e) => this.handleEvent(e as any));
  }

  private handleEvent(event: IRuntimeTelemetryEvent) {
    const { runtimeId, phase, payload } = event;
    
    if (!this.healthState.has(runtimeId)) {
      this.healthState.set(runtimeId, {
        runtimeId,
        status: "READY",
        averageDurationMs: 0,
        successRate: 1.0,
        failureCount: 0,
        lastExecutionStatus: "UNKNOWN",
        healthStatus: "Healthy"
      });
    }

    const state = this.healthState.get(runtimeId)!;

    if (phase === RuntimeTelemetryPhase.STARTING || phase === RuntimeTelemetryPhase.RUNNING) {
      state.status = "RUNNING";
    } else if (phase === RuntimeTelemetryPhase.COMPLETED) {
      state.status = "READY";
      state.lastExecutionStatus = "SUCCESS";
      const dur = payload?.durationMs || 0;
      state.averageDurationMs = state.averageDurationMs === 0 ? dur : (state.averageDurationMs + dur) / 2;
    } else if (phase === RuntimeTelemetryPhase.FAILED || phase === RuntimeTelemetryPhase.CANCELLED) {
      state.status = "FAILED";
      state.lastExecutionStatus = "FAILED";
      state.failureCount++;
      state.healthStatus = state.failureCount > 3 ? "Degraded" : "Healthy"; // Simple heuristic
    }
  }

  getHealth(runtimeId: string): RuntimeHealth | undefined {
    return this.healthState.get(runtimeId);
  }

  getAllHealth(): RuntimeHealth[] {
    return Array.from(this.healthState.values());
  }
}
