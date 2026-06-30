import { CircuitBreakerPolicy, DEFAULT_CIRCUIT_BREAKER_POLICY } from "../policies/CircuitBreakerPolicy";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN"
}

export class CircuitOpenException extends Error {
  constructor(runtimeId: string) {
    super(`Circuit breaker is OPEN for runtime: ${runtimeId}`);
    this.name = "CircuitOpenException";
  }
}

interface CircuitRecord {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  halfOpenTrials: number;
}

export class CircuitBreakerRegistry {
  private records = new Map<string, CircuitRecord>();

  constructor(private policy: CircuitBreakerPolicy = DEFAULT_CIRCUIT_BREAKER_POLICY) {}

  private getRecord(runtimeId: string): CircuitRecord {
    if (!this.records.has(runtimeId)) {
      this.records.set(runtimeId, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        halfOpenTrials: 0
      });
    }
    return this.records.get(runtimeId)!;
  }

  isOpen(runtimeId: string): boolean {
    const record = this.getRecord(runtimeId);
    if (record.state === CircuitState.CLOSED) return false;

    if (record.state === CircuitState.OPEN) {
      const now = Date.now();
      // Check if it's time to transition to HALF_OPEN
      if (now - record.lastFailureTime > this.policy.openDurationMs) {
        record.state = CircuitState.HALF_OPEN;
        record.halfOpenTrials = 0;
        return false;
      }
      return true;
    }

    if (record.state === CircuitState.HALF_OPEN) {
      if (record.halfOpenTrials >= this.policy.halfOpenMaxTrials) {
        return true;
      }
      record.halfOpenTrials++;
      return false; // Allow a trial
    }

    return false;
  }

  recordSuccess(runtimeId: string): void {
    const record = this.getRecord(runtimeId);
    record.state = CircuitState.CLOSED;
    record.failureCount = 0;
    record.halfOpenTrials = 0;
  }

  recordFailure(runtimeId: string): void {
    const record = this.getRecord(runtimeId);
    record.lastFailureTime = Date.now();

    if (record.state === CircuitState.HALF_OPEN) {
      // Failed during trial, trip immediately
      record.state = CircuitState.OPEN;
      record.failureCount++;
      return;
    }

    record.failureCount++;
    if (record.failureCount >= this.policy.failureThreshold) {
      record.state = CircuitState.OPEN;
    }
  }
}
