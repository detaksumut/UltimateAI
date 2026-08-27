/**
 * MetricsCollector.ts
 *
 * Consumer 2: Evaluates events and updates Metric counters/gauges/histograms.
 */

import { IEventConsumer } from '../../contracts/IEventDispatcher';
import { IObservabilityContext } from '../../contracts/IObservabilityContext';
import { Counter, Gauge, Timer } from './MetricsPrimitives';

export class MetricsCollector implements IEventConsumer {
  public readonly name = 'MetricsCollector';
  
  public metrics = {
    executions_total: new Counter(),
    executions_successful: new Counter(),
    executions_failed: new Counter(),
    active_executions: new Gauge(),
    workflow_runtime: new Timer(),
    transitions_total: new Counter()
  };
  
  private seen_events = new Set<string>();
  
  public consume(context: IObservabilityContext): void {
    const e = context.event;
    
    if (this.seen_events.has(e.event_id)) {
      return; // Idempotent: ignore replayed events
    }
    this.seen_events.add(e.event_id);
    
    switch (e.type) {
      case 'ExecutionStarted':
        this.metrics.executions_total.inc();
        this.metrics.active_executions.inc();
        this.metrics.workflow_runtime.start(e.execution_id);
        break;
        
      case 'StateTransitioned':
        this.metrics.transitions_total.inc();
        break;
        
      case 'ExecutionCompleted':
        this.metrics.executions_successful.inc();
        this.metrics.active_executions.dec();
        this.metrics.workflow_runtime.stop(e.execution_id);
        break;
        
      case 'ExecutionFailed':
        this.metrics.executions_failed.inc();
        this.metrics.active_executions.dec();
        this.metrics.workflow_runtime.stop(e.execution_id);
        break;
    }
  }
}
