// src/production/learning/experience/ExperienceMetadata.ts

/**
 * Additional contextual data attached to an Experience.
 * Preserves the ability to trace the experience back to specific system states or environment conditions.
 */
export interface ExperienceMetadata {
  /** The version of the learning engine at the time of extraction */
  readonly engineVersion: string;
  
  /** Any other dynamic metadata captured during extraction */
  readonly attributes?: Record<string, unknown>;
}
