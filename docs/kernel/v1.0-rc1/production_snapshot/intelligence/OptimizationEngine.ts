// src/production/intelligence/OptimizationEngine.ts

import { IntelligenceContext } from "./IntelligenceContext";
import { IntelligenceDecision } from "./IntelligenceDecision";
import { Task } from "../kernel/task/Task";

/**
 * Information on how to optimize a task (e.g., routing hints, priority).
 */
export interface OptimizationStrategy {
  readonly recommendedCapabilities?: readonly string[];
  readonly maxCostThreshold?: number;
  readonly maxLatencyMs?: number;
  readonly routingHints?: Record<string, unknown>;
}

/**
 * Interface responsible for making strategic decisions on capability routing,
 * cost, reliability, and latency.
 */
export interface OptimizationEngine {
  /**
   * Analyzes a Task and returns an optimization strategy to guide Infrastructure.
   */
  optimizeTask(
    context: IntelligenceContext, 
    task: Task
  ): Promise<IntelligenceDecision<OptimizationStrategy>>;
}
