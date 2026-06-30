// src/production/execution/planner/ExecutionTaskGraph.ts

import { ExecutionTask } from "../executor/ExecutionTask";

/**
 * A directed graph of physical execution tasks.
 * Translated from the strategic Blueprint.
 */
export interface ExecutionTaskGraph {
  readonly graphId: string;
  readonly blueprintId: string;
  readonly tasks: readonly ExecutionTask[];
}
