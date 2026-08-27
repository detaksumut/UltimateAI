/**
 * WorkflowValidator.ts
 *
 * Facade combining structural and semantic validations.
 */
import { IWorkflowModel } from '../../contracts/IWorkflowModel';
import { StructuralValidator } from './StructuralValidator';
import { SemanticValidator } from './SemanticValidator';

export class WorkflowValidator {
  static validate(model: IWorkflowModel): void {
    StructuralValidator.validate(model);
    SemanticValidator.validate(model);
  }
}
