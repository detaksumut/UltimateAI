import { WorkflowState } from '../types/WorkflowState';
import { WorkflowEvent } from '../types/WorkflowEvent';
/**
 * Simple state machine implementing IWorkflowStateMachine.
 * It deterministically maps events to next states.
 */
export class WorkflowStateMachine {
  /**
   * Computes the next state based on current state and an event.
   * The implementation follows a minimal set of transitions covering the
   * lifecycle events defined in the architecture.
   */
  public transition(current: WorkflowState, event: WorkflowEvent): WorkflowState {
    switch (event.type) {
      case 'workflow.started':
        return WorkflowState.Running;
      case 'workflow.completed':
        return WorkflowState.Completed;
      case 'workflow.failed':
        return WorkflowState.Failed;
      case 'workflow.cancelled':
        return WorkflowState.Cancelled;
      default:
        // For step level events, retain the current state.
        return current;
    }
  }
}
