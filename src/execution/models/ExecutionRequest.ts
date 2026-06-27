// src/execution/models/ExecutionRequest.ts

import { TaskGraph } from "../../planner/TaskGraph";
import { ExecutionOptions } from "./ExecutionOptions";

/**
 * Model representing the request for execution.
 * This model is immutable.
 */
export interface ExecutionRequest {
  /** The graph of tasks to execute */
  readonly graph: TaskGraph;
  /** Optional execution configuration options */
  readonly options?: ExecutionOptions;
}
