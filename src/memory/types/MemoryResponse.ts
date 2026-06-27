/**
 * Response contract from the memory subsystem.
 */
export interface MemoryResponse {
  /** Indicates if the operation succeeded */
  success: boolean;

  /** Optional result data (e.g., retrieved value) */
  data?: unknown;

  /** Optional error information when success is false */
  error?: string | Error;

  /** Execution latency in milliseconds */
  latencyMs?: number;

  /** Information about the provider that handled the request */
  providerInfo?: {
    /** Provider identifier */
    id: string;
    /** Optional version string */
    version?: string;
  };

  /** Whether the result was served from a cache */
  cached?: boolean;

  /** Confidence level of the result, 0‑1 */
  confidence?: number;

  /** Arbitrary telemetry or diagnostics */
  telemetry?: Record<string, unknown>;
}
