// src/production/knowledge/contracts/KnowledgeMetadata.ts

/**
 * Extensible metadata payload attached to Knowledge Nodes and Edges.
 * Designed to hold contextual information for the Learning Engine without tying 
 * the graph to specific implementation details.
 */
export interface KnowledgeMetadata {
  readonly creatorCapability?: string;
  readonly traceId?: string;
  /** Array of semantic labels (e.g., ["HighLatency", "CriticalPath"]) */
  readonly labels?: readonly string[];
  
  /** Key-value tags for fast indexing (e.g., { "environment": "production" }) */
  readonly tags?: ReadonlyMap<string, string>;
  
  /** Additional custom attributes or metrics */
  readonly attributes?: Record<string, unknown>;
}
