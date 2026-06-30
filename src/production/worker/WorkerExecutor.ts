// src/production/worker/WorkerExecutor.ts

import { WorkerContext } from "../sdk/WorkerContext";
import { WorkerResult } from "../sdk/WorkerResult";
import { IWorker } from "./IWorker";

/**
 * Utility responsible for executing a single worker instance.
 * It manages the lifecycle hooks (init, prepare, shutdown) and 
 * handles execution flow.
 * Note: Infrastructure layer typically invokes this, or implements 
 * a dispatcher that wraps this logic.
 */
export interface WorkerExecutor {
  /**
   * Execute the worker within the given context.
   */
  executeWorker(worker: IWorker, context: WorkerContext): Promise<WorkerResult>;
}
