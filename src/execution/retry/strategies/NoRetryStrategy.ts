// src/execution/retry/strategies/NoRetryStrategy.ts

import { IRetryStrategy } from "../interfaces/IRetryStrategy";
import { RetryContext } from "../models/RetryContext";

/**
 * NoRetryStrategy implements a retry policy that never retries.
 * It always returns false for shouldRetry and a delay of 0 ms.
 */
export class NoRetryStrategy implements IRetryStrategy {
  /**
   * Determines whether a retry should be performed.
   * Always returns false.
   */
  shouldRetry(_context: Readonly<RetryContext>): boolean {
    return false;
  }

  /**
   * Returns the delay before the next retry attempt.
   * Always returns 0.
   */
  nextDelay(_context: Readonly<RetryContext>): number {
    return 0;
  }
}
