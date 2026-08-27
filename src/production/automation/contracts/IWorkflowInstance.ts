/**
 * IWorkflowInstance.ts
 *
 * Mutable state of a running workflow execution.
 * The model remains immutable, only the instance evolves.
 */

export interface IWorkflowInstance {
  readonly instance_id: string;
  readonly workflow_id: string;
  readonly workflow_version: string;
  
  current_state: string;
  readonly created_at: string;
  updated_at: string;
}
