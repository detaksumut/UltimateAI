/**
 * StructuralValidator.ts
 *
 * Checks if all required fields and references exist in the Model.
 */
import { IWorkflowModel } from '../../contracts/IWorkflowModel';

export class StructuralValidator {
  static validate(model: IWorkflowModel): void {
    if (!model.id) throw new Error('Structural Error: Workflow ID is missing.');
    if (!model.trigger || !model.trigger.event) {
      throw new Error('Structural Error: Trigger event is missing.');
    }
    if (!model.states || model.states.length === 0) {
      throw new Error('Structural Error: Workflow must have at least one state.');
    }
    
    // Validate transitions reference existing states
    for (const transition of model.transitions) {
      if (!model.states.includes(transition.from)) {
        throw new Error(`Structural Error: Transition from unknown state '${transition.from}'.`);
      }
      if (!model.states.includes(transition.to)) {
        throw new Error(`Structural Error: Transition to unknown state '${transition.to}'.`);
      }
      if (!transition.action) {
        throw new Error(`Structural Error: Transition from '${transition.from}' to '${transition.to}' is missing an action.`);
      }
    }
  }
}
