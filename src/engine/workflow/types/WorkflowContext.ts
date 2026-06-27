// Workflow execution context interface
export interface WorkflowContext {
  /** Unique identifier for this execution instance */
  executionId: string;
  /** Reference to the workflow definition */
  definitionId: string;
  /** AbortSignal for cancellation */
  abortSignal: AbortSignal;
  /** Optional execution metadata */
  metadata?: Record<string, unknown>;
}
