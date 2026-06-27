// src/execution/retry/models/RetryPolicy.ts

/**
 * Union type representing the kind of retry strategy to apply.
 *
 * - "none"         – no retries (fail immediately)
 * - "fixed"        – constant delay between attempts
 * - "exponential"  – exponentially increasing delay between attempts
 */
export type RetryType = "none" | "fixed" | "exponential";

/**
 * Immutable domain model that describes a retry configuration.
 *
 * RetryPolicy is a pure data object:
 *   • No business logic.
 *   • No knowledge of IRetryStrategy or ExecutionRuntime.
 *   • All fields are readonly.
 *
 * A RetryStrategyFactory (Sprint 2 Milestone 3) will consume this model
 * to instantiate the appropriate IRetryStrategy implementation.
 */
export class RetryPolicy {
  /** Which retry algorithm to use. */
  public readonly type: RetryType;

  /** Maximum number of attempts (including the initial attempt). */
  public readonly maxAttempts: number;

  /** Base delay in milliseconds before the first retry. */
  public readonly baseDelay: number;

  /** Upper-bound cap on delay in milliseconds. */
  public readonly maxDelay: number;

  /** Multiplier applied to the delay on each successive attempt (used by exponential). */
  public readonly multiplier: number;

  constructor(params: {
    readonly type: RetryType;
    readonly maxAttempts: number;
    readonly baseDelay: number;
    readonly maxDelay: number;
    readonly multiplier: number;
  }) {
    this.type = params.type;
    this.maxAttempts = params.maxAttempts;
    this.baseDelay = params.baseDelay;
    this.maxDelay = params.maxDelay;
    this.multiplier = params.multiplier;

    // Freeze to guarantee deep immutability at runtime.
    Object.freeze(this);
  }
}
