// src/production/intelligence/LearningEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";

/**
 * Interface for extracting patterns from successful or failed executions.
 * The extracted knowledge is persisted to a Memory layer, ensuring that
 * LearningEngine does not mutate the immutable Kernel or SDK contracts.
 */
export interface LearningEngine {
  /**
   * Extracts learnings from a set of evaluations or history, producing
   * a knowledge payload to be stored in Memory.
   */
  extractLearnings(
    context: IntelligenceContext, 
    evaluations: readonly IntelligenceDecision[]
  ): Promise<IntelligenceDecision>;
}
