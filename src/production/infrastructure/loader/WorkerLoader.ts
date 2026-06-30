// src/production/infrastructure/loader/WorkerLoader.ts
import { IWorker } from "../../worker/IWorker";

/**
 * Responsible for loading a concrete Worker class (or factory) given a
 * worker type identifier. 
 * This is the only component allowed to instantiate or return IWorker.
 */
export interface WorkerLoader {
  /** Load (or create) the worker instance for the given type name. */
  loadWorker(workerType: string): Promise<IWorker>;
}
