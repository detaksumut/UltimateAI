// src/production/learning/promotion/LearnedKnowledge.ts

import { IArtifact, ArtifactIdentity, ArtifactTrace } from "../../runtime/contracts/IArtifact";
import { KnowledgeStatus } from "./KnowledgeStatus";
import { KnowledgeProvenance } from "./KnowledgeProvenance";

/**
 * The base structure for all formalized knowledge artifacts.
 */
export interface ILearningArtifact extends IArtifact {
  readonly title: string;
  readonly summary: string;
  readonly tags: readonly string[];
}

/**
 * The definitive, immutable representation of knowledge acquired by the system.
 */
export interface LearnedKnowledge extends ILearningArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;

  readonly knowledgeId: string;
  readonly version: number;
  
  readonly provenance: KnowledgeProvenance;
  readonly status: KnowledgeStatus;
  
  // E.g. Markdown text, structural JSON, rules
  readonly content: any;
}
