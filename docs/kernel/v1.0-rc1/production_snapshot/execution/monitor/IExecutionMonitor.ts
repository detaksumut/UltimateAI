// src/production/execution/monitor/IExecutionMonitor.ts

/**
 * Observes real-time execution constraints.
 */
export interface IExecutionMonitor {
  enforceTimeout(durationMs: number): void;
  enforceConcurrency(activeCount: number): void;
  enforceMemoryLimit(bytesUsed: number): void;
  checkCancellation(executionId: string): boolean;
}
