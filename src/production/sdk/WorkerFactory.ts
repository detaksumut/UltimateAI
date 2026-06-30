// src/production/sdk/WorkerFactory.ts

import type { IWorker } from "../worker/IWorker";

/**
 * Contract for creating Worker instances.
 * The Kernel defines this interface; the **Infrastructure layer** provides
 * concrete implementations (e.g., DI container, dynamic import, etc.).
 *
 * The Kernel and SDK never call this directly — only Infrastructure does.
 */
export interface WorkerFactory {
  /**
   * Create a Worker instance for the given worker type name.
   * @param workerType — the registered type identifier (e.g., "AndroidWorker")
   * @returns a fully initialised IWorker ready for execution
   */
  create(workerType: string): Promise<IWorker>;
}
