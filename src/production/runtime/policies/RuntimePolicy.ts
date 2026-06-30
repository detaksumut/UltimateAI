// src/production/runtime/policies/RuntimePolicy.ts

/**
 * Constraints and fallback behaviors for executing a runtime.
 */
export interface RuntimePolicy {
  /** Maximum time in milliseconds to wait for a runtime to complete */
  readonly timeoutMs: number;
  
  /** Number of times to retry a failed execution */
  readonly retries: number;
  
  /** The maximum number of concurrent executions allowed for this capability (if supported by coordinator) */
  readonly maxConcurrency: number;
  
  /** 
   * If true, failures will trigger the circuit breaker 
   * to stop sending requests temporarily 
   */
  readonly useCircuitBreaker: boolean;
  
  /** 
   * Optional fallback capability or specific runtime ID to invoke 
   * if this runtime fails completely 
   */
  readonly fallbackRuntimeId?: string;
}

export const DEFAULT_RUNTIME_POLICY: RuntimePolicy = {
  timeoutMs: 30000,
  retries: 0,
  maxConcurrency: 10,
  useCircuitBreaker: false
};
