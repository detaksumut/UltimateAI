// src/production/intelligence/reflection/DecisionPolicy.ts

/**
 * Defines the risk tolerance and conservativeness of the Reflection Engine.
 * This determines how readily recommendations from the Critic are accepted.
 */
export enum DecisionPolicy {
  /** 
   * Only accepts recommendations with very high confidence.
   * Defaults to rejecting/keeping the original plan if unsure.
   */
  CONSERVATIVE = "CONSERVATIVE",
  
  /** 
   * A balanced approach, accepting most beneficial recommendations
   * unless they explicitly conflict with user priorities.
   */
  BALANCED = "BALANCED",
  
  /** 
   * Willingly accepts aggressive architectural changes if they promise
   * better overall scores, even with lower confidence.
   */
  AGGRESSIVE = "AGGRESSIVE"
}
