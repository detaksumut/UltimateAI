// src/production/providers/contracts/ProviderError.ts

/**
 * Normalized error codes for all AI Providers.
 */
export enum ProviderErrorCode {
  AUTHENTICATION = "authentication",
  RATE_LIMIT = "rate_limit",
  UNAVAILABLE = "unavailable",
  INVALID_REQUEST = "invalid_request",
  TIMEOUT = "timeout",
  INTERNAL = "internal",
  UNKNOWN = "unknown",
}

/**
 * Standardized error class ensuring that all vendor-specific errors 
 * are translated into a common format for the Worker Framework.
 */
export class ProviderError extends Error {
  public readonly code: ProviderErrorCode;
  public readonly retriable: boolean;
  public readonly providerId: string;
  public readonly originalError?: unknown;

  constructor(
    message: string, 
    code: ProviderErrorCode, 
    providerId: string, 
    retriable: boolean = false,
    originalError?: unknown
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.providerId = providerId;
    this.retriable = retriable;
    this.originalError = originalError;
  }
}
