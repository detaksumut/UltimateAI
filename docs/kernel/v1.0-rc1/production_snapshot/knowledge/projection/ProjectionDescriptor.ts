// src/production/knowledge/projection/ProjectionDescriptor.ts

import { KnowledgeProjectionType } from "./KnowledgeProjectionType";

/**
 * Identity trace for the projection process itself.
 */
export interface ProjectionDescriptor {
  readonly projectionType: KnowledgeProjectionType;
  readonly artifactType: string;
  readonly projectorVersion: string;
}
