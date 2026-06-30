// src/production/knowledge/projection/KnowledgeProjection.ts

import { KnowledgeNode } from "../contracts/KnowledgeNode";
import { KnowledgeEdge } from "../contracts/KnowledgeEdge";

/**
 * The direct output of a Projector.
 * Represents a sub-graph of nodes and edges generated from a single TraceableArtifact.
 */
export interface KnowledgeProjection {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
}
