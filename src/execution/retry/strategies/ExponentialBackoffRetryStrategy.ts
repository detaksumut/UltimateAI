// src/execution/retry/strategies/ExponentialBackoffRetryStrategy.ts

import { IRetryStrategy } from "../interfaces/IRetryStrategy";
import { RetryContext } from "../models/RetryContext";

/**
 * ExponentialBackoffRetryStrategy provides an exponentially increasing delay between retry attempts.
 */
export class ExponentialBackoffRetryStrategy implements IRetryStrategy {
  constructor(
    private readonly maxAttempts: number,
    private readonly baseDelay: number,
    private readonly maxDelay: number,
    private readonly multiplier: number
  ) {}

  /**
   * Determines whether a retry should be performed based on the current attempt count.
   */
  shouldRetry(context: Readonly<RetryContext>): boolean {
    return context.currentAttempt < this.maxAttempts;
  }

  /**
   * Returns the delay before the next retry attempt using exponential backoff.
   */
  nextDelay(context: Readonly<RetryContext>): number {
    // Current attempt is 1-based (1 for the first failure).
    // Delay = baseDelay * (multiplier ^ (currentAttempt - 1))
    const attemptIndex = Math.max(0, context.currentAttempt - 1);
    const delay = this.baseDelay * Math.pow(this.multiplier, attemptIndex);
    return Math.min(delay, this.maxDelay);
  }
}
