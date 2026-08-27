export interface StepTrace {
  readonly stepName: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly status: "success" | "failed" | "repaired";
  readonly generatorId?: string;
  readonly repairCount?: number;
  readonly failureReason?: string;
}

export interface PipelineTrace {
  readonly traceId: string;
  readonly requestId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly totalDurationMs: number;
  readonly steps: StepTrace[];
  readonly totalRepairs: number;
  readonly status: "completed" | "failed" | "partial";
  readonly failureReason?: string;
}

/**
 * ObservabilityTracer records per-step telemetry across the orchestration pipeline.
 * Used to produce a full PipelineTrace for every OrchestrationRequest.
 */
export class ObservabilityTracer {
  private traceId: string;
  private requestId: string;
  private startedAt: string;
  private readonly steps: StepTrace[] = [];
  private stepStartTimes: Map<string, number> = new Map();
  private totalRepairs = 0;

  constructor(requestId: string) {
    this.requestId = requestId;
    this.traceId = `trace-${requestId}-${Date.now()}`;
    this.startedAt = new Date().toISOString();
  }

  /** Call at the beginning of each pipeline step. */
  startStep(stepName: string, generatorId?: string): void {
    this.stepStartTimes.set(stepName, Date.now());
  }

  /** Call at the end of each pipeline step. */
  endStep(
    stepName: string,
    status: "success" | "failed" | "repaired",
    options: {
      generatorId?: string;
      repairCount?: number;
      failureReason?: string;
    } = {}
  ): void {
    const startMs = this.stepStartTimes.get(stepName) ?? Date.now();
    const endMs = Date.now();
    const durationMs = endMs - startMs;

    if (options.repairCount) this.totalRepairs += options.repairCount;

    this.steps.push({
      stepName,
      startedAt: new Date(startMs).toISOString(),
      completedAt: new Date(endMs).toISOString(),
      durationMs,
      status,
      generatorId: options.generatorId,
      repairCount: options.repairCount,
      failureReason: options.failureReason
    });
  }

  /** Produce the final PipelineTrace. */
  finalize(status: "completed" | "failed" | "partial", failureReason?: string): PipelineTrace {
    const completedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - new Date(this.startedAt).getTime();

    return {
      traceId: this.traceId,
      requestId: this.requestId,
      startedAt: this.startedAt,
      completedAt,
      totalDurationMs,
      steps: [...this.steps],
      totalRepairs: this.totalRepairs,
      status,
      failureReason
    };
  }
}
