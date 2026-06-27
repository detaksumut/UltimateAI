import { TaskGraph } from '../TaskGraph';
import { PlannerError } from '../PlannerError';

/**
 * Result of a planning operation.
 */
export interface PlanningResult {
  /** The resulting task graph. */
  readonly graph: TaskGraph;
  /** Optional errors encountered during planning. */
  readonly errors?: PlannerError[];
}
