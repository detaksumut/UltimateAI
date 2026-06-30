// src/production/intelligence/PlanningEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";
import { ExecutionIntent } from "./ExecutionIntent";
import { Execution } from "../kernel/execution/Execution";

/**
 * Interface representing the translation of reasoning into concrete,
 * executable DAGs (Execution model).
 */
export interface PlanningEngine {
  /**
   * Generates a concrete Execution DAG based on the reasoning decision.
   * Returns a decision payload containing the Execution object.
   */
  generateExecutionPlan(
    context: IntelligenceContext, 
    reasoningDecision: IntelligenceDecision<ExecutionIntent>
  ): Promise<IntelligenceDecision<Execution>>;
}
