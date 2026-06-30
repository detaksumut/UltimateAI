// src/production/knowledge/reconstruction/KnowledgeSnapshot.ts

import { KnowledgeAnchor } from "../navigation/KnowledgeAnchor";
import { KnowledgeNode } from "../contracts/KnowledgeNode";
import { KnowledgeEdge } from "../contracts/KnowledgeEdge";

/**
 * A deterministic representation of the Knowledge Graph's state at a specific point.
 * This artifact is the primary input for the Learning Engine.
 */
export interface KnowledgeSnapshot {
  /** Unique identity of this exact snapshot */
  readonly snapshotId: string;
  
  /** The anchor from which this snapshot was reconstructed */
  readonly anchor: KnowledgeAnchor;
  
  /** Identifies the Reconstruction Engine instance/version that built this */
  readonly createdFrom: string;
  
  /** Logical version of the graph when this snapshot was taken */
  readonly graphVersion: string;

  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
