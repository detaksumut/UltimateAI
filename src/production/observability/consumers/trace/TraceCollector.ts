/**
 * TraceCollector.ts
 *
 * Consumer 3: Tracing.
 * Uses OpenTelemetry-style structural hierarchy: Trace -> Span -> Event.
 */

import { IEventConsumer } from '../../contracts/IEventDispatcher';
import { IObservabilityContext } from '../../contracts/IObservabilityContext';

export interface ITraceEvent {
  name: string;
  timestamp: string;
  attributes: any;
}

export interface ITraceSpan {
  span_id: string;
  name: string;
  start_time: string;
  end_time?: string;
  events: ITraceEvent[];
}

export interface ITrace {
  trace_id: string;
  spans: ITraceSpan[];
}

export class TraceCollector implements IEventConsumer {
  public readonly name = 'TraceCollector';
  
  public traces = new Map<string, ITrace>();
  
  public consume(context: IObservabilityContext): void {
    const traceId = context.correlation_id || context.event.execution_id;
    const e = context.event;
    
    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, { trace_id: traceId, spans: [] });
    }
    
    const trace = this.traces.get(traceId)!;
    
    // For simplicity, treat the entire execution as a single span for now
    let span = trace.spans.find(s => s.span_id === e.execution_id);
    if (!span) {
      span = {
        span_id: e.execution_id,
        name: `Execution:${e.execution_id}`,
        start_time: e.timestamp,
        events: []
      };
      trace.spans.push(span);
    }
    
    span.events.push({
      name: e.type,
      timestamp: e.timestamp,
      attributes: e.payload
    });
    
    if (e.type === 'ExecutionCompleted' || e.type === 'ExecutionFailed') {
      span.end_time = e.timestamp;
    }
  }
}
