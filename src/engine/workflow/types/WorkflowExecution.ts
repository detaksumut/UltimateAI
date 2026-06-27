export interface WorkflowExecution {
  /** Unique identifier for this execution */
  executionId: string;
  /** Identifier of the workflow definition */
  workflowId: string;
  /** Optional user or system that started the execution */
  startedBy?: string;
  /** Timestamp when execution started */
  startedAt: Date;
  /** Timestamp when execution finished (if completed) */
  finishedAt?: Date;
  /** Duration in ms (computed after finish) */
  durationMs?: number;
  /** Current state of the execution */
  state: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  /** Optional error information */
  error?: unknown;
}
