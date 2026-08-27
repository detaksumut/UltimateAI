import { IAutomationAdapter } from './IAutomationAdapter';

/**
 * IAutomationRegistry.ts
 *
 * Keeps track of all registered automation adapters (e.g., n8n, Zapier, Make).
 * The Hub uses this registry to discover where to route events.
 */

export interface IAutomationRegistry {
  /**
   * Registers a new automation adapter into the Hub.
   * @param adapter The adapter instance.
   */
  registerAdapter(adapter: IAutomationAdapter): void;
  
  /**
   * Retrieves an adapter by its provider ID.
   * @param providerId The provider identifier (e.g., 'n8n').
   */
  getAdapter(providerId: string): IAutomationAdapter | undefined;
  
  /**
   * Lists all available/registered adapters.
   */
  listAdapters(): IAutomationAdapter[];
}
