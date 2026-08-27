/**
 * StructuredLogger.ts
 *
 * Consumer 1: Structured Logger.
 * Uses pluggable formatter to log events.
 */

import { IEventConsumer } from '../../contracts/IEventDispatcher';
import { IObservabilityContext } from '../../contracts/IObservabilityContext';
import { ILogFormatter } from './JsonFormatter';

export class StructuredLogger implements IEventConsumer {
  public readonly name = 'StructuredLogger';
  
  // Array to capture logs in memory for testing purposes
  public readonly logs: string[] = [];
  
  constructor(private formatter: ILogFormatter) {}
  
  public consume(context: IObservabilityContext): void {
    const formatted = this.formatter.format(context);
    this.logs.push(formatted);
    // In production, would write to process.stdout or a file stream
  }
}
