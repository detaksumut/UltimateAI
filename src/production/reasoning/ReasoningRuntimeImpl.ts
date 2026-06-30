// src/production/reasoning/ReasoningRuntimeImpl.ts

import { IRuntime } from "../runtime/contracts/IRuntime";
import { RuntimeManifest } from "../runtime/registry/RuntimeManifest";
import { RuntimeCapability } from "../runtime/contracts/RuntimeCapability";
import { IRuntimeEventBus } from "../runtime/events/RuntimeEventBus";
import { RuntimeLifecycle } from "../runtime/contracts/RuntimeLifecycle";

import { IReasoningContext } from "./contracts/IReasoningContext";
import { ReasoningResult } from "./contracts/ReasoningResult";

import { IKnowledgeProvider } from "./retrieval/IKnowledgeProvider";
import { IContextBuilder } from "./context/IContextBuilder";
import { IReasoningPlanner } from "./planner/IReasoningPlanner";
import { IReasoningEngine } from "./engine/IReasoningEngine";
import { IReasoningValidator } from "./validator/IReasoningValidator";

export class ReasoningRuntimeImpl implements IRuntime<IReasoningContext, ReasoningResult> {
  readonly manifest: RuntimeManifest = {
    id: "reasoning-runtime-v1",
    name: "UltimateAI Reasoning Runtime",
    version: "1.0.0",
    author: "System",
    description: "Advises based on knowledge",
    capabilities: [RuntimeCapability.REASONING],
    requiredCapabilities: [],
    contractVersion: "1.0",
    startupPriority: 3,
    healthCheck: async () => true
  };
  
  state: RuntimeLifecycle = RuntimeLifecycle.READY;

  constructor(
    private readonly provider: IKnowledgeProvider,
    private readonly builder: IContextBuilder,
    private readonly planner: IReasoningPlanner,
    private readonly engine: IReasoningEngine,
    private readonly validator: IReasoningValidator,
    private readonly eventBus: IRuntimeEventBus
  ) {}

  async execute(context: IReasoningContext): Promise<ReasoningResult> {
    this.state = RuntimeLifecycle.RUNNING;
    const startedAt = Date.now();
    const warnings: string[] = [];

    // Stage 1: Retrieval
    const bundle = await this.provider.provide(context);
    this.emitEvent("KnowledgeRetrieved", context, { 
      primaryCount: bundle.primaryKnowledge.length,
      contextualCount: bundle.contextualKnowledge.length
    });

    // Stage 2: Context Building (Principle 32)
    const prompt = await this.builder.build(context, bundle);

    // Stage 3: Planning
    const plan = await this.planner.plan(prompt);
    this.emitEvent("ReasoningPlanned", context, { planId: plan.planId });

    // Stage 4: AI Engine
    const conclusion = await this.engine.reason(prompt, plan);

    // Stage 5: Grounding Validation
    const report = await this.validator.validateGrounding(conclusion, bundle);
    warnings.push(...report.warnings);

    if (!report.isValid) {
      this.state = RuntimeLifecycle.READY;
      // In a real system, we might loop back or fail. For now, we return failure status.
      return {
        runtimeId: this.manifest.id,
        startedAt,
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        status: "FAILURE",
        warnings: [...warnings, "Reasoning conclusion failed grounding validation."],
        payload: {
          identity: { artifactId: `reas-res-fail-${Date.now()}`, createdAt: Date.now() },
          trace: context.trace,
          conclusion,
          usedKnowledge: bundle.primaryKnowledge, // Simplified
          usedRelations: bundle.relations,
          validatorWarnings: report.warnings
        }
      };
    }

    this.emitEvent("ReasoningCompleted", context, { confidence: conclusion.confidence });

    this.state = RuntimeLifecycle.READY;
    // Success
    return {
      runtimeId: this.manifest.id,
      startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      status: "SUCCESS",
      warnings,
      payload: {
        identity: { artifactId: `reas-res-${Date.now()}`, createdAt: Date.now() },
        trace: context.trace,
        conclusion,
        usedKnowledge: bundle.primaryKnowledge,
        usedRelations: bundle.relations,
        validatorWarnings: report.warnings
      }
    };
  }

  private emitEvent(eventType: string, context: IReasoningContext, payload: any) {
    this.eventBus.publish({
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      correlationId: context.trace.correlationId,
      executionId: context.trace.requestId,
      eventType,
      runtimeId: this.manifest.id,
      timestamp: Date.now(),
      payload
    });
  }
}
