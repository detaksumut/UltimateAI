// src/production/knowledge/contracts/KnowledgeIdentity.ts

import { KnowledgeNodeType } from "./KnowledgeNodeType";

/**
 * Unique identity of a KnowledgeNode in the Knowledge Graph.
 */
export interface KnowledgeIdentity {
  readonly id: string;
  readonly nodeType: KnowledgeNodeType;
  readonly version: number;
  readonly createdAt: number;
  
  /** The overarching correlation trace bridging the entire session/flow */
  readonly correlationId: string;
}
