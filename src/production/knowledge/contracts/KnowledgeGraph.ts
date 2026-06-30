// src/production/knowledge/contracts/KnowledgeGraph.ts

import { KnowledgeNode } from "./KnowledgeNode";
import { KnowledgeEdge } from "./KnowledgeEdge";

/**
 * The core domain model of the Knowledge Runtime.
 * Strictly an append-only, immutable structure containing Nodes and Edges.
 * Contains no logic for storage, mutation, or querying.
 */
export interface KnowledgeGraph {
  /** A read-only snapshot of nodes, mapped by their nodeId */
  readonly nodes: ReadonlyMap<string, KnowledgeNode>;
  
  /** A read-only snapshot of edges, mapped by their edge id */
  readonly edges: ReadonlyMap<string, KnowledgeEdge>;
}
