// src/production/knowledge/projection/KnowledgeProjectionResult.ts

import { KnowledgeProjection } from "./KnowledgeProjection";
import { ProjectionDescriptor } from "./ProjectionDescriptor";

export interface KnowledgeProjectionMetrics {
  readonly durationMs: number;
}

/**
 * The final output of the KnowledgeProjectionLayer for a single artifact.
 */
export interface KnowledgeProjectionResult {
  /** The generated sub-graph */
  readonly projection: KnowledgeProjection;
  
  /** Observability trace */
  readonly descriptor: ProjectionDescriptor;
  
  readonly metrics: KnowledgeProjectionMetrics;
  
  /** Non-fatal validation issues (e.g., orphan node, duplicate edge) */
  readonly warnings: readonly string[];
}
