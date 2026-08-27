/**
 * IIntentModel.ts
 *
 * Defines the normalized representation of a User's intent.
 * Moved to its own Bounded Context (Intent Domain) per EAEP v1.0 specifications.
 */

export interface IIntentModel {
  readonly intent_id: string;
  readonly domain: string;
  readonly trigger_event: string; 
  
  readonly expected_states: string[];
  readonly expected_actions: string[];
  
  readonly constraints: {
    readonly must_reach_terminal: boolean;
    readonly require_human_approval?: boolean;
    readonly timeout_seconds?: number;
  };
}
