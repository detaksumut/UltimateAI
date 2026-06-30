// src/production/runtime/events/RuntimeEvent.ts

/**
 * A standardized event emitted by runtimes during execution.
 * Principle 27: Events Never Control Execution. They are for observability only.
 */
export interface RuntimeEvent<TPayload = any> {
  readonly eventId: string;
  readonly correlationId: string;
  readonly executionId: string;
  
  readonly eventType: string;
  readonly runtimeId: string;
  
  readonly timestamp: number;
  readonly payload: TPayload;
}
