// src/production/infrastructure/artifact/ArtifactStore.ts
import { WorkerResult } from "../../sdk/WorkerResult";

/**
 * Simple contract for a storage component that persists the artifacts
 * produced by workers (e.g., APK files, images, docs). Implementations
 * may use filesystem, cloud storage, DB, etc.
 */
export interface ArtifactStore {
  /** Persist a result's artifact payload and return a storage identifier. */
  store(result: WorkerResult): Promise<string>;

  /** Retrieve a stored artifact by its identifier. */
  retrieve(id: string): Promise<unknown>;
}
