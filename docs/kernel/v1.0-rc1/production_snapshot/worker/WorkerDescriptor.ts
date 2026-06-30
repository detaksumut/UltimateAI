// src/production/worker/WorkerDescriptor.ts

import { WorkerCapability } from "../sdk/WorkerCapability";

/**
 * Immutable description of a Worker's identity and capabilities.
 * Every concrete Worker must expose a descriptor so the Infrastructure
 * layer can register, resolve, and select it without importing the
 * Worker class itself.
 */
export interface WorkerDescriptor {
  /** Unique type identifier (e.g., "AndroidWorker", "ImageWorker") */
  readonly workerType: string;

  /** Capabilities this worker provides */
  readonly capabilities: readonly WorkerCapability[];

  /** Task types the worker can handle (e.g., "build_apk", "generate_image") */
  readonly supportedTaskTypes: readonly string[];
}
