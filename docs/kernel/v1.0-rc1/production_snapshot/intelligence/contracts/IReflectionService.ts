// src/production/intelligence/contracts/IReflectionService.ts

import { ExecutionIntent } from "../ExecutionIntent";
import { CriticRecommendation } from "../critic/CriticRecommendation";
import { DecisionPolicy } from "../reflection/DecisionPolicy";

/**
 * Evaluates trade-offs and priorities.
 */
export interface TradeOffAnalysis {
  readonly action: "ACCEPT" | "REJECT" | "MODIFIED" | "DEFER";
  readonly confidence: number;
  readonly rationale: string;
  readonly revisedRecommendation?: CriticRecommendation;
}

/**
 * Abstraction for AI reflection capabilities.
 * It is used to perform deep trade-off analysis between a proposed architectural
 * change (CriticRecommendation) and the user's explicit goals (ExecutionIntent).
 */
export interface IReflectionService {
  /**
   * Analyzes a recommendation against the execution intent, utilizing the given policy.
   */
  evaluateTradeOffs(
    intent: ExecutionIntent,
    recommendation: CriticRecommendation,
    policy: DecisionPolicy
  ): Promise<TradeOffAnalysis>;
}
