/**
 * ComplexityEngine.ts
 *
 * Orchestrator that applies all registered metric providers.
 */

import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';
import { IComplexityMetric } from './IComplexityMetric';
import { CyclomaticMetric } from './providers/CyclomaticMetric';
import { TransitionDensityMetric } from './providers/TransitionDensityMetric';
import { LongestPathMetric } from './providers/LongestPathMetric';

export class ComplexityEngine {
  private providers: IComplexityMetric[];
  
  constructor(additionalProviders: IComplexityMetric[] = []) {
    this.providers = [
      new CyclomaticMetric(),
      new TransitionDensityMetric(),
      new LongestPathMetric(),
      ...additionalProviders
    ];
  }
  
  public calculateAll(model: IWorkflowModel): Record<string, number> {
    const results: Record<string, number> = {};
    for (const p of this.providers) {
      results[p.name] = p.calculate(model);
    }
    return results;
  }
}
