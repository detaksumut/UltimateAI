// src/production/providers/contracts/IAIProvider.ts

import { ProviderMetadata } from "./ProviderMetadata";
import { ProviderRequest } from "./ProviderRequest";
import { ProviderResponse } from "./ProviderResponse";
import { ProviderHealth } from "./ProviderHealth";

/**
 * The standard interface that ALL AI Providers must implement.
 * This contract ensures that the Worker Framework interacts with all
 * vendors (Google, OpenAI, Anthropic, etc.) in a uniform, vendor-agnostic manner.
 */
export interface IAIProvider {
  /** Immutable metadata identifying the provider and its capabilities */
  readonly metadata: ProviderMetadata;

  /**
   * Executes a vendor-agnostic request, returning a normalized response.
   * Internally, the provider translates the request to the vendor's API format
   * and translates the vendor's response back to the UltimateAI format.
   * Throws ProviderError if execution fails.
   */
  generate(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Checks and returns the current health and availability of this provider.
   */
  checkHealth(): Promise<ProviderHealth>;
}
