// src/production/learning/experience/IExperienceExtractor.ts

import { ReconstructionResult } from "../../knowledge/reconstruction/ReconstructionResult";
import { Experience } from "./Experience";

import { ExtractionResult } from "./ExtractionResult";

/**
 * Deterministically translates a ReconstructionResult (Snapshot, Timeline, or Path)
 * into raw, immutable Experiences.
 * MUST NOT employ AI or heuristical guessing.
 */
export interface IExperienceExtractor {
  extract(reconstruction: ReconstructionResult): Promise<ExtractionResult>;
}
