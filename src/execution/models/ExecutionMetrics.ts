// src/execution/models/ExecutionMetrics.ts

/**
 * Read-only metrics detailing task and workflow execution performance.
 */
export interface ExecutionMetrics {
  /** The timestamp when execution started */
  readonly startedAt: Date;
  /** The timestamp when execution finished */
  readonly finishedAt?: Date;
  /** Total duration in milliseconds */
  readonly durationMs?: number;
  /** Total number of tasks in the execution graph */
  readonly totalTasks: number;
  /** Number of tasks successfully completed */
  readonly completedTasks: number;
  /** Number of tasks that failed during execution */
  readonly failedTasks: number;
}
