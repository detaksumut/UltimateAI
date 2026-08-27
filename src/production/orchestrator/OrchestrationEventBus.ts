/** Names for all events that flow through the orchestration pipeline. */
export type OrchestrationEventName =
  | "RequirementReady"
  | "BlueprintReady"
  | "StrategySelected"
  | "ArchitectureReady"
  | "DagReady"
  | "ArtifactsGenerated"
  | "CompositionReady"
  | "Certified"
  | "PipelineFailed"
  | "PipelineCancelled";

export interface OrchestrationEvent {
  readonly eventId: string;
  readonly name: OrchestrationEventName;
  readonly requestId: string;
  readonly emittedAt: string;
  readonly payload?: unknown;
}

type EventHandler = (event: OrchestrationEvent) => void;

let _eventCounter = 0;

/**
 * Lightweight in-process event bus for the Orchestration Engine.
 * Decouples pipeline steps for observability and future async scaling.
 */
export class OrchestrationEventBus {
  private readonly handlers: Map<OrchestrationEventName | "*", EventHandler[]> = new Map();
  private readonly eventLog: OrchestrationEvent[] = [];

  on(name: OrchestrationEventName | "*", handler: EventHandler): void {
    const existing = this.handlers.get(name) ?? [];
    this.handlers.set(name, [...existing, handler]);
  }

  emit(name: OrchestrationEventName, requestId: string, payload?: unknown): void {
    const event: OrchestrationEvent = {
      eventId: `evt-${++_eventCounter}`,
      name,
      requestId,
      emittedAt: new Date().toISOString(),
      payload
    };
    this.eventLog.push(event);

    // Notify specific handlers
    (this.handlers.get(name) ?? []).forEach(h => h(event));
    // Notify wildcard handlers
    (this.handlers.get("*") ?? []).forEach(h => h(event));
  }

  /** Return ordered event log for a specific request (audit trail). */
  getLog(requestId: string): OrchestrationEvent[] {
    return this.eventLog.filter(e => e.requestId === requestId);
  }

  /** Return all events emitted (cross-request). */
  getFullLog(): OrchestrationEvent[] {
    return [...this.eventLog];
  }

  clearLog(): void {
    this.eventLog.length = 0;
  }
}
