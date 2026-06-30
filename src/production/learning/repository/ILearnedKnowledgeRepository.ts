// src/production/learning/repository/ILearnedKnowledgeRepository.ts

import { LearnedKnowledge } from "../promotion/LearnedKnowledge";

/**
 * Principle 17: Repository Is Passive.
 * The repository does NOT validate, does NOT promote, and does NOT think.
 * It strictly handles persistence and retrieval of final LearnedKnowledge artifacts.
 */
export interface ILearnedKnowledgeRepository {
  /**
   * Persists a promoted piece of knowledge.
   */
  save(knowledge: LearnedKnowledge): Promise<void>;
  
  /**
   * Retrieves knowledge by its unique ID.
   */
  findById(id: string): Promise<LearnedKnowledge | null>;
  
  /**
   * Archives or supersedes a piece of knowledge, rendering it inactive.
   */
  archive(id: string): Promise<void>;
  
  /**
   * Finds all active knowledge relevant to a specific scope.
   */
  findActiveByScope(scope: string): Promise<readonly LearnedKnowledge[]>;
}
