// src/production/evolution/DiscoveryResult.ts

import { LearnedKnowledge } from "../learning/promotion/LearnedKnowledge";

/**
 * The output of the KnowledgeDiscovery stage.
 */
export interface DiscoveryResult {
  readonly knowledge: readonly LearnedKnowledge[];
  readonly searchTimeMs: number;
  readonly coverageScore: number;
  readonly warnings: readonly string[];
}
