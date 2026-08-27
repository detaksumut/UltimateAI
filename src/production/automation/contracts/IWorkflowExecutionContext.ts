/**
 * IWorkflowExecutionContext.ts
 *
 * The context holding the instance, actor, and variables for execution.
 */

import { IWorkflowInstance } from './IWorkflowInstance';

export interface IWorkflowExecutionContext {
  readonly instance: IWorkflowInstance;
  readonly actor: string; // e.g., user_id or system
  readonly timestamp: string;
  readonly correlation_id: string;
  readonly variables: Record<string, any>;
}
