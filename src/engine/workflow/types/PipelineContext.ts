export interface PipelineContext {
  /** Mutable metadata/state dictionary specific to this execution run */
  state: Record<string, any>;
  /** Logging collection for this pipeline run */
  logs: string[];
  /** Tracing identifier if available */
  traceId?: string;
  /** Telemetry metrics or indicators */
  metrics: Record<string, number>;
  /** Step execution timing properties */
  startTime?: Date;
  endTime?: Date;
  durationMs?: number;
  /** Retry count track */
  retryCount: number;
}
