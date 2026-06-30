// src/production/worker/IWorker.ts

import { WorkerContext } from "../sdk/WorkerContext";
import { WorkerResult } from "../sdk/WorkerResult";
import { WorkerDescriptor } from "./WorkerDescriptor";

/**
 * Public contract for a Worker as seen by the Infrastructure layer.
 * This is a thin interface — concrete implementations extend
 * {@link BaseWorker} (in the SDK) which satisfies this contract.
 */
export interface IWorker {
  /** Immutable descriptor for this worker */
  readonly descriptor: WorkerDescriptor;

  /** Execute the task described by the given context */
  execute(context: WorkerContext): Promise<WorkerResult>;
}
