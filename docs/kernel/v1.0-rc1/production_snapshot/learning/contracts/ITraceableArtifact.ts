// src/production/learning/contracts/ITraceableArtifact.ts

import { ILearningArtifact } from "./ILearningArtifact";

/**
 * Principle 22: Knowledge Evolves Through Successors
 * 
 * Extends the base learning artifact to explicitly support graph-based lineage.
 * Allows artifacts to trace their exact parents and the pipeline job that created them.
 */
export interface ITraceableArtifact extends ILearningArtifact {
  /** The direct ancestor artifact this was evolved from (if any) */
  readonly parentArtifactId?: string;
  
  /** The unique ID of the pipeline execution that produced this artifact */
  readonly pipelineId?: string;
  
  /** The unique ID of the specific stage execution */
  readonly executionId?: string;
}
