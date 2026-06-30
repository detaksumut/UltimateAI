// src/production/execution/runner/IWorkflowRunner.ts

import { ExecutionTaskGraph } from "../planner/ExecutionTaskGraph";
import { WorkflowStatus } from "./WorkflowStatus";

export interface WorkflowState {
  readonly status: WorkflowStatus;
  readonly completedTasks: readonly string[];
  readonly failedTasks: readonly string[];
}

/**
 * Manages the overarching state machine of the workflow.
 * Schedules tasks, handles dependencies, and coordinates retries via the TaskExecutor.
 */
export interface IWorkflowRunner {
  run(graph: ExecutionTaskGraph): Promise<WorkflowState>;
}
