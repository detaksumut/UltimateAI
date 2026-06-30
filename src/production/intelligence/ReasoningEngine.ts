// src/production/intelligence/ReasoningEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";
import { ExecutionIntent } from "./ExecutionIntent";

/**
 * Interface representing the intent parsing and problem breakdown phase.
 */
export interface ReasoningEngine {
  /**
   * Analyzes the context and user request to break down ambiguities 
   * and infer the true intent.
   * Returns a decision containing the ExecutionIntent.
   */
  analyzeRequest(context: IntelligenceContext): Promise<IntelligenceDecision<ExecutionIntent>>;
}
