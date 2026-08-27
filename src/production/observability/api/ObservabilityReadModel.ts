/**
 * ObservabilityReadModel.ts
 *
 * Provides a safe, read-only snapshot of all Collector data for the Dashboard API.
 */

import { MetricsCollector } from '../consumers/metrics/MetricsCollector';
import { TraceCollector } from '../consumers/trace/TraceCollector';

export class ObservabilityReadModel {
  constructor(
    private metrics: MetricsCollector,
    private trace: TraceCollector
  ) {}
  
  public getMetricsSnapshot() {
    return {
      executions_total: this.metrics.metrics.executions_total.get(),
      executions_successful: this.metrics.metrics.executions_successful.get(),
      executions_failed: this.metrics.metrics.executions_failed.get(),
      active_executions: this.metrics.metrics.active_executions.get(),
      transitions_total: this.metrics.metrics.transitions_total.get(),
      avg_workflow_runtime_ms: this.metrics.metrics.workflow_runtime.getHistogram().avg()
    };
  }
  
  public getTraceSummary(traceId: string) {
    const trace = this.trace.traces.get(traceId);
    if (!trace) return null;
    return trace;
  }
}
