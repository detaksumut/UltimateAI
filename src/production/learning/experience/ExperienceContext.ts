// src/production/learning/experience/ExperienceContext.ts

/**
 * The strict contextual boundaries from which this experience was extracted.
 * Ensures the Learning Engine understands the scope of the extracted facts.
 */
export interface ExperienceContext {
  /** The correlation ID linking all related artifacts in the original execution */
  readonly correlationId: string;
  
  /** The specific conversation ID if this experience originated from a user session */
  readonly conversationId?: string;
  
  /** The execution trace if applicable */
  readonly executionId?: string;
}
