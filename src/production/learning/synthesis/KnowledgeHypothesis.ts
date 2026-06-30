// src/production/learning/synthesis/KnowledgeHypothesis.ts

import { HypothesisStrength } from "./HypothesisStrength";
import { KnowledgeScope } from "./KnowledgeScope";

/**
 * The core postulate synthesized from a PatternCluster.
 * Represents what the AI *thinks* is the truth, before validation proves it.
 */
export interface KnowledgeHypothesis {
  readonly id: string;
  readonly clusterId: string;
  
  /** The high-level summary of the postulate */
  readonly summary: string;
  
  /** AI's detailed argument for why this hypothesis holds true */
  readonly hypothesis: string;
  
  /** Explicit assumptions made by the AI during synthesis */
  readonly assumptions: readonly string[];
  
  /** Known limitations or boundaries of this hypothesis */
  readonly limitations: readonly string[];
  
  /** Semantic references to evidence that supports this hypothesis */
  readonly supportingEvidence: readonly string[];
  
  /** The qualitative strength of the hypothesis */
  readonly strength: HypothesisStrength;
  
  /** The recommended scope of applicability */
  readonly recommendedScope: KnowledgeScope;
}
