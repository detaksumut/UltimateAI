// src/production/execution/executor/ExecutionTask.ts

/**
 * A purely operational, micro-level task.
 */
export interface ExecutionTask {
  readonly taskId: string;
  readonly toolName: string;
  readonly toolPayload: Record<string, any>;
  
  /** IDs of tasks that must complete before this one starts */
  readonly dependencies: readonly string[];
}

export interface TaskResult {
  readonly taskId: string;
  readonly status: "SUCCESS" | "FAILED";
  readonly output: any;
  readonly durationMs: number;
  readonly error?: string;
}
