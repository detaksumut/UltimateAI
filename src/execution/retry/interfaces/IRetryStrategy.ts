// src/execution/retry/interfaces/IRetryStrategy.ts

import { RetryContext } from "../models/RetryContext";

/**
 * Strategy interface for retry policies.
 * Implementations decide whether to retry and the delay before next attempt.
 */
export interface IRetryStrategy {
  /**
   * Determines if a retry should be performed based on the given context.
   */
  shouldRetry(context: Readonly<RetryContext>): boolean;

  /**
   * Returns the delay (ms) before the next retry attempt.
   * Return 0 when no delay is needed.
   */
  nextDelay(context: Readonly<RetryContext>): number;
}
