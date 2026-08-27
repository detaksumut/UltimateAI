/**
 * TransitionDensityMetric.ts
 *
 * Calculates ratio of transitions to states.
 */

import { IComplexityMetric } from '../IComplexityMetric';
import { IWorkflowModel } from '../../../automation/contracts/IWorkflowModel';

export class TransitionDensityMetric implements IComplexityMetric {
  name = 'Transition Density';
  description = 'Average number of transitions per state.';
  
  public calculate(model: IWorkflowModel): number {
    if (model.states.length === 0) return 0;
    return model.transitions.length / model.states.length;
  }
}
