// src/production/sdk/WorkerContext.ts
/**
 * Context passed to a Worker during execution.
 * Contains identifiers that allow the Worker to locate the relevant task
 * within the immutable Execution model, plus an optional payload.
 */
export interface WorkerContext {
  /** Identifier of the Execution plan */
  readonly executionId: string;
  /** Identifier of the Job containing the Task */
  readonly jobId: string;
  /** Identifier of the Task to be processed */
  readonly taskId: string;
  /** Optional additional data supplied by the Planner/Runtime */
  readonly payload?: unknown;
}
