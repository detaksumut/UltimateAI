// src/production/intelligence/ReflectionEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";
import { ExecutionIntent } from "./ExecutionIntent";
import { CriticRecommendation } from "./critic/CriticRecommendation";
import { ReflectionDecision } from "./reflection/ReflectionDecision";
import { DecisionPolicy } from "./reflection/DecisionPolicy";

/**
 * Interface representing the Decision Governance Engine.
 * Evaluates whether recommendations should be applied based on intent and policy.
 */
export interface ReflectionEngine {
  /**
   * Evaluates a set of recommendations and returns a decision for each.
   */
  evaluateRecommendations(
    context: IntelligenceContext, 
    intent: ExecutionIntent,
    recommendations: readonly CriticRecommendation[],
    policy?: DecisionPolicy
  ): Promise<IntelligenceDecision<readonly ReflectionDecision[]>>;
}
