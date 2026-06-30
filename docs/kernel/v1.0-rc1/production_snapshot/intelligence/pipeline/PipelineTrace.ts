// src/production/intelligence/pipeline/PipelineTrace.ts

/**
 * An individual trace step logged during pipeline execution.
 */
export interface TraceStep {
  readonly stepName: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly durationMs: number;
  readonly status: "SUCCESS" | "FAILED" | "SKIPPED";
  readonly details?: string;
}

/**
 * Sequential history of all steps the pipeline took, useful for the Decision Graph.
 */
export interface PipelineTrace {
  readonly id: string;
  readonly correlationId: string;
  readonly steps: readonly TraceStep[];
  readonly totalDurationMs: number;
}
