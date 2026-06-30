// src/production/knowledge/projection/ProjectorMetadata.ts

import { KnowledgeProjectionType } from "./KnowledgeProjectionType";

/**
 * Observability metadata for an IKnowledgeProjector.
 */
export interface ProjectorMetadata {
  /** The human-readable name of the projector */
  readonly name: string;
  
  /** Semantic version of the projector logic (e.g., "1.0.0") */
  readonly version: string;
  
  /** The specific projection type this projector handles */
  readonly supportedProjection: KnowledgeProjectionType;
}
