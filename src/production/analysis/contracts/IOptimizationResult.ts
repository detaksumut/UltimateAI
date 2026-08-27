/**
 * IOptimizationResult.ts
 *
 * Immutable result of the Optimizer.
 * Includes the pristine original, the modified new model, and a detailed change set.
 */

import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';

export interface IOptimizationChange {
  readonly type: 'removed_state' | 'removed_transition' | 'normalized_order' | 'merged_state';
  readonly description: string;
}

export interface IOptimizationResult {
  readonly original_model: IWorkflowModel;
  readonly optimized_model: IWorkflowModel;
  readonly changes: IOptimizationChange[];
  
  readonly normalization_report: {
    readonly is_modified: boolean;
    readonly behavior_altered: boolean; // MUST ALWAYS BE FALSE
  };
}
