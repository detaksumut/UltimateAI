// src/production/runtime/contracts/TraceChain.ts

/**
 * Ensures strict observability and distributed tracing across the entire cognitive loop.
 */
export interface TraceChain {
  readonly traceId: string;
  readonly parentTraceId?: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly sessionId: string;
  readonly pipelineId?: string;
  readonly executionId?: string;
}
