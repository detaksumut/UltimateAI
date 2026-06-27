// src/execution/ExecutionEngine.ts

import { IExecutionEngine } from "./interfaces/IExecutionEngine";
import { ExecutionRequest } from "./models/ExecutionRequest";
import { ExecutionResult } from "./models/ExecutionResult";
import { ExecutionRuntime } from "./runtime/ExecutionRuntime";

/**
 * ExecutionEngine acts as a façade. It receives an ExecutionRequest and delegates
 * the orchestration to ExecutionRuntime. No scheduling, execution, or state
 * management occurs here.
 */
export class ExecutionEngine implements IExecutionEngine {
  constructor(private readonly runtime: ExecutionRuntime) {}

  /**
   * Delegates execution to the runtime.
   */
  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.runtime.run(request);
  }
}
