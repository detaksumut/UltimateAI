/**
 * WorkflowModelGenerator.ts
 *
 * Converts a normalized IIntentModel into a deterministic IWorkflowModel.
 * Does NOT read natural language (Prompt).
 * Acts as the bridge between AI Understanding and Execution Runtime.
 */

import { IIntentModel } from './contracts/IIntentModel';
import { IWorkflowModel, IWorkflowTransition } from '../automation/contracts/IWorkflowModel';

export class WorkflowModelGenerator {
  
  /**
   * Generates a definitive WorkflowModel based on the strict FSM constraints of the Intent.
   * This generator implements rule-based synthesis rather than free-form LLM generation.
   */
  public generate(intent: IIntentModel): IWorkflowModel {
    // 1. Basic mapping
    const id = `wf-${intent.domain}-${Date.now()}`;
    const version = "1.0";
    
    // 2. Synthesize Transitions based on basic heuristics
    // (In a full implementation, this uses a robust path-finding or LLM-guided DAG builder 
    // strictly bounded by the intent's expected states/actions).
    
    const transitions: IWorkflowTransition[] = [];
    const states = intent.expected_states;
    const actions = intent.expected_actions;
    
    // Naive synthesis for Milestone 1: Link states sequentially via actions if possible
    if (states.length >= 2 && actions.length >= 1) {
      // e.g. Pending -> approve -> Approved
      transitions.push({
        from: states[0],
        action: actions[0],
        to: states[1]
      });
      
      // e.g. Pending -> reject -> Rejected (if a 3rd state and 2nd action exist)
      if (states.length >= 3 && actions.length >= 2) {
        transitions.push({
          from: states[0],
          action: actions[1],
          to: states[2]
        });
      }
    }
    
    return {
      id,
      version,
      trigger: { event: intent.trigger_event },
      states: states,
      actions: actions,
      transitions: transitions
    };
  }
}
