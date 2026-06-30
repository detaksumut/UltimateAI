import { RuntimeTelemetryPhase } from "./RuntimeTelemetryPhase";

/**
 * Immutable telemetry event representing a single point-in-time observation of the cognitive loop.
 */
export interface IRuntimeTelemetryEvent<TPayload = any> {
  readonly eventId: string;
  readonly traceId: string;
  readonly parentTraceId?: string;
  readonly causationId?: string;
  readonly sequenceNumber: number;
  readonly timestamp: number;
  
  readonly runtimeId: string;
  readonly phase: RuntimeTelemetryPhase;
  readonly eventType: string;
  
  readonly payload?: TPayload;
}
