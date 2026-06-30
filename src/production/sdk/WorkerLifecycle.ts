// src/production/sdk/WorkerLifecycle.ts

/**
 * Lifecycle hooks that a Worker may optionally implement.
 * The Infrastructure layer calls these hooks at the appropriate times
 * during the worker's lifetime.
 */
export interface WorkerLifecycle {
  /**
   * Called once before the first execution.
   * Use for resource allocation, connection pooling, warm‑up, etc.
   */
  init?(): Promise<void>;

  /**
   * Called before each individual task execution.
   * Use for per‑task setup (e.g., resetting state, loading context).
   */
  prepare?(): Promise<void>;

  /**
   * Called once when the worker is being retired.
   * Use for resource cleanup, flushing buffers, closing connections.
   */
  shutdown?(): Promise<void>;
}
