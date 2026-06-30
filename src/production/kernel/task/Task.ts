// src/production/kernel/task/Task.ts

/**
 * Immutable domain model representing a single unit of work in the Execution DAG.
 */
export interface Task {
  /** Unique identifier for the task */
  readonly id: string;
  
  /** The type of task to be performed */
  readonly type: string;
  
  /** Identifier of the parent Job */
  readonly jobId: string;
  
  /** Identifier of the parent Execution */
  readonly executionId: string;
  
  /** Optional payload containing task-specific data */
  readonly payload?: unknown;
  
  /** 
   * Identifiers of other tasks that must complete before this one can start.
   * This defines the DAG dependencies.
   */
  readonly dependsOn?: readonly string[];
}
