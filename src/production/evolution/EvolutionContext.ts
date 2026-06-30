// src/production/evolution/EvolutionContext.ts

import { LearnedKnowledge } from "../learning/promotion/LearnedKnowledge";
import { ILearnedKnowledgeRepository } from "../learning/repository/ILearnedKnowledgeRepository";

/**
 * The execution context passed through all stages of the Evolution Runtime.
 */
export interface EvolutionContext {
  readonly pipelineId: string;
  readonly startedAt: number;
  
  readonly newKnowledge: LearnedKnowledge;
  readonly existingKnowledge: readonly LearnedKnowledge[];
  
  readonly repository: ILearnedKnowledgeRepository;
  
  /** General policy configurations for the evolution run */
  readonly policy: Record<string, any>;
  
  /** Access to the knowledge graph service (mocked as any for now) */
  readonly graph: any; 
}
