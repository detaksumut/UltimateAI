// src/planner/TaskGraph.ts

/**
 * Domain model representing a Directed Acyclic Graph (DAG) of planning tasks.
 * It contains only declarative data and is immutable.
 * Used by Planner Engine, Execution Engine, Workflow Engine, and Multi‑Agent Runtime.
 */
import { TaskNode } from "./models/TaskNode";

export interface TaskGraph {
  /** Collection of task nodes forming the graph */
  readonly nodes: readonly TaskNode[];
}
