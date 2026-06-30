// src/production/kernel/KernelExecutionReport.ts

export interface KernelExecutionReport {
  readonly traceId: string;
  
  /** The sequence of runtimes that were executed */
  readonly runtimeSequence: readonly string[];
  
  /** Timing details for each runtime */
  readonly executionTimes: Record<string, number>;
  
  readonly warnings: readonly string[];
  
  readonly finalStatus: "SUCCESS" | "PARTIAL" | "FAILURE";
  
  readonly totalDurationMs: number;
}
