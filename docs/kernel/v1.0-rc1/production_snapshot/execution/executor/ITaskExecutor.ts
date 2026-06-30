// src/production/execution/executor/ITaskExecutor.ts

import { ExecutionTask, TaskResult } from "./ExecutionTask";

/**
 * Executes a single, isolated tactical task.
 * Knows nothing of workflows or blueprints.
 */
export interface ITaskExecutor {
  executeTask(task: ExecutionTask): Promise<TaskResult>;
}
