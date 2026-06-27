// src/planner/models/TaskNode.ts

/**
 * Represents a single node in the planning DAG.
 * This model is immutable and contains only declarative data.
 */
export interface TaskNode {
  /** Unique identifier for the task node */
  readonly id: string;
  /** The capability that this task fulfills */
  readonly capability: string;
  /** Human‑readable description of the task */
  readonly description: string;
  /** IDs of tasks that must complete before this one */
  readonly dependencies: readonly string[];
  /** Optional extensibility metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}
