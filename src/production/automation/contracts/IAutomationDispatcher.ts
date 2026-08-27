import { IAutomationEvent } from './IAutomationEvent';

/**
 * IAutomationDispatcher.ts
 *
 * Responsible for receiving events from the Event Bus and dispatching them 
 * to the appropriate registered adapters via the Registry.
 */

export interface IAutomationDispatcher {
  /**
   * Broadcasts an event to all interested adapters or specific targets.
   * @param event The standardized event.
   */
  broadcast(event: IAutomationEvent): Promise<void>;
  
  /**
   * Dispatches an event specifically for Internal or External execution.
   */
  routeEvent(event: IAutomationEvent, strategy: 'internal' | 'external'): Promise<void>;
}
