export interface RecoveryPolicy {
  /** Maximum number of retry attempts per step. */
  readonly maxRetries: number;
  /** Alternative generator ID to use when primary fails. */
  readonly fallbackGeneratorId?: string;
  /** Allow returning a partial result if some steps fail. */
  readonly allowPartialResult: boolean;
  /** Stop retrying after this many consecutive failures (circuit breaker). */
  readonly circuitBreakerThreshold: number;
  /** Maximum allowed duration per step in milliseconds. A step that exceeds
   *  this is considered timed-out and will be retried or fallen back. */
  readonly maximumStepDurationMs: number;
}

export const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = {
  maxRetries: 3,
  allowPartialResult: false,
  circuitBreakerThreshold: 5,
  maximumStepDurationMs: 30_000  // 30 seconds
};

export interface RecoveryResult<T> {
  readonly value: T;
  readonly attempts: number;
  readonly usedFallback: boolean;
  readonly timedOut: boolean;
}

/**
 * RecoveryManager wraps any async operation in retry / fallback /
 * circuit-breaker / timeout logic.
 */
export class RecoveryManager {
  private consecutiveFailures = 0;
  private readonly policy: RecoveryPolicy;

  constructor(policy: Partial<RecoveryPolicy> = {}) {
    this.policy = { ...DEFAULT_RECOVERY_POLICY, ...policy };
  }

  /**
   * Execute `operation` with recovery logic.
   * If it fails, retry up to `maxRetries` times.
   * If all retries fail and `fallback` is provided, call it.
   * Each attempt is also bound by `maximumStepDurationMs`.
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<RecoveryResult<T>> {
    // Circuit breaker check
    if (this.consecutiveFailures >= this.policy.circuitBreakerThreshold) {
      throw new Error(
        `Circuit breaker open: ${this.consecutiveFailures} consecutive failures exceed threshold ${this.policy.circuitBreakerThreshold}`
      );
    }

    let attempts = 0;
    let lastError: Error | undefined;

    while (attempts <= this.policy.maxRetries) {
      attempts++;
      try {
        const value = await this.withTimeout(operation(), this.policy.maximumStepDurationMs);
        this.consecutiveFailures = 0;
        return { value, attempts, usedFallback: false, timedOut: false };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.consecutiveFailures++;
        const timedOut = lastError.message.includes("timed out");
        if (attempts > this.policy.maxRetries) break;
        // Brief delay before retry (exponential back-off lite)
        await this.delay(Math.min(100 * attempts, 1000));
      }
    }

    // Attempt fallback
    if (fallback) {
      try {
        const value = await this.withTimeout(fallback(), this.policy.maximumStepDurationMs);
        this.consecutiveFailures = 0;
        return { value, attempts, usedFallback: true, timedOut: false };
      } catch (fallbackErr: any) {
        this.consecutiveFailures++;
      }
    }

    // Partial result allowed: propagate as structured failure
    if (this.policy.allowPartialResult) {
      throw new Error(`[PARTIAL] ${lastError?.message ?? "unknown error"}`);
    }

    throw lastError ?? new Error("RecoveryManager: all attempts exhausted");
  }

  resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
  }

  get isCircuitOpen(): boolean {
    return this.consecutiveFailures >= this.policy.circuitBreakerThreshold;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Step timed out after ${ms}ms`)),
        ms
      );
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); }
      );
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
