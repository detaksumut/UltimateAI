// src/execution/models/ExecutionState.ts

/**
 * Represents the current execution status of a task or a workflow.
 */
export enum ExecutionState {
  Pending = "Pending",
  Running = "Running",
  Completed = "Completed",
  Failed = "Failed",
  Cancelled = "Cancelled"
}
