// src/production/infrastructure/pipeline/WorkerPipeline.ts
import { WorkerContext } from "../../sdk/WorkerContext";
import { WorkerResult } from "../../sdk/WorkerResult";
import { Task } from "../../kernel/task/Task";

/**
 * Orchestrates the full flow:
 *   Task → CapabilityResolver → WorkerSelector →
 *   WorkerLoader → WorkerDispatcher → WorkerResult
 *
 * This is a pure contract; the implementation will be added later.
 */
export interface WorkerPipeline {
  /**
   * Run the complete pipeline for a given task and context.
   * Returns the final `WorkerResult`.
   */
  run(task: Task, context: WorkerContext): Promise<WorkerResult>;
}
