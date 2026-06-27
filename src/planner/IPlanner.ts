import { PlanningContext } from './PlanningContext';
import { PlanningResult } from './PlanningResult';

/**
 * Planner abstraction – produces a PlanningResult from a context and available tools/agents.
 */
export interface IPlanner {
  /**
   * Generate a plan.
   * @param context - The planning context containing user intent and settings.
   * @param tools - Optional list of available tools.
   * @param agents - Optional list of available agents.
   */
  plan(context: PlanningContext, tools?: unknown[], agents?: unknown[]): Promise<PlanningResult>;
}
