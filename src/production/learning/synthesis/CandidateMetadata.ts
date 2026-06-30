// src/production/learning/synthesis/CandidateMetadata.ts

import { KnowledgeScope } from "./KnowledgeScope";
import { HypothesisStrength } from "./HypothesisStrength";

/**
 * Metadata surrounding a Knowledge Candidate prior to validation.
 */
export interface CandidateMetadata {
  readonly scope: KnowledgeScope;
  readonly strength: HypothesisStrength;
  readonly synthesisVersion: string;
}
