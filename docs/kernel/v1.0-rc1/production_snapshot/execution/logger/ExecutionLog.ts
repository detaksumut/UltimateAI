// src/production/execution/logger/ExecutionLog.ts

/**
 * An individual, append-only physical fact about the execution.
 * Principle 36: Execution Produces Facts, Never Interpretation.
 */
import { IArtifact, ArtifactIdentity, ArtifactTrace } from "../../runtime/contracts/IArtifact";

export interface ExecutionLogEntry {
  readonly timestamp: number;
  readonly type: "TASK_STARTED" | "TASK_COMPLETED" | "TASK_FAILED" | "WORKFLOW_STARTED" | "WORKFLOW_COMPLETED" | "WORKFLOW_FAILED" | "SECURITY_BLOCKED";
  readonly entityId: string; // The ID of the task or workflow
  readonly payload: any;
}

/**
 * The definitive, append-only chronological record of what actually happened.
 * Sits alongside physical blobs in the IExecutionArtifactStore.
 */
export interface ExecutionLog extends IArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;

  readonly logId: string;
  readonly executionId: string;
  readonly blueprintId: string;
  
  readonly startedAt: number;
  readonly finishedAt?: number;
  
  readonly entries: readonly ExecutionLogEntry[];
}
