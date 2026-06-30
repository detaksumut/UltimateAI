// src/production/learning/contracts/ILearningArtifact.ts

import { ExperienceContext } from "../experience/ExperienceContext";
import { ExperienceMetadata } from "../experience/ExperienceMetadata";

/**
 * The foundational contract for all artifacts flowing through the Learning Runtime.
 * Ensures consistent traceability, auditing, and versioning across the entire pipeline.
 */
export interface ILearningArtifact {
  /** Globally unique, immutable identity of this specific artifact */
  readonly id: string;
  
  /** 
   * Schema version for future-proofing.
   * Allows the engine to read artifacts generated years ago.
   */
  readonly schemaVersion: string;
  
  /** The exact timestamp when this artifact was created */
  readonly createdAt: Date;
  
  /** The identity of the direct ancestor artifact (e.g., ExperienceID -> PatternID) */
  readonly sourceId: string;
  
  /** Operational context inherited from the original experience */
  readonly context: ExperienceContext;
  
  /** Diagnostics and environmental tracing metadata */
  readonly metadata: ExperienceMetadata;
}
