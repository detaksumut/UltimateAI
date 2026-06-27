import { PlanningRequest } from '../models/PlanningRequest';
import { PlanningResult } from '../models/PlanningResult';

/**
 * Middleware that can inspect / modify a {@link PlanningRequest} before it reaches the strategy.
 * It must invoke `next` to continue the pipeline.
 */
export interface IPlanningMiddleware {
  /**
   * Process the request and either return a result or delegate to the next middleware.
   */
  handle(request: PlanningRequest, next: () => Promise<PlanningResult>): Promise<PlanningResult>;
}
