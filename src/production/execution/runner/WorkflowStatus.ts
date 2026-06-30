// src/production/execution/runner/WorkflowStatus.ts

/**
 * The state of the overall workflow.
 */
export enum WorkflowStatus {
  PENDING = "PENDING",
  READY = "READY",
  RUNNING = "RUNNING",
  WAITING = "WAITING",
  FAILED = "FAILED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}
