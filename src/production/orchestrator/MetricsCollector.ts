import { PipelineTrace } from "./ObservabilityTracer";
import { ExecutionStateStore } from "./ExecutionStateStore";

export interface MetricsSummary {
  readonly totalRequests: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly cancelledCount: number;
  readonly successRate: number;        // 0.0 – 1.0
  readonly averageDurationMs: number;
  readonly totalRepairs: number;
  readonly retryCount: number;
  readonly timeoutCount: number;
  readonly generatorUsageMap: Record<string, number>; // generatorId → usage count
  readonly collectedAt: string;
}

/**
 * MetricsCollector aggregates telemetry from completed pipeline traces
 * and the ExecutionStateStore to produce a unified MetricsSummary.
 * Equivalent to a GET /metrics endpoint.
 */
export class MetricsCollector {
  private readonly traces: PipelineTrace[] = [];
  private readonly stateStore: ExecutionStateStore;

  constructor(stateStore: ExecutionStateStore) {
    this.stateStore = stateStore;
  }

  /** Register a completed PipelineTrace for aggregation. */
  record(trace: PipelineTrace): void {
    this.traces.push(trace);
  }

  /** Compute and return the current MetricsSummary. */
  getSummary(): MetricsSummary {
    const all = this.stateStore.getAll();
    const totalRequests = all.length;
    const successCount = all.filter(s => s.status === "completed").length;
    const failedCount = all.filter(s => s.status === "failed").length;
    const cancelledCount = all.filter(s => s.status === "cancelled").length;
    const successRate = totalRequests > 0 ? successCount / totalRequests : 0;

    let totalDuration = 0;
    let totalRepairs = 0;
    let retryCount = 0;
    let timeoutCount = 0;
    const generatorUsageMap: Record<string, number> = {};

    for (const trace of this.traces) {
      totalDuration += trace.totalDurationMs;
      totalRepairs += trace.totalRepairs;

      for (const step of trace.steps) {
        if (step.status === "failed" && step.failureReason) {
          if (step.failureReason.includes("timed out")) timeoutCount++;
          else retryCount++;
        }
        if (step.generatorId) {
          generatorUsageMap[step.generatorId] = (generatorUsageMap[step.generatorId] ?? 0) + 1;
        }
      }
    }

    const averageDurationMs = this.traces.length > 0
      ? Math.round(totalDuration / this.traces.length)
      : 0;

    return {
      totalRequests,
      successCount,
      failedCount,
      cancelledCount,
      successRate: Math.round(successRate * 1000) / 1000,
      averageDurationMs,
      totalRepairs,
      retryCount,
      timeoutCount,
      generatorUsageMap,
      collectedAt: new Date().toISOString()
    };
  }
}
