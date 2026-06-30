// src/production/evolution/EvolutionVersionStrategy.ts

/**
 * Independent versioning strategy specific to the Evolution Runtime.
 */
export enum EvolutionVersionStrategy {
  /** Bump for REINFORCE (e.g., 1.0.0 -> 1.0.1) */
  PATCH = "PATCH",
  
  /** Bump for MERGE or COEXIST expansion (e.g., 1.0.0 -> 1.1.0) */
  MINOR = "MINOR",
  
  /** Bump for REPLACE or SPLIT where backwards compatibility breaks (e.g., 1.0.0 -> 2.0.0) */
  MAJOR = "MAJOR"
}
