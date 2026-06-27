// src/execution/retry/factories/RetryStrategyFactory.ts

import { IRetryStrategy } from "../interfaces/IRetryStrategy";
import { RetryPolicy } from "../models/RetryPolicy";
import { NoRetryStrategy } from "../strategies/NoRetryStrategy";
import { FixedDelayRetryStrategy } from "../strategies/FixedDelayRetryStrategy";
import { ExponentialBackoffRetryStrategy } from "../strategies/ExponentialBackoffRetryStrategy";

/**
 * Factory for creating the appropriate IRetryStrategy based on a given RetryPolicy.
 * Follows the Strategy Pattern to decouple configuration from implementation.
 */
export class RetryStrategyFactory {
  /**
   * Creates an instance of IRetryStrategy corresponding to the provided policy type.
   * If the policy is undefined or its type is unrecognized, it defaults to NoRetryStrategy.
   */
  public static create(policy?: RetryPolicy): IRetryStrategy {
    if (!policy) {
      return new NoRetryStrategy();
    }

    switch (policy.type) {
      case "none":
        return new NoRetryStrategy();
      
      case "fixed":
        return new FixedDelayRetryStrategy(policy.maxAttempts, policy.baseDelay);
      
      case "exponential":
        return new ExponentialBackoffRetryStrategy(
          policy.maxAttempts,
          policy.baseDelay,
          policy.maxDelay,
          policy.multiplier
        );
      
      default:
        // Fallback to NoRetryStrategy if an unknown type is provided
        return new NoRetryStrategy();
    }
  }
}
