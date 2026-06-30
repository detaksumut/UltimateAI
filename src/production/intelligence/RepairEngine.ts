// src/production/intelligence/RepairEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";
import { Execution } from "../kernel/execution/Execution";
import { ReflectionDecision } from "./reflection/ReflectionDecision";
import { RepairResult } from "./repair/RepairResult";

/**
 * Interface representing the Graph Transformation Engine.
 * It is purely deterministic and acts as the only component allowed to mutate 
 * the Execution graph based on approved decisions.
 */
export interface RepairEngine {
  /**
   * Applies accepted or modified recommendations to the original DAG,
   * producing a new, traceable Execution v2 DAG along with a ChangeSet.
   */
  generateRepairPlan(
    context: IntelligenceContext, 
    originalExecution: Execution,
    reflectionDecisions: readonly ReflectionDecision[]
  ): Promise<IntelligenceDecision<RepairResult>>;
}
