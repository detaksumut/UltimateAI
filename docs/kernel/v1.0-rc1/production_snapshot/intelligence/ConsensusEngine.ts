// src/production/intelligence/ConsensusEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";
import { ProviderResponse } from "../providers/contracts/ProviderResponse";

/**
 * Interface for evaluating multiple candidate outputs and synthesizing
 * or selecting the best one.
 * Notice it operates on normalized ProviderResponse, keeping it vendor-agnostic.
 */
export interface ConsensusEngine {
  /**
   * Evaluates multiple candidates and returns a decision containing the
   * winning response or a newly synthesized response.
   */
  reachConsensus(
    context: IntelligenceContext, 
    candidates: readonly ProviderResponse[]
  ): Promise<IntelligenceDecision<ProviderResponse>>;
}
