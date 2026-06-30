// src/production/reasoning/context/ReasoningPrompt.ts

import { IReasoningContext } from "../contracts/IReasoningContext";

/**
 * The deterministically built prompt structure that will be fed to the AI Engine.
 * Principle 32: Context Before Intelligence.
 * Treated as a Value Object, not just a string, so it can be deterministically tested.
 */
export interface ReasoningPrompt {
  readonly problem: string;
  readonly context: string;
  readonly constraints: readonly string[];
  
  /** The explicitly permitted knowledge facts that the AI must use */
  readonly availableKnowledge: readonly any[];
  
  readonly instructions: readonly string[];
}
