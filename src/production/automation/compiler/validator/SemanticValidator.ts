/**
 * SemanticValidator.ts
 *
 * Checks logical integrity: unreachable states, orphan states, terminal state reachability.
 */
import { IWorkflowModel } from '../../contracts/IWorkflowModel';

export class SemanticValidator {
  static validate(model: IWorkflowModel): void {
    const states = new Set(model.states);
    
    // 1. Find terminal states (states that have no outgoing transitions)
    const outgoingStates = new Set(model.transitions.map(t => t.from));
    const terminalStates = model.states.filter(s => !outgoingStates.has(s));
    
    if (terminalStates.length === 0) {
      throw new Error('Semantic Error: Workflow has no terminal state (infinite loop possible).');
    }

    // 2. Build adjacency list for reachability
    const adj = new Map<string, string[]>();
    for (const s of model.states) adj.set(s, []);
    for (const t of model.transitions) {
      adj.get(t.from)?.push(t.to);
    }

    // 3. Ensure a terminal state can be reached from the initial state
    // We assume the first state defined is the initial state
    const initialState = model.states[0];
    const visited = new Set<string>();
    
    function dfs(node: string) {
      if (visited.has(node)) return;
      visited.add(node);
      const neighbors = adj.get(node) || [];
      for (const next of neighbors) {
        dfs(next);
      }
    }
    
    dfs(initialState);
    
    let terminalReachable = false;
    for (const ts of terminalStates) {
      if (visited.has(ts)) {
        terminalReachable = true;
        break;
      }
    }
    
    if (!terminalReachable) {
      throw new Error(`Semantic Error: Terminal state cannot be reached from initial state '${initialState}'.`);
    }

    // 4. Orphan state check (optional, but good for completeness)
    for (const s of model.states) {
      if (s !== initialState && !visited.has(s)) {
        throw new Error(`Semantic Error: State '${s}' is an orphan (unreachable from initial state).`);
      }
    }
  }
}
