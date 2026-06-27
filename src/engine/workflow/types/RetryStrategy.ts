export interface RetryStrategy {
  maxAttempts: number;
  initialDelay?: number; // ms
  backoff?: number; // multiplier
  retryOn?: (error: any) => boolean;
}
