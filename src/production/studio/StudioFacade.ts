// ─── Orchestrator layer ───────────────────────────────────────────────────────
import { OrchestratorEngine, OrchestrationResult } from "../orchestrator/OrchestratorEngine";
import { IdempotencyGuard } from "../orchestrator/IdempotencyGuard";
import { MetricsCollector, MetricsSummary } from "../orchestrator/MetricsCollector";
import { WorkflowPersistence } from "../orchestrator/WorkflowPersistence";
import { ExecutionStateStore, ExecutionState, ExecutionStatus } from "../orchestrator/ExecutionStateStore";
import { OrchestrationEvent } from "../orchestrator/OrchestrationEventBus";
import { PipelineTrace } from "../orchestrator/ObservabilityTracer";
import { DEFAULT_ORCHESTRATION_MANIFEST } from "../orchestrator/OrchestrationManifest";

// ─── Generator layer ──────────────────────────────────────────────────────────
import { RequirementInterpreter } from "../generator/RequirementInterpreter";
import { BlueprintPlanner } from "../generator/BlueprintPlanner";
import { PolicyEngine } from "../generator/PolicyEngine";
import { KnowledgeBase } from "../generator/KnowledgeBase";
import { DecisionEngine } from "../generator/DecisionEngine";
import { SolutionArchitect } from "../generator/SolutionArchitect";
import { GeneratorRegistry, GeneratorCapabilityMeta } from "../generator/GeneratorRegistry";

// ─── Studio contracts ─────────────────────────────────────────────────────────
import { StudioContext, ANONYMOUS_CONTEXT, assertPermission, StudioPermissions } from "./StudioContext";
import {
  StudioRequest, StudioResult, PreviewResult,
  ExportFormat, ExportBundle, ImportBundle
} from "./StudioContracts";
import * as crypto from "crypto";

// ─── Notification Bus ─────────────────────────────────────────────────────────
import { StudioNotificationBus } from "./StudioNotificationBus";

// ─── Exports for consumers ────────────────────────────────────────────────────
export type { MetricsSummary };

/**
 * StudioFacade — the single public API of the UltimateAI Studio control plane.
 *
 * ADR-008: All delivery channels (CLI, REST, Web UI, Desktop) MUST use this
 * facade. Direct access to OrchestratorEngine is prohibited from external code.
 */
export class StudioFacade {
  private readonly orchestrator: OrchestratorEngine;
  private readonly idempotency: IdempotencyGuard;
  private readonly metrics: MetricsCollector;
  private readonly persistence: WorkflowPersistence;
  private readonly notifications: StudioNotificationBus;

  // Pipeline components for preview (partial execution E1–E3 only)
  private readonly interpreter: RequirementInterpreter;
  private readonly planner: BlueprintPlanner;
  private readonly policyEngine: PolicyEngine;
  private readonly knowledgeBase: KnowledgeBase;
  private readonly decisionEngine: DecisionEngine;
  private readonly architect: SolutionArchitect;
  private readonly registry: GeneratorRegistry;

  // Request result cache (for getTrace / getEventLog)
  private readonly resultCache = new Map<string, OrchestrationResult>();
  // Import registry
  private readonly importedResults = new Map<string, StudioResult>();

  constructor() {
    this.orchestrator  = new OrchestratorEngine(DEFAULT_ORCHESTRATION_MANIFEST);
    this.idempotency   = new IdempotencyGuard();
    this.metrics       = new MetricsCollector(this.orchestrator.stateStore);
    this.persistence   = new WorkflowPersistence();
    this.notifications = new StudioNotificationBus();

    this.interpreter   = new RequirementInterpreter();
    this.planner       = new BlueprintPlanner();
    this.policyEngine  = new PolicyEngine();
    this.knowledgeBase = new KnowledgeBase();
    this.decisionEngine = new DecisionEngine(this.policyEngine, this.knowledgeBase);
    this.architect     = new SolutionArchitect();
    this.registry      = new GeneratorRegistry();
  }

  // ─── G2: Core ──────────────────────────────────────────────────────────────

  /**
   * Submit a generation request. Returns immediately from idempotency cache
   * if an identical request was already processed.
   */
  async submit(request: StudioRequest, context: StudioContext = ANONYMOUS_CONTEXT): Promise<StudioResult> {
    assertPermission(context, StudioPermissions.SUBMIT);

    const hash = this.idempotency.computeHash(request.naturalLanguage, { asOf: request.asOf, dryRun: request.dryRun });
    const cached = this.idempotency.check(hash);
    if (cached) {
      return this.toStudioResult(cached, true, request.tags);
    }

    const requestId = `studio-${crypto.randomUUID()}`;
    this.notifications.emit("GenerationStarted", requestId, request.naturalLanguage);

    const result = await this.orchestrator.orchestrate({
      requestId,
      naturalLanguage: request.naturalLanguage,
      priority: request.priority ?? "normal",
      resourceBudget: request.maxTimeMs ? { maxTimeMs: request.maxTimeMs, maxMemoryMb: 512 } : {},
      options: { asOf: request.asOf, dryRun: request.dryRun }
    });

    this.resultCache.set(requestId, result);
    this.metrics.record(result.trace);

    if (result.status === "SUCCESS") {
      this.idempotency.store(hash, request.naturalLanguage, result);
      this.notifications.emit("GenerationCompleted", requestId, request.naturalLanguage);
    } else if (result.status === "CANCELLED") {
      this.notifications.emit("GenerationCancelled", requestId, request.naturalLanguage);
    } else {
      this.notifications.emit("GenerationFailed", requestId, result.failureReason);
    }

    return this.toStudioResult(result, false, request.tags);
  }

  /** Cancel a running or queued request. */
  cancel(requestId: string, context: StudioContext = ANONYMOUS_CONTEXT): boolean {
    assertPermission(context, StudioPermissions.CANCEL);
    return this.orchestrator.scheduler.cancel(requestId);
  }

  /** Get the current execution state of a request. */
  getStatus(requestId: string): ExecutionState | undefined {
    return this.orchestrator.stateStore.get(requestId);
  }

  /**
   * Preview — executes E1 (Interpret) + E2 (Blueprint) + E2 (Decision) + E3 (Architecture)
   * without running E4 (DAG) or E5 (Generation). Returns an architecture-level preview.
   */
  async preview(request: StudioRequest, context: StudioContext = ANONYMOUS_CONTEXT): Promise<PreviewResult> {
    assertPermission(context, StudioPermissions.PREVIEW);

    const requestId = `preview-${crypto.randomUUID()}`;
    const reqModel = this.interpreter.interpret(request.naturalLanguage);
    const blueprint = this.planner.plan(reqModel);
    const strategy = this.decisionEngine.decide(reqModel, { asOf: request.asOf });
    const architecture = this.architect.design(strategy);
    const estimatedArtifactCount = architecture.services.length;

    return {
      requestId,
      naturalLanguage: request.naturalLanguage,
      blueprint,
      explanation: strategy.explanation,
      architecture,
      estimatedArtifactCount,
      previewedAt: new Date().toISOString()
    };
  }

  /**
   * Replay — re-runs a previously submitted request with a different `asOf` policy date.
   * Useful for audit reproduction.
   */
  async replay(requestId: string, asOf: string, context: StudioContext = ANONYMOUS_CONTEXT): Promise<StudioResult> {
    assertPermission(context, StudioPermissions.REPLAY);
    const cached = this.resultCache.get(requestId);
    if (!cached) throw new Error(`No result found for requestId: ${requestId}`);

    // Re-orchestrate with asOf override
    const replayId = `replay-${crypto.randomUUID()}`;
    const result = await this.orchestrator.orchestrate({
      requestId: replayId,
      naturalLanguage: cached.strategy?.policyEvaluation.matchedPolicies[0]?.name ?? "replay",
      options: { asOf }
    });
    this.resultCache.set(replayId, result);
    this.metrics.record(result.trace);
    return this.toStudioResult(result, false);
  }

  // ─── G3: Metrics + Trace + Event Log ─────────────────────────────────────

  getMetrics(context: StudioContext = ANONYMOUS_CONTEXT): MetricsSummary {
    assertPermission(context, StudioPermissions.METRICS_READ);
    return this.metrics.getSummary();
  }

  getTrace(requestId: string, context: StudioContext = ANONYMOUS_CONTEXT): PipelineTrace | undefined {
    assertPermission(context, StudioPermissions.TRACE_READ);
    return this.resultCache.get(requestId)?.trace;
  }

  getEventLog(requestId: string, context: StudioContext = ANONYMOUS_CONTEXT): OrchestrationEvent[] {
    assertPermission(context, StudioPermissions.TRACE_READ);
    return this.resultCache.get(requestId)?.eventLog ?? [];
  }

  listRequests(filter?: { status?: ExecutionStatus }, context: StudioContext = ANONYMOUS_CONTEXT): ExecutionState[] {
    assertPermission(context, StudioPermissions.TRACE_READ);
    const all = this.orchestrator.stateStore.getAll();
    if (!filter?.status) return all;
    return all.filter(s => s.status === filter.status);
  }

  // ─── G4: Capability Matrix + Policy History + Export/Import ───────────────

  getCapabilityMatrix(context: StudioContext = ANONYMOUS_CONTEXT): GeneratorCapabilityMeta[] {
    assertPermission(context, StudioPermissions.CAPABILITY_READ);
    return this.registry.getCapabilityMatrix();
  }

  getPolicyVersionHistory(context: StudioContext = ANONYMOUS_CONTEXT) {
    assertPermission(context, StudioPermissions.POLICY_READ);
    return this.policyEngine.listVersionHistory();
  }

  /** Export a completed request result in the specified format. */
  export(requestId: string, format: ExportFormat, context: StudioContext = ANONYMOUS_CONTEXT): ExportBundle {
    assertPermission(context, StudioPermissions.EXPORT);
    const result = this.resultCache.get(requestId);
    if (!result) throw new Error(`No result for requestId: ${requestId}`);

    let content: string;
    if (format === "json") {
      content = JSON.stringify({ requestId, status: result.status, certificate: result.certificate, trace: result.trace }, null, 2);
    } else if (format === "yaml") {
      // Simplified YAML serialization
      content = `requestId: ${requestId}\nstatus: ${result.status}\ncertificateId: ${result.certificate?.certificateId ?? "none"}\ntotalDurationMs: ${result.trace.totalDurationMs}`;
    } else if (format === "markdown") {
      content = `# Generation Report\n\n**Request ID:** ${requestId}  \n**Status:** ${result.status}  \n**Certificate:** ${result.certificate?.certificateId ?? "none"}  \n**Duration:** ${result.trace.totalDurationMs}ms  \n**Steps:** ${result.trace.steps.length}  \n`;
    } else {
      // zip: return JSON representation (real ZIP would require archiver)
      content = JSON.stringify({ requestId, bundle: "zip-placeholder", result: { status: result.status } });
    }

    return { requestId, format, content, exportedAt: new Date().toISOString() };
  }

  /** Import a previously exported result bundle. */
  import(bundle: { requestId: string; result: StudioResult }): ImportBundle {
    this.importedResults.set(bundle.requestId, bundle.result);
    return { requestId: bundle.requestId, result: bundle.result, importedAt: new Date().toISOString() };
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  get notificationBus(): StudioNotificationBus {
    return this.notifications;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private toStudioResult(result: OrchestrationResult, cached: boolean, tags?: string[]): StudioResult {
    return {
      requestId: result.requestId,
      status: result.status as any,
      certificateId: result.certificate?.certificateId,
      explanation: result.strategy?.explanation ?? ({} as any),
      trace: result.trace,
      artifactCount: result.composition?.totalArtifacts ?? 0,
      repairCount: result.composition?.repairLog.length ?? 0,
      cached,
      tags,
      completedAt: new Date().toISOString()
    };
  }
}
