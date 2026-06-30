// src/production/providers/contracts/ProviderHealth.ts

/**
 * High-level status of a provider's health.
 */
export enum ProviderHealthStatus {
  ONLINE = "online",
  DEGRADED = "degraded",
  OFFLINE = "offline",
  UNKNOWN = "unknown",
}

/**
 * Contract for checking and reporting the health of an AI Provider.
 * Used by Infrastructure to perform failovers or select the best provider.
 */
export interface ProviderHealth {
  /** The current health status of the provider */
  readonly status: ProviderHealthStatus;
  
  /** Latency in milliseconds (if known) */
  readonly latencyMs?: number;
  
  /** Timestamp of the last health check */
  readonly lastCheckedAt: Date;
  
  /** Optional message or reason for the current status */
  readonly message?: string;
}
