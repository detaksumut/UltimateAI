// src/execution/retry/strategies/FixedDelayRetryStrategy.ts

import { IRetryStrategy } from "../interfaces/IRetryStrategy";
import { RetryContext } from "../models/RetryContext";

/**
 * FixedDelayRetryStrategy provides a constant delay between retry attempts.
 */
export class FixedDelayRetryStrategy implements IRetryStrategy {
  constructor(
    private readonly maxAttempts: number,
    private readonly baseDelay: number
  ) {}

  /**
   * Determines whether a retry should be performed based on the current attempt count.
   */
  shouldRetry(context: Readonly<RetryContext>): boolean {
    return context.currentAttempt < this.maxAttempts;
  }

  /**
   * Returns the fixed delay before the next retry attempt.
   */
  nextDelay(_context: Readonly<RetryContext>): number {
    return this.baseDelay;
  }
}
