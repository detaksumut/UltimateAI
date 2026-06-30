import { IRuntimeTelemetryEvent } from "../events/IRuntimeTelemetryEvent";
import { RuntimeTelemetryPhase } from "../events/RuntimeTelemetryPhase";
import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";

export interface EmitTelemetryArgs {
  traceId: string;
  parentTraceId?: string;
  causationId?: string;
  runtimeId: string;
  phase: RuntimeTelemetryPhase;
  eventType: string;
  payload?: any;
}

export class TelemetryEmitter {
  // sequence counter scoped to traceId
  private sequenceCounters = new Map<string, number>();

  constructor(private readonly eventBus: IRuntimeEventBus) {}

  emit(args: EmitTelemetryArgs): IRuntimeTelemetryEvent {
    let sequence = this.sequenceCounters.get(args.traceId) || 0;
    sequence++;
    this.sequenceCounters.set(args.traceId, sequence);

    // Clean up sequence on COMPLETED, FAILED, or CANCELLED to prevent memory leaks
    if (args.phase === RuntimeTelemetryPhase.COMPLETED || 
        args.phase === RuntimeTelemetryPhase.FAILED || 
        args.phase === RuntimeTelemetryPhase.CANCELLED) {
      this.sequenceCounters.delete(args.traceId);
    }

    const event: IRuntimeTelemetryEvent = {
      eventId: `tel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      traceId: args.traceId,
      parentTraceId: args.parentTraceId,
      causationId: args.causationId,
      sequenceNumber: sequence,
      timestamp: Date.now(),
      runtimeId: args.runtimeId,
      phase: args.phase,
      eventType: args.eventType,
      payload: args.payload
    };

    // Forward to the underlying event bus
    // We cast it to any because the underlying bus expects RuntimeEvent, 
    // but in v1.1 we are splitting namespaces physically. For now they share the transport.
    this.eventBus.publish(event as any);

    return event;
  }
}
