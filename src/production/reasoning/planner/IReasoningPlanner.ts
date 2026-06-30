// src/production/reasoning/planner/IReasoningPlanner.ts

import { ReasoningPrompt } from "../context/ReasoningPrompt";
import { ReasoningPlan } from "./ReasoningPlan";

/**
 * Stage 3: Planning.
 * Ensures the reasoning process follows a structured path (e.g. Chain of Thought).
 * Permanent stage.
 */
export interface IReasoningPlanner {
  plan(prompt: ReasoningPrompt): Promise<ReasoningPlan>;
}
