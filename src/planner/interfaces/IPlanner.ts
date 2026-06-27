import { PlanningRequest } from '../models/PlanningRequest';
import { PlanningResult } from '../models/PlanningResult';

/**
 * Orchestrator entry point for the planning subsystem.
 * Implementations should be stateless and delegate all work to the
 * injected strategy and optional middleware pipeline.
 */
export interface IPlanner {
  /**
   * Execute a planning request and obtain a {@link PlanningResult}.
   */
  plan(request: PlanningRequest): Promise<PlanningResult>;
}
