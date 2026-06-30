// src/production/execution/contracts/IExecutionContext.ts

import { IRuntimeContext } from "../../runtime/contracts/IRuntimeContext";
import { ExecutionBlueprint } from "./ExecutionBlueprint";

/**
 * The execution context passed to the Execution Runtime.
 */
export interface IExecutionContext extends IRuntimeContext {
  /** The immutable strategy to execute */
  readonly blueprint: ExecutionBlueprint;
  
  /** Any active security or permission overrides for this execution session */
  readonly sessionPermissions?: readonly string[];
}
