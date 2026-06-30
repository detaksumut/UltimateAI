// src/production/evolution/KnowledgeGraphRelation.ts

/**
 * Principle 23: Relationships Are First-Class Citizens.
 * Defines the semantic edge between two knowledge artifacts in the graph.
 * Fully immutable. If relations change, new ones are created and old ones archived.
 */
export interface KnowledgeGraphRelation {
  readonly id: string;
  readonly fromKnowledgeId: string;
  readonly toKnowledgeId: string;
  readonly relationType: "SUPERSEDES" | "REINFORCES" | "EVOLVED_FROM" | "MERGED_FROM" | "SPLIT_FROM" | "CONFLICTS_WITH";
  readonly createdAt: number;
  readonly metadata?: Record<string, any>;
}
