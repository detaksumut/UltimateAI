// src/production/infrastructure/resolver/WorkerResolver.ts
import { WorkerCapability } from "../../sdk/WorkerCapability";
import { WorkerMetadata } from "../registry/RuntimeWorkerRegistry";

/**
 * Resolves the identity/metadata of a worker that can satisfy the
 * supplied capability set. 
 * Note: It does not return an instance of IWorker. Instantiation
 * is the responsibility of WorkerLoader.
 */
export interface WorkerResolver {
  /** Return worker metadata that supports *all* given capabilities, or undefined. */
  resolveWorkerMetadata(capabilities: readonly WorkerCapability[]): readonly WorkerMetadata[];
}
