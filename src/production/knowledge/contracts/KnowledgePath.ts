import { KnowledgeNode } from "./KnowledgeNode";
import { KnowledgeEdge } from "./KnowledgeEdge";
import { KnowledgeRelationType } from "./KnowledgeRelationType";

/**
 * Represents a sequential traversal of decisions within the Knowledge Graph.
 * Useful for Replay, Explainability, or Learning Engine traces.
 * 
 * Entirely immutable and treated as a first-class citizen for Learning/Analytics.
 */
export interface KnowledgePath {
  /** The ordered sequence of nodes along the path */
  readonly nodes: readonly KnowledgeNode[];
  
  /** The ordered sequence of edges connecting the nodes */
  readonly edges: readonly KnowledgeEdge[];
  
  /** The ordered sequence of relationship types traversed in this path */
  readonly relationTypes: readonly KnowledgeRelationType[];

  /** The distance from the start node (e.g., number of edges) */
  readonly depth: number;

  /** An optional score for the path, useful for Learning Engine prioritization */
  readonly score?: number;

  /** Algorithmic cost or weight of traversing this path */
  readonly cost?: number;
}
