// src/production/runtime/events/RuntimeEventBus.ts

import { RuntimeEvent } from "./RuntimeEvent";

export type EventHandler = (event: RuntimeEvent) => void;

/**
 * A passive pub/sub bus for runtime events.
 * Strictly asynchronous/fire-and-forget to prevent blocking the Coordinator.
 */
export interface IRuntimeEventBus {
  /**
   * Publishes an event to the bus asynchronously.
   * Does not wait for handlers to finish.
   */
  publish(event: RuntimeEvent): void;
  
  /**
   * Subscribes a handler to a specific event type.
   */
  subscribe(eventType: string, handler: EventHandler): void;
  
  /**
   * Unsubscribes a handler from a specific event type.
   */
  unsubscribe(eventType: string, handler: EventHandler): void;
}

export class RuntimeEventBusImpl implements IRuntimeEventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  publish(event: RuntimeEvent): void {
    const eventHandlers = this.handlers.get(event.eventType);
    if (eventHandlers) {
      // Fire and forget - execute asynchronously without blocking
      setTimeout(() => {
        eventHandlers.forEach(handler => {
          try {
            handler(event);
          } catch (err) {
            console.error(`[EventBus] Error in handler for ${event.eventType}:`, err);
          }
        });
      }, 0);
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }
}
