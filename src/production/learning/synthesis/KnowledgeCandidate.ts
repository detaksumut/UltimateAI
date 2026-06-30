// src/production/learning/synthesis/KnowledgeCandidate.ts

import { ILearningArtifact } from "../contracts/ILearningArtifact";
import { KnowledgeHypothesis } from "./KnowledgeHypothesis";
import { CandidateMetadata } from "./CandidateMetadata";

import { CandidateStatus } from "./CandidateStatus";

/**
 * The final output of Knowledge Synthesis, ready for Validation.
 * Represents a hypothesis formed from clustered patterns, but NOT yet accepted as Knowledge.
 */
export interface KnowledgeCandidate extends ILearningArtifact {
  readonly status: CandidateStatus;
  
  /** Full trace identifiers */
  readonly clusterId: string;
  readonly hypothesisId: string;
  readonly patternIds: readonly string[];
  readonly experienceIds: readonly string[];

  /** The core hypothesis being proposed */
  readonly hypothesis: KnowledgeHypothesis;
  
  /** Metadata regarding scope, strength, etc. */
  readonly synthesisMetadata: CandidateMetadata;
}
