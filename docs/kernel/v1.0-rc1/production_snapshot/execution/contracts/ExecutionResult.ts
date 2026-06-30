// src/production/execution/contracts/ExecutionResult.ts

import { IRuntimeResult } from "../../runtime/contracts/IRuntimeResult";
import { WorkflowStatus } from "../runner/WorkflowStatus";
import { IArtifact, ArtifactIdentity, ArtifactTrace } from "../../runtime/contracts/IArtifact";

export interface ExecutionResultPayload extends IArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;

  /** State of the workflow (e.g. COMPLETED, FAILED, CANCELLED) */
  readonly workflowStatus: WorkflowStatus;
  
  /** Number of tasks successfully completed */
  readonly completedTasks: number;
  
  /** Number of tasks that failed */
  readonly failedTasks: number;
  
  /** Pointer to the append-only log detailing every physical action */
  readonly executionLogId: string;
  
  /** Pointers to physical artifacts (e.g. files, patches, outputs) stored in the ArtifactStore */
  readonly artifactIds: readonly string[];
}

/**
 * The unified output of the Execution Runtime.
 */
export type ExecutionResult = IRuntimeResult<ExecutionResultPayload>;
