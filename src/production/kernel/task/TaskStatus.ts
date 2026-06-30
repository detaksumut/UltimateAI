// src/production/kernel/task/TaskStatus.ts

/**
 * Runtime status of a task.
 * Note: This resides in ExecutionSession (runtime), not in the immutable Task model.
 */
export enum TaskStatus {
  PENDING = "pending",
  READY = "ready",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}
