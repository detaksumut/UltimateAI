// src/execution/interfaces/IExecutionEngine.ts

import { ExecutionRequest } from "../models/ExecutionRequest";
import { ExecutionResult } from "../models/ExecutionResult";

/**
 * Contract for the Execution Engine. It receives an {@link ExecutionRequest}
 * (which contains a {@link TaskGraph}) and returns an {@link ExecutionResult}.
 */
export interface IExecutionEngine {
  /**
   * Execute the supplied request.
   * @param request - immutable request containing the {@link TaskGraph}.
   */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
