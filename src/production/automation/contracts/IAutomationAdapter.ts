import { IAutomationEvent } from './IAutomationEvent';
import { IAutomationProvider } from './IAutomationProvider';

/**
 * IAutomationAdapter.ts
 *
 * The contract that all specific automation adapters must implement.
 * This translates the generic IAutomationEvent into a provider-specific action.
 */

export interface IAutomationAdapter {
  readonly provider: IAutomationProvider;
  
  /**
   * Dispatches the standardized event to the specific provider.
   * @param event The standardized automation event.
   */
  dispatch(event: IAutomationEvent): Promise<void>;
  
  /**
   * Health check to ensure the provider is reachable.
   */
  healthCheck(): Promise<boolean>;
}
