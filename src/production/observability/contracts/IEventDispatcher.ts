/**
 * IEventDispatcher.ts
 *
 * Defines the contract for internal event dispatching.
 * Execution Kernel only knows this interface.
 */

import { IExecutionEvent } from '../../execution/contracts/IExecutionEvent';
import { IObservabilityContext } from './IObservabilityContext';

export interface IEventConsumer {
  readonly name: string;
  consume(context: IObservabilityContext): void;
}

export interface IEventDispatcher {
  publish(event: IExecutionEvent): void;
}
