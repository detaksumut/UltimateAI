// src/production/intelligence/CriticEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";
import { Execution } from "../kernel/execution/Execution";
import { CriticEvaluation } from "./critic/CriticEvaluation";

/**
 * Interface representing the Quality Assessment Engine.
 */
export interface CriticEngine {
  /**
   * Evaluates the qualitative design of an Execution DAG, 
   * outputting a multidimensional assessment.
   */
  evaluateExecution(
    context: IntelligenceContext, 
    execution: Execution
  ): Promise<IntelligenceDecision<CriticEvaluation>>;
}
