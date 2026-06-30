// src/production/knowledge/reconstruction/ReconstructionPolicy.ts

/**
 * Governs the behavior of the Reconstruction Engine.
 * Allows configuration of how deep or wide a reconstruction should go
 * without changing the engine's internal logic.
 */
export interface ReconstructionPolicy {
  readonly maxSnapshots?: number;
  readonly includeVersions?: boolean;
  readonly includeMetadata?: boolean;
  readonly includeBranches?: boolean;
  
  /** Whether the resulting timeline must strictly preserve semantic chronological ordering */
  readonly preserveOrdering?: boolean;
}
