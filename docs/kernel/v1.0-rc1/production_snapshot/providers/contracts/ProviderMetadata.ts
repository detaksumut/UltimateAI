// src/production/providers/contracts/ProviderMetadata.ts

import { ProviderCapability } from "./ProviderCapability";
import { ProviderFeature } from "./ProviderFeatures";

/**
 * Descriptive metadata about an AI Provider.
 * This MUST NOT contain API keys, endpoints, or credentials.
 * It is solely for identifying the provider and its supported capabilities.
 */
export interface ProviderMetadata {
  /** Unique identifier for the provider (e.g., "google", "openai") */
  readonly providerId: string;
  
  /** Human-readable provider name (e.g., "Google AI", "OpenAI") */
  readonly providerName: string;
  
  /** Version of the provider integration */
  readonly version: string;
  
  /** The generic capabilities this provider supports */
  readonly supportedCapabilities: readonly ProviderCapability[];
  
  /** The specific features the provider implements */
  readonly features: readonly ProviderFeature[];
  
  /** Modalities supported (e.g., "text", "image", "audio") */
  readonly supportedModalities: readonly string[];
}
