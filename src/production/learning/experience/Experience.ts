import { ILearningArtifact } from "../contracts/ILearningArtifact";
import { ExperienceOutcome } from "./ExperienceOutcome";

/**
 * The fundamental, immutable unit of learning.
 * Represents a single, factual historical event or sequence translated from Knowledge Reconstruction.
 * Contains NO AI reasoning, hypotheses, or synthesized patterns. It is purely deterministic.
 */
export interface Experience extends ILearningArtifact {
  /** The objective result of the historical event */
  readonly outcome: ExperienceOutcome;
  
  /** 
   * Extracted raw facts from the knowledge graph traversal.
   * These remain 100% raw and uninterpreted to avoid AI bias at extraction.
   */
  readonly facts: readonly string[];
}
