// src/execution/interfaces/IExecutionEventPublisher.ts

import { ExecutionEvent } from "../models/ExecutionEvent";

/**
 * Interface to publish execution events for telemetry, metrics, and observation.
 */
export interface IExecutionEventPublisher {
  /**
   * Publish an execution event.
   * @param event - the execution event (immutable)
   */
  publish(event: ExecutionEvent): void;
}
