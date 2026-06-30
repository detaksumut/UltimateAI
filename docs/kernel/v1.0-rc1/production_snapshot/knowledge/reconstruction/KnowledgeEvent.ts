// src/production/knowledge/reconstruction/KnowledgeEvent.ts

import { KnowledgeRelationType } from "../contracts/KnowledgeRelationType";

/**
 * A semantic event that occurred within the Knowledge Graph.
 * More expressive than a raw string, allowing for Explainability rendering.
 */
export interface KnowledgeEvent {
  readonly eventId: string;
  readonly relationType: KnowledgeRelationType;
  readonly nodeId: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
