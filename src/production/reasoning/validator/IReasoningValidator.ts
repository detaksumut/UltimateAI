// src/production/reasoning/validator/IReasoningValidator.ts

import { ReasoningConclusion } from "../contracts/ReasoningConclusion";
import { KnowledgeBundle } from "../retrieval/KnowledgeBundle";

export interface ReasoningValidationReport {
  readonly isValid: boolean;
  readonly warnings: readonly string[];
}

/**
 * Stage 5: Validation.
 * Deterministic grounding validator.
 * Ensures the AI did not hallucinate facts outside the provided KnowledgeBundle.
 */
export interface IReasoningValidator {
  /**
   * Cross-references the conclusion against the original knowledge bundle.
   */
  validateGrounding(conclusion: ReasoningConclusion, bundle: KnowledgeBundle): Promise<ReasoningValidationReport>;
}
