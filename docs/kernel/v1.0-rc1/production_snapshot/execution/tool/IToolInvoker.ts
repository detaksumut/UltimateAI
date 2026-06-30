// src/production/execution/tool/IToolInvoker.ts

import { ExecutionTask } from "../executor/ExecutionTask";

/**
 * Safely invokes tools by enforcing security policies.
 */
export interface IToolInvoker {
  /**
   * Resolves the policy, looks up the tool, and executes it.
   */
  invoke(task: ExecutionTask, sessionPermissions?: readonly string[]): Promise<any>;
}
