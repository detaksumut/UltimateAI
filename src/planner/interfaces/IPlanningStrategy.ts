import { PlanningRequest } from '../models/PlanningRequest';
import { PlanningResult } from '../models/PlanningResult';

/**
 * Strategy that contains the concrete planning algorithm.
 */
export interface IPlanningStrategy {
  /**
   * Execute planning based on the provided request.
   */
  execute(request: PlanningRequest): Promise<PlanningResult>;
}
