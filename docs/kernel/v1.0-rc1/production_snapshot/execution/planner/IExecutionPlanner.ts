// src/production/execution/planner/IExecutionPlanner.ts

import { ExecutionBlueprint } from "../contracts/ExecutionBlueprint";
import { ExecutionTaskGraph } from "./ExecutionTaskGraph";

/**
 * Principle 35: Strategy Before Tactics.
 * Translates an immutable strategic blueprint into a tactical, executable task graph.
 */
export interface IExecutionPlanner {
  planTactics(blueprint: ExecutionBlueprint): Promise<ExecutionTaskGraph>;
}
