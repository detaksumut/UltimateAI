// src/production/infrastructure/dispatcher/WorkerDispatcher.ts
import { WorkerContext } from "../../sdk/WorkerContext";
import { WorkerResult } from "../../sdk/WorkerResult";
import { IWorker } from "../../worker/IWorker";

/**
 * Executes a single resolved worker, handling lifecycle hooks and
 * translating low‑level errors into a `WorkerResult`.
 */
export interface WorkerDispatcher {
  /** Dispatch the worker with the given context and return the result. */
  dispatch(worker: IWorker, context: WorkerContext): Promise<WorkerResult>;
}
