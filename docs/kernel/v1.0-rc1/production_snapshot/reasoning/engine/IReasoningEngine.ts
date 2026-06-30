// src/production/reasoning/engine/IReasoningEngine.ts

import { ReasoningPrompt } from "../context/ReasoningPrompt";
import { ReasoningPlan } from "../planner/ReasoningPlan";
import { ReasoningConclusion } from "../contracts/ReasoningConclusion";

/**
 * Stage 4: Engine.
 * The AI component that actually performs the cognitive inference.
 * Principle 31: Reasoning Never Creates Knowledge.
 */
export interface IReasoningEngine {
  /**
   * Evaluates the problem within the strict boundaries of the grounded prompt and structural plan.
   */
  reason(prompt: ReasoningPrompt, plan: ReasoningPlan): Promise<ReasoningConclusion>;
}
