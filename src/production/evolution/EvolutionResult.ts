// src/production/evolution/EvolutionResult.ts

import { LearnedKnowledge } from "../learning/promotion/LearnedKnowledge";
import { KnowledgeStatus } from "../learning/promotion/KnowledgeStatus";
import { GraphOperation } from "./GraphOperation";
import { IArtifact, ArtifactIdentity, ArtifactTrace } from "../runtime/contracts/IArtifact";

export interface IEvolutionReport {
  readonly operationsApplied: number;
  readonly statusChanges: number;
  readonly validationWarnings: readonly string[];
  readonly success: boolean;
}

/**
 * The definitive receipt of how the Graph was evolved.
 */
export interface EvolutionResult extends IArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;

  readonly evolutionId: string;
  
  readonly newKnowledge?: LearnedKnowledge;
  readonly operations: readonly GraphOperation[];
  
  readonly report: IEvolutionReport;
  
  readonly timestamp: number;
}
