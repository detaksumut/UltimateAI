export interface RuntimeHealth {
  runtimeId: string;
  status: "READY" | "RUNNING" | "FAILED";
  averageDurationMs: number;
  successRate: number; // 0.0 to 1.0
  failureCount: number;
  lastExecutionStatus: "SUCCESS" | "FAILED" | "UNKNOWN";
  healthStatus: "Healthy" | "Degraded" | "Timeout";
}

export interface RuntimeMetrics {
  runtimeId: string;
  executionCount: number;
  maxDurationMs: number;
  artifactsProduced: number;
  timeouts: number;
}
