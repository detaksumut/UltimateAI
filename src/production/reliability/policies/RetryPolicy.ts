export interface RetryPolicy {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  jitterFactor: number; // 0.0 to 1.0
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialBackoffMs: 500,
  maxBackoffMs: 5000,
  jitterFactor: 0.1
};
