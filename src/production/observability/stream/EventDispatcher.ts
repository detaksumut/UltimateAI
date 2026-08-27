/**
 * EventDispatcher.ts
 *
 * Implements IEventDispatcher. Evaluates Consumer Isolation.
 * If one consumer fails, it catches the error and does not crash the others (or the Kernel).
 */

import { IEventDispatcher, IEventConsumer } from '../contracts/IEventDispatcher';
import { IObservabilityContext } from '../contracts/IObservabilityContext';
import { IExecutionEvent } from '../../execution/contracts/IExecutionEvent';
import * as os from 'os';

export class EventDispatcher implements IEventDispatcher {
  private consumers: IEventConsumer[] = [];
  
  public subscribe(consumer: IEventConsumer): void {
    this.consumers.push(consumer);
  }
  
  public publish(event: IExecutionEvent): void {
    const context: IObservabilityContext = {
      environment: process.env.NODE_ENV || 'development',
      node_id: os.hostname() || 'local-node',
      service_version: '1.0.0', // Read from config/package in reality
      correlation_id: event.payload?.correlation_id, // Extract if present
      event
    };
    
    for (const consumer of this.consumers) {
      try {
        consumer.consume(context);
      } catch (error: any) {
        // Consumer Isolation: Failure in one consumer doesn't block the stream
        console.error(`[EventDispatcher] Consumer '${consumer.name}' failed to process event ${event.event_id}:`, error.message);
      }
    }
  }
}
