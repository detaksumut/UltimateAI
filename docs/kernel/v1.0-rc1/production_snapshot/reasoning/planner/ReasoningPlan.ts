// src/production/reasoning/planner/ReasoningPlan.ts

/**
 * The structural plan for how the AI should approach the reasoning problem.
 */
export interface ReasoningPlan {
  readonly planId: string;
  readonly goal: string;
  
  /** Logical steps the Engine must traverse */
  readonly steps: readonly string[];
  
  /** Dependencies between steps or external states */
  readonly dependencies: readonly string[];
  
  /** Criteria that must be met for this reasoning plan to be considered successful */
  readonly successCriteria: readonly string[];
  
  /** The expected output format (e.g. JSON, Markdown, Step-by-Step) */
  readonly expectedFormat: string;
}
