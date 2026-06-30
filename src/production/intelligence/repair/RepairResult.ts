// src/production/intelligence/repair/RepairResult.ts

import { Execution } from "../../kernel/execution/Execution";
import { ExecutionChangeSet } from "./ExecutionChangeSet";

/**
 * The final output payload of the Repair Engine.
 * Contains the newly generated Execution Graph and the delta (ChangeSet).
 */
export interface RepairResult {
  /** The new, immutable Execution v2 */
  readonly execution: Execution;
  
  /** The documented changes applied */
  readonly changeSet: ExecutionChangeSet;
}
