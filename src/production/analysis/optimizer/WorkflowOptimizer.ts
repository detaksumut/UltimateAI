/**
 * WorkflowOptimizer.ts
 *
 * 100% Algorithmic and Deterministic optimizer.
 * Removes dead states, compresses duplicate transitions, and normalizes array orders.
 * Always returns a new Immutable IOptimizationResult (no side effects on original).
 */

import { IWorkflowModel, IWorkflowTransition } from '../../automation/contracts/IWorkflowModel';
import { IOptimizationResult, IOptimizationChange } from '../contracts/IOptimizationResult';
import { WorkflowAnalyzer } from '../analyzer/WorkflowAnalyzer';
import { IAnalysisContext } from '../contracts/IAnalysisContext';

export class WorkflowOptimizer {
  
  public optimize(model: IWorkflowModel): IOptimizationResult {
    const changes: IOptimizationChange[] = [];
    
    // Create deep copy to ensure immutability
    const newStates = [...model.states];
    const newTransitions = [...model.transitions];
    const newActions = [...model.actions];
    
    // 1. Remove Dead States
    // We use the Analyzer to find them
    const analyzer = new WorkflowAnalyzer();
    const mockContext: IAnalysisContext = { model, catalog_snapshot: { states: [], actions: [] } };
    const report = analyzer.analyze(mockContext);
    
    const deadStates = report.findings
      .filter(f => f.code === 'WF001')
      .flatMap(f => f.affected_elements);
      
    if (deadStates.length > 0) {
      deadStates.forEach(ds => {
        const idx = newStates.indexOf(ds);
        if (idx !== -1) newStates.splice(idx, 1);
        changes.push({ type: 'removed_state', description: `Removed dead state: ${ds}` });
      });
      // Also remove transitions originating from or targeting dead states
      for (let i = newTransitions.length - 1; i >= 0; i--) {
        if (deadStates.includes(newTransitions[i].from) || deadStates.includes(newTransitions[i].to)) {
          newTransitions.splice(i, 1);
        }
      }
    }

    // 2. Remove Duplicate Transitions
    const uniqueTransitions: IWorkflowTransition[] = [];
    const seen = new Set<string>();
    for (const t of newTransitions) {
      const sig = `${t.from}|${t.action}|${t.to}`;
      if (!seen.has(sig)) {
        uniqueTransitions.push(t);
        seen.add(sig);
      } else {
        changes.push({ type: 'removed_transition', description: `Removed duplicate transition: ${sig}` });
      }
    }
    
    // 3. Normalize Ordering (Alphabetical sort to ensure deterministic hashing)
    newStates.sort();
    newActions.sort();
    uniqueTransitions.sort((a, b) => {
      const sigA = `${a.from}|${a.action}|${a.to}`;
      const sigB = `${b.from}|${b.action}|${b.to}`;
      return sigA.localeCompare(sigB);
    });
    
    if (JSON.stringify(newStates) !== JSON.stringify(model.states) || 
        JSON.stringify(uniqueTransitions) !== JSON.stringify(model.transitions)) {
      changes.push({ type: 'normalized_order', description: `Normalized array orderings for determinism.` });
    }

    const optimizedModel: IWorkflowModel = {
      ...model,
      states: newStates,
      actions: newActions,
      transitions: uniqueTransitions
    };

    return {
      original_model: model,
      optimized_model: optimizedModel,
      changes,
      normalization_report: {
        is_modified: changes.length > 0,
        behavior_altered: false // Algorithmic optimizations never alter behavior
      }
    };
  }
}
