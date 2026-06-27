export interface WorkflowResult<T = any> {
  /** Unique identifier for this result */
  resultId: string;
  /** Execution identifier */
  executionId: string;
  /** Whether the workflow succeeded */
  success: boolean;
  /** Output payload on success */
  output?: T;
  /** Error information on failure */
  error?: unknown;
}
