// src/production/reasoning/contracts/ReasoningConclusion.ts

import { IArtifact, ArtifactIdentity, ArtifactTrace } from "../../runtime/contracts/IArtifact";

export enum ReasoningConfidence {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  UNKNOWN = "UNKNOWN"
}

/**
 * The final, formal advisory output of the Reasoning Runtime.
 * Completely immutable and auditable.
 */
export interface ReasoningConclusion extends IArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;

  readonly conclusionId: string;
  
  /** The definitive answer or recommendation */
  readonly text: string;
  
  readonly confidence: ReasoningConfidence;
  
  /** Alternative approaches considered but rejected */
  readonly alternativeApproaches: readonly string[];
  
  /** The IDs of the Knowledge used to reach this conclusion */
  readonly usedKnowledgeIds: readonly string[];
  
  /** The IDs of the Graph Relations used */
  readonly usedRelationIds: readonly string[];
}
