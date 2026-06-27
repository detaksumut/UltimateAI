// src/execution/runtime/InMemoryEventPublisher.ts

import { IExecutionEventPublisher } from "../interfaces/IExecutionEventPublisher";
import { ExecutionEvent } from "../models/ExecutionEvent";

/**
 * An in‑memory recording publisher, useful for unit tests.
 */
export class InMemoryEventPublisher implements IExecutionEventPublisher {
  private readonly events: ExecutionEvent[] = [];

  public publish(event: ExecutionEvent): void {
    this.events.push(event);
  }

  /**
   * Retrieves all published events chronologically.
   */
  public getEvents(): readonly ExecutionEvent[] {
    return this.events;
  }
}
