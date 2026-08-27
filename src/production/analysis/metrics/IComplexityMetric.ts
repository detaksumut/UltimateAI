/**
 * IComplexityMetric.ts
 *
 * Provider interface for calculating a specific complexity metric.
 */

import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';

export interface IComplexityMetric {
  readonly name: string;
  readonly description: string;
  calculate(model: IWorkflowModel): number;
}
