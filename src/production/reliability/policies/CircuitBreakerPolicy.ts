export interface CircuitBreakerPolicy {
  failureThreshold: number; // Number of consecutive failures before tripping
  openDurationMs: number; // How long to stay open before attempting half-open
  halfOpenMaxTrials: number; // How many trials to allow when half-open
}

export const DEFAULT_CIRCUIT_BREAKER_POLICY: CircuitBreakerPolicy = {
  failureThreshold: 5,
  openDurationMs: 60000, // 1 minute
  halfOpenMaxTrials: 1
};
