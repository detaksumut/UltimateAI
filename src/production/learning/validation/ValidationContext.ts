// src/production/learning/validation/ValidationContext.ts

import { ValidationPolicy } from "./ValidationPolicy";

/**
 * The execution context provided to every rule.
 * Prevents rules from making independent external queries.
 */
export interface ValidationContext {
  /** The configuration thresholds to apply */
  readonly policy: ValidationPolicy;
  
  /** Current system time, for deterministic recency evaluation */
  readonly currentTimeMs: number;
  
  // Later we can add readonly interfaces to query existing knowledge repository if needed
  // readonly knowledgeRepository: IReadOnlyKnowledgeRepository;
}
