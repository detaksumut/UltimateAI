export interface WorkflowStep {
  /** Unique identifier for the step within the workflow */
  id: string;
  /** Human‑readable name */
  name: string;
  /** Action identifier (tool or executor) */
  action: string;
  /** Optional input payload */
  input?: Record<string, unknown>;
  /** Optional expected output shape */
  output?: Record<string, unknown>;
}
