/**
 * NativeWorkflowEngine.ts
 *
 * A minimal Native Runtime for Phase Omega.
 * Executes transitions on a WorkflowInstance based on the immutable WorkflowModel.
 */
import { IWorkflowModel } from '../../contracts/IWorkflowModel';
import { IWorkflowInstance } from '../../contracts/IWorkflowInstance';
import { IWorkflowExecutionContext } from '../../contracts/IWorkflowExecutionContext';
import { IAuditEvent } from '../../contracts/IAuditEvent';

export class NativeWorkflowEngine {
  private model: IWorkflowModel;
  
  constructor(model: IWorkflowModel) {
    this.model = model;
  }
  
  /**
   * Instantiates a new workflow instance from the model.
   * Assumes the first state is the initial state.
   */
  public createInstance(instanceId: string): IWorkflowInstance {
    const initialState = this.model.states[0];
    const now = new Date().toISOString();
    return {
      instance_id: instanceId,
      workflow_id: this.model.id,
      workflow_version: this.model.version,
      current_state: initialState,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Executes an action on the given context, mutating the instance and returning an AuditEvent.
   */
  public executeAction(context: IWorkflowExecutionContext, action: string): IAuditEvent {
    const instance = context.instance;
    const currentState = instance.current_state;
    
    // 1. Find valid transition
    const validTransition = this.model.transitions.find(
      t => t.from === currentState && t.action === action
    );
    
    if (!validTransition) {
      throw new Error(`Execution Error: No transition found for action '${action}' from state '${currentState}'.`);
    }
    
    // 2. Perform state transition (Mutate Instance ONLY)
    instance.current_state = validTransition.to;
    instance.updated_at = new Date().toISOString();
    
    // 3. Produce Immutable AuditEvent
    return {
      event_id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflow_instance_id: instance.instance_id,
      who: context.actor,
      when: instance.updated_at,
      action: action,
      what: {
        from_state: currentState,
        to_state: validTransition.to
      },
      correlation_id: context.correlation_id
    };
  }
}
