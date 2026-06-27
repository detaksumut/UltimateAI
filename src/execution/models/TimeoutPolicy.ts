// src/execution/models/TimeoutPolicy.ts

/**
 * Configuration contract for task timeout limits and behavior.
 * This model is immutable.
 */
export interface TimeoutPolicy {
  readonly timeoutMs?: number;
  readonly actionOnTimeout?: "abort" | "ignore";
}
