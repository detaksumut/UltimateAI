import { PlanningContext } from './PlanningContext';

/**
 * Top‑level request object passed to the planner.
 */
export interface PlanningRequest {
  /** The user intent or natural‑language command. */
  readonly intent: string;
  /** Context snapshot required for planning. */
  readonly context: PlanningContext;
  // Future optional fields may be added here.
}
