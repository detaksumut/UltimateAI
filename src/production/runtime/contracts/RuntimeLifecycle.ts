// src/production/runtime/contracts/RuntimeLifecycle.ts

/**
 * The explicit state machine governing a runtime's operational lifecycle.
 */
export enum RuntimeLifecycle {
  CREATED = "CREATED",
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  RUNNING = "RUNNING",
  WAITING = "WAITING",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  FAILED = "FAILED"
}
