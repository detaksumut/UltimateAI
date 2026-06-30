// src/production/intelligence/repair/ExecutionChangeSet.ts

import { TraceableArtifact } from "../contracts/TraceableArtifact";

/**
 * Records the differences between Execution v1 and Execution v2.
 * Used for observability, rollback capabilities, and the Learning Engine.
 */
export interface ExecutionChangeSet extends TraceableArtifact {
  /** IDs of new tasks that were added */
  readonly addedTasks: readonly string[];
  
  /** IDs of tasks that were removed */
  readonly removedTasks: readonly string[];
  
  /** 
   * Records changes to dependencies. 
   * Map key is the Task ID, value is a description of the change (e.g., 'Removed dependsOn: task-1') 
   */
  readonly updatedDependencies: ReadonlyMap<string, string>;
  
  /** 
   * Records changes to task capabilities.
   * Map key is the Task ID, value is a description of the capability change.
   */
  readonly changedCapabilities: ReadonlyMap<string, string>;
}
