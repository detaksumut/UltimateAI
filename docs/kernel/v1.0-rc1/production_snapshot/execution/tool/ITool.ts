// src/production/execution/tool/ITool.ts

/**
 * A generic interface for all executable tools (Filesystem, API, Agent, etc).
 */
export interface ITool {
  readonly id: string;
  readonly name: string;
  
  /** 
   * Executes the tool with the given payload.
   * Throws only on contract/policy violations, returns error strings otherwise.
   */
  execute(payload: Record<string, any>): Promise<any>;
}
