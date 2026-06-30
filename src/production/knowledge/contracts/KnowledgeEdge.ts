import { KnowledgeRelationType } from "./KnowledgeRelationType";
import { KnowledgeMetadata } from "./KnowledgeMetadata";

/**
 * An immutable edge linking two Knowledge Nodes.
 * A first-class object that holds semantic meaning, directionality, and confidence.
 */
export interface KnowledgeEdge {
  /** Unique identifier for the edge */
  readonly id: string;
  
  /** The exact relation type (Structural or Semantic) */
  readonly relationType: KnowledgeRelationType;
  
  /** The origin Node's identity.id */
  readonly sourceNodeId: string;
  
  /** The destination Node's identity.id */
  readonly targetNodeId: string;
  
  /** The confidence of this relationship (e.g., Deterministic=1.0, LLM-Inferred=0.95) */
  readonly confidence: number;
  
  /** Optional metadata (e.g., edge rationale) */
  readonly metadata?: KnowledgeMetadata;
  
  /** Timestamp when this relationship was formed */
  readonly createdAt: number;
}
