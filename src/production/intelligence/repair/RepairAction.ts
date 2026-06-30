// src/production/intelligence/repair/RepairAction.ts

import { TraceableArtifact } from "../contracts/TraceableArtifact";

export enum RepairActionType {
  MERGE_JOBS = "MERGE_JOBS",
  SPLIT_JOB = "SPLIT_JOB",
  CHANGE_CAPABILITY = "CHANGE_CAPABILITY",
  PARALLELIZE_TASK = "PARALLELIZE_TASK",
  REDUCE_DEPENDENCIES = "REDUCE_DEPENDENCIES"
}

/**
 * A purely deterministic instruction for the Graph Transformation Engine (Repair Engine).
 * It represents the final translation of a ReflectionDecision into a structural mutation.
 */
export interface RepairAction extends TraceableArtifact {
  readonly actionType: RepairActionType;
  
  /** The target Job or Task ID in the execution graph */
  readonly targetId: string;
  
  /** Parameters specific to the action (e.g., capability name, or IDs to merge) */
  readonly parameters?: Record<string, unknown>;
  
  /** 
   * The ID of the ReflectionDecision that authorized this action, 
   * preserving the Decision Ledger chain.
   */
  readonly reflectionDecisionId: string;
}
