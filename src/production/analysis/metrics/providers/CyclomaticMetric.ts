/**
 * CyclomaticMetric.ts
 *
 * Calculates Cyclomatic Complexity (v(G) = E - N + 2P).
 * Where E = edges (transitions), N = nodes (states), P = connected components (typically 1).
 */

import { IComplexityMetric } from './IComplexityMetric';
import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';

export class CyclomaticMetric implements IComplexityMetric {
  name = 'Cyclomatic Complexity';
  description = 'Measures the number of linearly independent paths.';
  
  public calculate(model: IWorkflowModel): number {
    const e = model.transitions.length;
    const n = model.states.length;
    const p = 1; // Assuming a single workflow graph
    return e - n + 2 * p;
  }
}
