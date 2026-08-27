// ─── Generator pipeline imports ───────────────────────────────────────────────
import { RequirementInterpreter } from "../generator/RequirementInterpreter";
import { BlueprintPlanner } from "../generator/BlueprintPlanner";
import { PolicyEngine, PolicyEvaluateOptions } from "../generator/PolicyEngine";
import { KnowledgeBase } from "../generator/KnowledgeBase";
import { DecisionEngine, TechnologyStrategy } from "../generator/DecisionEngine";
import { SolutionArchitect, SolutionArchitecture } from "../generator/SolutionArchitect";
import { DagGeneratorPlanner } from "../generator/DagGeneratorPlanner";
import { GeneratorRegistry, ArtifactResult } from "../generator/GeneratorRegistry";
import { ArtifactComposer, ComposedArtifact } from "../generator/ArtifactComposer";
import { CertificationLayer, GenerationCertificate } from "../generator/CertificationLayer";

// ─── Orchestration infrastructure imports ─────────────────────────────────────
import { ObservabilityTracer, PipelineTrace } from "./ObservabilityTracer";
import { OrchestrationEventBus } from "./OrchestrationEventBus";
import { ExecutionStateStore } from "./ExecutionStateStore";
import { RecoveryManager, RecoveryPolicy } from "./RecoveryManager";
import { ExecutionScheduler, RequestPriority, ResourceBudget } from "./ExecutionScheduler";
import { OrchestrationManifest, DEFAULT_ORCHESTRATION_MANIFEST } from "./OrchestrationManifest";

// ─── Public contracts ─────────────────────────────────────────────────────────

export interface OrchestrationRequest {
  readonly requestId: string;
  readonly naturalLanguage: string;
  readonly priority?: RequestPriority;
  readonly resourceBudget?: Partial<ResourceBudget>;
  readonly options?: PolicyEvaluateOptions & { dryRun?: boolean };
}

export type OrchestrationStatus = "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED";

export interface OrchestrationResult {
  readonly requestId: string;
  readonly status: OrchestrationStatus;
  readonly certificate: GenerationCertificate | null;
  readonly composition: ComposedArtifact | null;
  readonly strategy: TechnologyStrategy | null;
  readonly architecture: SolutionArchitecture | null;
  readonly trace: PipelineTrace;
  readonly eventLog: ReturnType<OrchestrationEventBus["getLog"]>;
  readonly failureReason?: string;
}

// ─── Orchestrator Engine ──────────────────────────────────────────────────────

export class OrchestratorEngine {
  private readonly manifest: OrchestrationManifest;
  private readonly eventBus: OrchestrationEventBus;
  readonly stateStore: ExecutionStateStore;
  readonly scheduler: ExecutionScheduler;

  // Pipeline components
  private readonly interpreter: RequirementInterpreter;
  private readonly planner: BlueprintPlanner;
  private readonly policyEngine: PolicyEngine;
  private readonly knowledgeBase: KnowledgeBase;
  private readonly decisionEngine: DecisionEngine;
  private readonly architect: SolutionArchitect;
  private readonly dagPlanner: DagGeneratorPlanner;
  private readonly registry: GeneratorRegistry;
  private readonly composer: ArtifactComposer;
  private readonly certifier: CertificationLayer;

  constructor(manifest: OrchestrationManifest = DEFAULT_ORCHESTRATION_MANIFEST) {
    this.manifest = manifest;
    this.eventBus = new OrchestrationEventBus();
    this.stateStore = new ExecutionStateStore();
    this.scheduler = new ExecutionScheduler(this.stateStore);

    // Instantiate pipeline
    this.interpreter   = new RequirementInterpreter();
    this.planner       = new BlueprintPlanner();
    this.policyEngine  = new PolicyEngine();
    this.knowledgeBase = new KnowledgeBase();
    this.decisionEngine = new DecisionEngine(this.policyEngine, this.knowledgeBase);
    this.architect     = new SolutionArchitect();
    this.dagPlanner    = new DagGeneratorPlanner();
    this.registry      = new GeneratorRegistry();
    this.composer      = new ArtifactComposer();
    this.certifier     = new CertificationLayer();
  }

  getManifest(): OrchestrationManifest {
    return this.manifest;
  }

  getEventBus(): OrchestrationEventBus {
    return this.eventBus;
  }

  /**
   * Primary entry point. Enqueues and immediately executes an OrchestrationRequest.
   * Returns a fully structured OrchestrationResult with trace, event log, and certificate.
   */
  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const { requestId, naturalLanguage, priority = "normal", resourceBudget = {}, options = {} } = request;

    // Enqueue in scheduler
    this.scheduler.enqueue(requestId, priority, resourceBudget);

    // Check budget
    const budget = this.scheduler.getQueueSnapshot().find(r => r.requestId === requestId)?.resourceBudget
      ?? { maxTimeMs: 120_000, maxMemoryMb: 512 };

    const tracer = new ObservabilityTracer(requestId);
    const recovery = new RecoveryManager(this.manifest.recoveryPolicies[0]);
    const startWall = Date.now();

    let strategy: TechnologyStrategy | null = null;
    let architecture: SolutionArchitecture | null = null;
    let composition: ComposedArtifact | null = null;
    let certificate: GenerationCertificate | null = null;

    const checkCancelled = () => {
      if (this.scheduler.isCancelled(requestId)) {
        throw new Error("CANCELLED");
      }
    };

    const checkBudget = () => {
      if (Date.now() - startWall > budget.maxTimeMs) {
        throw new Error(`Resource budget exceeded: max ${budget.maxTimeMs}ms`);
      }
    };

    this.stateStore.transition(requestId, "running", { incrementAttempt: true });

    try {
      // ── Step 1: Interpret Requirement ──────────────────────────────────────
      tracer.startStep("RequirementInterpreter");
      checkCancelled();
      const reqModel = await recovery.execute(async () => this.interpreter.interpret(naturalLanguage));
      tracer.endStep("RequirementInterpreter", "success");
      this.eventBus.emit("RequirementReady", requestId, { scale: reqModel.value.scale, domain: reqModel.value.domain });

      // ── Step 2: Blueprint Planning ─────────────────────────────────────────
      tracer.startStep("BlueprintPlanner");
      checkCancelled(); checkBudget();
      const blueprint = await recovery.execute(async () => this.planner.plan(reqModel.value));
      tracer.endStep("BlueprintPlanner", "success");
      this.eventBus.emit("BlueprintReady", requestId, { hash: blueprint.value.blueprintHash });

      // ── Step 3: Decision (Policy + Knowledge + Explainability) ─────────────
      tracer.startStep("DecisionEngine");
      checkCancelled(); checkBudget();
      const strategyResult = await recovery.execute(async () =>
        this.decisionEngine.decide(reqModel.value, options)
      );
      strategy = strategyResult.value;
      tracer.endStep("DecisionEngine", "success");
      this.eventBus.emit("StrategySelected", requestId, {
        pattern: strategy.pattern,
        database: strategy.database,
        explanation: strategy.explanation
      });

      // ── Step 4: Solution Architecture ──────────────────────────────────────
      tracer.startStep("SolutionArchitect");
      checkCancelled(); checkBudget();
      const archResult = await recovery.execute(async () => this.architect.design(strategy!));
      architecture = archResult.value;
      tracer.endStep("SolutionArchitect", "success");
      this.eventBus.emit("ArchitectureReady", requestId, {
        serviceCount: architecture.services.length,
        hash: architecture.architectureHash
      });

      // ── Step 5: DAG Planning ───────────────────────────────────────────────
      tracer.startStep("DagGeneratorPlanner");
      checkCancelled(); checkBudget();
      const dagResult = await recovery.execute(async () => this.dagPlanner.plan(architecture!));
      const dag = dagResult.value;
      tracer.endStep("DagGeneratorPlanner", "success");
      this.eventBus.emit("DagReady", requestId, { taskCount: dag.tasks.length });

      // ── Step 6: Artifact Generation ────────────────────────────────────────
      tracer.startStep("GeneratorRegistry");
      checkCancelled(); checkBudget();
      const artifactsResult = await recovery.execute(async () => {
        const results: ArtifactResult[] = [];
        for (const task of dag.tasks) {
          checkCancelled();
          results.push(this.registry.execute(task));
        }
        return results;
      });
      const rawArtifacts = artifactsResult.value;
      tracer.endStep("GeneratorRegistry", "success", { generatorId: "multi", repairCount: 0 });
      this.eventBus.emit("ArtifactsGenerated", requestId, { count: rawArtifacts.length });

      // ── Step 7: Composition + Auto-Repair ──────────────────────────────────
      tracer.startStep("ArtifactComposer");
      checkCancelled(); checkBudget();
      const compositionResult = await recovery.execute(async () => this.composer.compose(rawArtifacts));
      composition = compositionResult.value;
      tracer.endStep("ArtifactComposer", "success", { repairCount: composition.repairLog.length });
      this.eventBus.emit("CompositionReady", requestId, {
        hash: composition.compositionHash,
        repairs: composition.repairLog.length
      });

      // ── Step 8: Certification ──────────────────────────────────────────────
      tracer.startStep("CertificationLayer");
      checkCancelled();
      const certResult = await recovery.execute(async () => this.certifier.certify(composition!));
      certificate = certResult.value;
      tracer.endStep("CertificationLayer", certificate.status === "CERTIFIED" ? "success" : "failed");
      this.eventBus.emit("Certified", requestId, {
        certificateId: certificate.certificateId,
        status: certificate.status
      });

      const finalStatus = certificate.status === "CERTIFIED" ? "SUCCESS" : "PARTIAL";
      this.stateStore.transition(requestId, "completed", { result: certificate });

      return {
        requestId,
        status: finalStatus,
        certificate,
        composition,
        strategy,
        architecture,
        trace: tracer.finalize("completed"),
        eventLog: this.eventBus.getLog(requestId)
      };

    } catch (err: any) {
      const msg: string = err instanceof Error ? err.message : String(err);

      if (msg === "CANCELLED") {
        this.stateStore.transition(requestId, "cancelled");
        this.eventBus.emit("PipelineCancelled", requestId);
        const trace = tracer.finalize("failed", "Cancelled");
        return { requestId, status: "CANCELLED", certificate: null, composition, strategy, architecture, trace, eventLog: this.eventBus.getLog(requestId), failureReason: "Cancelled" };
      }

      this.stateStore.transition(requestId, "failed", { failureReason: msg });
      this.eventBus.emit("PipelineFailed", requestId, { reason: msg });
      const trace = tracer.finalize("failed", msg);
      return { requestId, status: "FAILED", certificate: null, composition, strategy, architecture, trace, eventLog: this.eventBus.getLog(requestId), failureReason: msg };
    }
  }
}
