// src/execution/models/ExecutionEvent.ts

export type ExecutionEventType =
  | "WorkflowStarted"
  | "WorkflowCompleted"
  | "WorkflowFailed"
  | "TaskStarted"
  | "TaskCompleted"
  | "TaskFailed";

/**
 * Event representing state changes during workflow and task execution.
 */
export interface ExecutionEvent {
  readonly type: ExecutionEventType;
  readonly timestamp: Date;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly executionId: string;
}
