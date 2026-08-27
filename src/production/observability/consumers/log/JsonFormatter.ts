/**
 * ILogFormatter.ts & JsonFormatter.ts
 *
 * Pluggable log formatting.
 */

import { IObservabilityContext } from '../contracts/IObservabilityContext';

export interface ILogFormatter {
  format(context: IObservabilityContext): string;
}

export class JsonFormatter implements ILogFormatter {
  public format(context: IObservabilityContext): string {
    const e = context.event;
    return JSON.stringify({
      level: e.type.includes('Failed') ? 'ERROR' : 'INFO',
      timestamp: e.timestamp,
      trace_id: context.correlation_id || e.execution_id,
      node: context.node_id,
      event_type: e.type,
      execution_id: e.execution_id,
      payload: e.payload
    });
  }
}
