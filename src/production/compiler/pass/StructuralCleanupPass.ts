/**
 * StructuralCleanupPass.ts
 *
 * Uses the Optimizer to remove dead states and duplicate transitions.
 */

import { ICompilerPass } from './ICompilerPass';
import { ICompilationContext } from '../contracts/ICompilationContext';
import { WorkflowOptimizer } from '../../analysis/optimizer/WorkflowOptimizer';

export class StructuralCleanupPass implements ICompilerPass {
  public readonly name = 'StructuralCleanupPass';
  
  public execute(context: ICompilationContext): void {
    if (context.diagnostics.status === 'FAIL') return;
    
    const optimizer = new WorkflowOptimizer();
    const result = optimizer.optimize(context.workflow_model);
    
    context.optimization_result = result;
    context.workflow_model = result.optimized_model; // Pass the optimized model forward
    context.diagnostics.messages.push('StructuralCleanupPass completed successfully.');
  }
}
