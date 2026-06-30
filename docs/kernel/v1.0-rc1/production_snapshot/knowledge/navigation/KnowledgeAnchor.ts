// src/production/knowledge/navigation/KnowledgeAnchor.ts

/**
 * An explicit starting point for graph navigation.
 * Prevents arbitrary string lookups and guarantees consistent entry into the Graph.
 */
export interface KnowledgeAnchor {
  readonly nodeId: string;
  readonly correlationId: string;
  readonly artifactId: string;
}
