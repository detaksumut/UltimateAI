/**
 * IIntentModel.ts
 *
 * Defines the normalized representation of a User's intent.
 * This is the output of the Requirement Interpreter (AI Understanding layer),
 * and the sole input to the WorkflowModelGenerator (Generation layer).
 */

export interface IIntentModel {
  readonly intent_id: string;
  readonly domain: string;
  readonly trigger_event: string; // Must correspond to an event in catalog
  
  readonly expected_states: string[];
  readonly expected_actions: string[];
  
  readonly constraints: {
    readonly must_reach_terminal: boolean;
    readonly require_human_approval?: boolean;
    readonly timeout_seconds?: number;
  };
}
