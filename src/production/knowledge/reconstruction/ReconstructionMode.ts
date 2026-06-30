// src/production/knowledge/reconstruction/ReconstructionMode.ts

/**
 * Defines how the Reconstruction Engine will rebuild the graph's state.
 */
export enum ReconstructionMode {
  /** Reconstructs a chronological or semantic progression of snapshots */
  TIMELINE = "TIMELINE",
  
  /** Extracts the semantic rationale and context behind a specific node */
  EXPLAIN = "EXPLAIN",
  
  /** Evaluates two different paths or snapshots side-by-side */
  COMPARE = "COMPARE",
  
  /** Reconstructs the exact state of the graph at a specific anchor point */
  SNAPSHOT = "SNAPSHOT",
  
  /** Simulates a virtual "what if" timeline without altering the actual graph */
  BRANCH = "BRANCH"
}
