// src/production/evolution/EvolutionDecision.ts

/**
 * Represents the AI's proposed or Validator's confirmed decision for how 
 * new knowledge interacts with existing knowledge.
 */
export enum EvolutionDecision {
  /** The new knowledge confirms and strengthens the existing knowledge */
  REINFORCE = "REINFORCE",
  
  /** The new knowledge outright replaces the existing knowledge (e.g., bug fix, paradigm shift) */
  REPLACE = "REPLACE",
  
  /** The new knowledge and existing knowledge are combined into a broader hypothesis */
  MERGE = "MERGE",
  
  /** The existing knowledge is split into more granular pieces based on the new knowledge */
  SPLIT = "SPLIT",
  
  /** The new knowledge proves the existing knowledge is obsolete or incorrect */
  DEPRECATE = "DEPRECATE",
  
  /** The new knowledge is identical to the existing knowledge; no evolution needed */
  NO_CHANGE = "NO_CHANGE",
  
  /** The new knowledge is valid and domain-specific, co-existing peacefully with the existing knowledge */
  COEXIST = "COEXIST"
}
