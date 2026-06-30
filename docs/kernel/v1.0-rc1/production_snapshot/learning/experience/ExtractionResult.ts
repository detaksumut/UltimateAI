// src/production/learning/experience/ExtractionResult.ts

import { Experience } from "./Experience";

/**
 * The output of the ExperienceExtractor.
 */
export interface ExtractionResult {
  readonly experiences: readonly Experience[];
  readonly warnings: readonly string[];
  readonly durationMs: number;
}
