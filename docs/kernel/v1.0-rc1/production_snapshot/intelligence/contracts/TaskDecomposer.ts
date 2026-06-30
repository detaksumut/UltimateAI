// src/production/intelligence/contracts/TaskDecomposer.ts

import { ExecutionIntent } from "../ExecutionIntent";

/**
 * Represents a logical structure proposed for execution.
 * This is an intermediate format before the strict DAG (Execution) is built.
 */
export interface JobProposal {
  readonly name: string;
  readonly tasks: readonly string[]; // Proposed task names or descriptions
}

export interface DecompositionProposal {
  readonly jobs: readonly JobProposal[];
}

/**
 * Decomposes an ExecutionIntent into a logical structure of Jobs and Tasks.
 * Implementations can be pure Rule-Based, AI-Assisted (Hybrid), or fully AI.
 */
export interface TaskDecomposer {
  /**
   * Translates the given intent into a proposed structural breakdown.
   */
  decompose(intent: ExecutionIntent): Promise<DecompositionProposal>;
}
