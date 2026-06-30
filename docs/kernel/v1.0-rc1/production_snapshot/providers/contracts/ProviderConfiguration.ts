// src/production/providers/contracts/ProviderConfiguration.ts

/**
 * Generic configuration for an AI Provider instance.
 * Notice that API keys and credentials are NOT part of this contract.
 * Credentials remain the responsibility of the Infrastructure's secret management.
 */
export interface ProviderConfiguration {
  /** Identifier of the provider (e.g., "google", "openai") */
  readonly providerId: string;
  
  /** Maximum time in milliseconds to wait for a response */
  readonly timeoutMs?: number;
  
  /** Configuration for how many times to retry on retriable errors */
  readonly maxRetries?: number;
  
  /** Optional custom endpoint (e.g., for enterprise instances or local routing) */
  readonly endpoint?: string;
  
  /** Any other provider-specific settings that aren't credentials */
  readonly customOptions?: Record<string, unknown>;
}
