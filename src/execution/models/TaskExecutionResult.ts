// src/execution/models/TaskExecutionResult.ts

/**
 * Model representing the outcome of a single task's execution.
 * This model is immutable.
 */
export interface TaskExecutionResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: Error;
}
