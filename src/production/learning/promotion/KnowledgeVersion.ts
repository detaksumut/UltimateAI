// src/production/learning/promotion/KnowledgeVersion.ts

/**
 * A Value Object representing the versioning of a knowledge artifact.
 * Useful for Knowledge Evolution (Sprint 8G).
 */
export interface KnowledgeVersion {
  /** E.g., '1.0.0' or 'v2' */
  readonly value: string;
  
  /** When this version was minted */
  readonly createdAt: number;
  
  /** Why this version bump occurred (e.g., 'Refined scope to TypeScript only') */
  readonly reason: string;
}
