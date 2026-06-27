// src/execution/retry/models/RetryContext.ts

/**
 * Immutable context passed to retry strategies.
 * All fields are readonly – strategies must not mutate this object.
 *
 * Runtime integration will be implemented in Sprint 2 Milestone 3.
 */
export interface RetryContext {
  /** Current attempt number (1-based: first attempt = 1). */
  readonly currentAttempt: number;

  /** Maximum number of attempts allowed. */
  readonly maxAttempts: number;

  /** The error from the most recent failed attempt, if any. */
  readonly lastError?: Error;
}
