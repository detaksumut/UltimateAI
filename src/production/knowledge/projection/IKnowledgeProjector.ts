// src/production/knowledge/projection/IKnowledgeProjector.ts

import { TraceableArtifact } from "../../intelligence/contracts/TraceableArtifact";
import { KnowledgeProjection } from "./KnowledgeProjection";
import { ProjectionContext } from "./ProjectionContext";
import { ProjectorMetadata } from "./ProjectorMetadata";

/**
 * Interface for all artifact-to-graph translators.
 * Strictly stateless. Does not write to DB, does not cache, does not store state.
 */
export interface IKnowledgeProjector<TArtifact extends TraceableArtifact> {
  
  /** Metadata describing this projector */
  readonly metadata: ProjectorMetadata;
  
  /**
   * Deterministically projects a TraceableArtifact into a Knowledge sub-graph.
   * Dates and IDs must be derived from the artifact, not generated randomly.
   */
  project(artifact: TArtifact, context: ProjectionContext): KnowledgeProjection;
}
