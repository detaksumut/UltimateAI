/**
 * IExecutionPolicy.ts
 *
 * Defines the immutable operational policy for a given execution context.
 */

export interface IExecutionPolicy {
  readonly timeout_ms: number;
  readonly max_retries: number;
  readonly retry_backoff_ms: number;
  readonly priority: number;
}
