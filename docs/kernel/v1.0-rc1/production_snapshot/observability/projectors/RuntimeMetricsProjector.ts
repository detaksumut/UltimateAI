import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";
import { IRuntimeTelemetryEvent } from "../events/IRuntimeTelemetryEvent";
import { RuntimeMetrics } from "../contracts/ObservabilityMetrics";
import { RuntimeTelemetryPhase } from "../events/RuntimeTelemetryPhase";

export class RuntimeMetricsProjector {
  private metricsState = new Map<string, RuntimeMetrics>();

  constructor(eventBus: IRuntimeEventBus) {
    eventBus.subscribe("RuntimeExecutionStarted", (e) => this.handleEvent(e as any));
    eventBus.subscribe("RuntimeExecutionCompleted", (e) => this.handleEvent(e as any));
    eventBus.subscribe("RuntimeExecutionFailed", (e) => this.handleEvent(e as any));
  }

  private handleEvent(event: IRuntimeTelemetryEvent) {
    const { runtimeId, phase, payload } = event;
    
    if (!this.metricsState.has(runtimeId)) {
      this.metricsState.set(runtimeId, {
        runtimeId,
        executionCount: 0,
        maxDurationMs: 0,
        artifactsProduced: 0,
        timeouts: 0
      });
    }

    const state = this.metricsState.get(runtimeId)!;

    if (phase === RuntimeTelemetryPhase.STARTING) {
      state.executionCount++;
    } else if (phase === RuntimeTelemetryPhase.COMPLETED) {
      const dur = payload?.durationMs || 0;
      if (dur > state.maxDurationMs) {
        state.maxDurationMs = dur;
      }
      state.artifactsProduced++; // Assuming success means 1 primary artifact
    } else if (phase === RuntimeTelemetryPhase.FAILED) {
      if (payload?.error?.includes("Timeout")) {
        state.timeouts++;
      }
    }
  }

  getMetrics(runtimeId: string): RuntimeMetrics | undefined {
    return this.metricsState.get(runtimeId);
  }

  getAllMetrics(): RuntimeMetrics[] {
    return Array.from(this.metricsState.values());
  }
}
