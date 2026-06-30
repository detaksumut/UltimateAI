// src/production/intelligence/IntelligenceContext.ts

/**
 * The unified context object passed through the entire Intelligence Pipeline.
 * It contains all the necessary state and history for the engines to make informed decisions.
 */
export interface IntelligenceContext {
  /** The unique identifier for this intelligence cycle */
  readonly cycleId: string;
  
  /** The raw request or goal provided by the user */
  readonly userRequest: string;
  
  /** The system's current high-level goals */
  readonly goals: readonly string[];
  
  /** Any existing blueprint or architectural design */
  readonly blueprint?: unknown;
  
  /** History of previous decisions made in this cycle or session */
  readonly decisionHistory: readonly unknown[];
  
  /** Runtime options influencing intelligence (e.g., creativity vs strictness) */
  readonly runtimeOptions?: Record<string, unknown>;
}
