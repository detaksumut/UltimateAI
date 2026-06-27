import { WorkflowState } from '../types/WorkflowState';
import { WorkflowEvent } from '../types/WorkflowEvent';

export interface IWorkflowStateMachine {
  /**
   * Determines the next state based on current state and an event.
   * Implementations must be pure and side‑effect free.
   */
  transition(current: WorkflowState, event: WorkflowEvent): WorkflowState;
}
