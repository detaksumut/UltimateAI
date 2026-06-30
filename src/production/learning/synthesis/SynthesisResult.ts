// src/production/learning/synthesis/SynthesisResult.ts

import { KnowledgeCandidate } from "./KnowledgeCandidate";

/**
 * The output of the KnowledgeSynthesizer.
 */
export interface SynthesisResult {
  readonly candidates: readonly KnowledgeCandidate[];
  readonly warnings: readonly string[];
  readonly durationMs: number;
}
