import { IRetryExecutor } from '../interfaces';
import { RetryStrategy } from '../types/RetryStrategy';

/** Simple retry executor */
export class RetryExecutor implements IRetryExecutor {
  async execute<T>(fn: () => Promise<T>, strategy: RetryStrategy): Promise<T> {
    const maxAttempts = strategy.maxAttempts ?? 1;
    let attempts = 0;
    let delay = strategy.initialDelay ?? 0;
    const backoff = strategy.backoff ?? 1;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts || (strategy.retryOn && !strategy.retryOn(err))) {
          throw err;
        }
        if (delay > 0) {
          await new Promise(res => setTimeout(res, delay));
        }
        delay = delay * backoff;
      }
    }
  }
}
