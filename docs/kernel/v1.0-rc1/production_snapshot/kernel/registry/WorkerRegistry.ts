export interface WorkerManifest {
  /** Unique identifier for the worker type */
  readonly workerType: string;

  /** Human‑readable capabilities this worker provides */
  readonly capabilities: readonly string[];

  /** Task types that the worker can execute */
  readonly supportedTasks: readonly string[];
}

/** Registry mapping a worker type to its manifest */
export type WorkerRegistry = Record<string, WorkerManifest>;
