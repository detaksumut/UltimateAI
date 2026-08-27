/**
 * DeadStateRule.ts
 *
 * Diagnostic Code: WF001
 * Checks for states that are never reached from the trigger/initial state.
 */

import { IAnalysisRule } from './IAnalysisRule';
import { IAnalysisContext } from '../../contracts/IAnalysisContext';
import { IDiagnosticFinding } from '../../contracts/IAnalysisReport';

export class DeadStateRule implements IAnalysisRule {
  public evaluate(context: IAnalysisContext): IDiagnosticFinding[] {
    const findings: IDiagnosticFinding[] = [];
    const model = context.model;
    
    if (model.states.length === 0) return findings;

    const initialState = model.states[0];
    const visited = new Set<string>();
    
    const adj = new Map<string, string[]>();
    for (const s of model.states) adj.set(s, []);
    for (const t of model.transitions) {
      adj.get(t.from)?.push(t.to);
    }
    
    function dfs(node: string) {
      if (visited.has(node)) return;
      visited.add(node);
      const neighbors = adj.get(node) || [];
      for (const next of neighbors) dfs(next);
    }
    
    dfs(initialState);
    
    for (const state of model.states) {
      if (!visited.has(state)) {
        findings.push({
          code: 'WF001',
          severity: 'error',
          message: `State '${state}' is an unreachable Dead State.`,
          affected_elements: [state]
        });
      }
    }
    
    return findings;
  }
}
