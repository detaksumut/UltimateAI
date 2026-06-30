// src/production/kernel/task/Job.ts
import type { Task } from "./Task";

/**
 * Immutable domain model representing a logical grouping of Tasks.
 */
export interface Job {
  /** Unique identifier for the job */
  readonly id: string;
  
  /** Human-readable name of the job */
  readonly name: string;
  
  /** Identifier of the parent Execution */
  readonly executionId: string;
  
  /** The tasks that belong to this job */
  readonly tasks: readonly Task[];
}
