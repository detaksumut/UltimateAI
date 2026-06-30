// src/production/infrastructure/routing/WorkerSelector.ts
import { WorkerCapability } from "../../sdk/WorkerCapability";

/**
 * High‑level selector used by the Infrastructure layer.
 * Given required capabilities, it selects the *best* worker type name.
 * The selector does **not** instantiate the worker.
 */
export interface WorkerSelector {
  /** Choose a worker type identifier for the requested capabilities. */
  selectWorkerType(capabilities: readonly WorkerCapability[]): string | undefined;
}
