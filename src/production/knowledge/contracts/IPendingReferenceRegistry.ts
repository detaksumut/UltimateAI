import { KnowledgeEdge } from "./KnowledgeEdge.js";

/**
 * IPendingReferenceRegistry — Contract for deferred edge storage.
 *
 * When an edge references a target node that has not yet been ingested,
 * it is registered here. Once the target node arrives, the edges are
 * retrieved and promoted to the knowledge store.
 *
 * Domain code depends on this interface.
 * The concrete implementation lives in the ingestion layer and is
 * wired through the composition root.
 */
export interface IPendingReferenceRegistry {
  /** Register an edge whose target node does not yet exist. */
  register(edge: KnowledgeEdge): void;

  /** Retrieve and remove all pending edges for the given target node. */
  getAndClear(targetNodeId: string): KnowledgeEdge[];

  /** Return the total number of pending edges across all targets. */
  getPendingCount(): number;
}
