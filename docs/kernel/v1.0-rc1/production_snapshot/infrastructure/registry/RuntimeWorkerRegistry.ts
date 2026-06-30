// src/production/infrastructure/registry/RuntimeWorkerRegistry.ts
import { WorkerCapability } from "../../sdk/WorkerCapability";

/**
 * Metadata associated with a registered worker.
 */
export interface WorkerMetadata {
  readonly workerType: string;
  readonly capabilities: readonly WorkerCapability[];
  readonly priority?: number;
  readonly tags?: readonly string[];
}

/**
 * Runtime registry that holds **metadata** about available workers.
 * It does not handle loading or dependency injection.
 */
export interface RuntimeWorkerRegistry {
  /** Register a worker's metadata. */
  register(metadata: WorkerMetadata): void;

  /** Get metadata for a specific worker type. */
  getMetadata(workerType: string): WorkerMetadata | undefined;

  /** Find all worker metadata that satisfy *all* required capabilities. */
  findMatchingWorkers(required: readonly WorkerCapability[]): readonly WorkerMetadata[];
}
