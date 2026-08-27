/**
 * LongestPathMetric.ts
 *
 * Calculates the longest path from the initial state to a terminal state.
 * NOTE: Currently only supports Directed Acyclic Workflows (DAG).
 * Will throw or return -1 if a cycle is detected.
 */

import { IComplexityMetric } from '../IComplexityMetric';
import { IWorkflowModel } from '../../../automation/contracts/IWorkflowModel';

export class LongestPathMetric implements IComplexityMetric {
  name = 'Longest Path';
  description = 'Maximum depth of the graph (DAG only).';
  
  public calculate(model: IWorkflowModel): number {
    if (model.states.length === 0) return 0;
    
    const adj = new Map<string, string[]>();
    for (const s of model.states) adj.set(s, []);
    for (const t of model.transitions) {
      adj.get(t.from)?.push(t.to);
    }
    
    const memo = new Map<string, number>();
    const visited = new Set<string>();
    
    function dfs(node: string): number {
      if (visited.has(node)) {
        // Cycle detected
        return -1;
      }
      if (memo.has(node)) return memo.get(node)!;
      
      visited.add(node);
      
      const neighbors = adj.get(node) || [];
      let maxDepth = 0;
      for (const next of neighbors) {
        const depth = dfs(next);
        if (depth === -1) return -1; // Propagate cycle error
        maxDepth = Math.max(maxDepth, depth);
      }
      
      visited.delete(node);
      
      const result = maxDepth + (neighbors.length > 0 ? 1 : 0);
      memo.set(node, result);
      return result;
    }
    
    return dfs(model.states[0]);
  }
}
