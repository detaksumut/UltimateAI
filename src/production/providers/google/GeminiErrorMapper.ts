// src/production/providers/google/GeminiErrorMapper.ts

import { ProviderError, ProviderErrorCode } from "../contracts/ProviderError";

/**
 * Normalizes vendor-specific errors into UltimateAI's ProviderError.
 */
export class GeminiErrorMapper {
  private static providerId = "google";

  /**
   * Translates a raw error (e.g., from HTTP fetch) into a ProviderError.
   */
  public static mapError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error; // Already normalized
    }

    const message = error instanceof Error ? error.message : "Unknown Gemini Error";
    
    // Simple heuristic for HTTP status codes / common messages
    // In a real implementation, we would inspect the Response object or Google API Error structure
    if (message.includes("429") || message.includes("quota") || message.includes("Too Many Requests")) {
      return new ProviderError(message, ProviderErrorCode.RATE_LIMIT, this.providerId, true, error);
    }

    if (message.includes("401") || message.includes("403") || message.includes("API key")) {
      return new ProviderError(message, ProviderErrorCode.AUTHENTICATION, this.providerId, false, error);
    }

    if (message.includes("503") || message.includes("502") || message.includes("Unavailable")) {
      return new ProviderError(message, ProviderErrorCode.UNAVAILABLE, this.providerId, true, error);
    }

    if (message.includes("timeout") || message.includes("abort")) {
      return new ProviderError(message, ProviderErrorCode.TIMEOUT, this.providerId, true, error);
    }

    if (message.includes("400") || message.includes("Invalid")) {
      return new ProviderError(message, ProviderErrorCode.INVALID_REQUEST, this.providerId, false, error);
    }

    return new ProviderError(message, ProviderErrorCode.UNKNOWN, this.providerId, false, error);
  }
}
