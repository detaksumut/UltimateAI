// src/production/intelligence/pipeline/IntelligencePipelineImpl.ts

import { IntelligencePipeline } from "../IntelligencePipeline";
import { PipelinePolicy, DEFAULT_PIPELINE_POLICY } from "./PipelinePolicy";
import { PipelineResult, PipelineMetrics } from "./PipelineResult";
import { PipelineTerminationReason } from "./PipelineTerminationReason";
import { TraceStep, PipelineTrace } from "./PipelineTrace";
import { IntelligenceContext } from "../IntelligenceContext";

// Engine Imports
import { ReasoningEngine } from "../ReasoningEngine";
import { PlanningEngine } from "../PlanningEngine";
import { ExecutionValidator } from "../validation/ExecutionValidator";
import { CriticEngine } from "../CriticEngine";
import { ReflectionEngine } from "../ReflectionEngine";
import { RepairEngine } from "../RepairEngine";

import { Execution } from "../../kernel/execution/Execution";
import { ReflectionDecision } from "../reflection/ReflectionDecision";
import { ExecutionChangeSet } from "../repair/ExecutionChangeSet";

/**
 * Concrete implementation of the IntelligencePipeline.
 * Orchestrates the full End-to-End pipeline and manages the Quality Loop.
 */
export class IntelligencePipelineImpl implements IntelligencePipeline {
  constructor(
    private readonly reasoningEngine: ReasoningEngine,
    private readonly planningEngine: PlanningEngine,
    private readonly executionValidator: ExecutionValidator,
    private readonly criticEngine: CriticEngine,
    private readonly reflectionEngine: ReflectionEngine,
    private readonly repairEngine: RepairEngine
  ) {}

  public async execute(
    userRequest: string,
    policy: PipelinePolicy = DEFAULT_PIPELINE_POLICY
  ): Promise<PipelineResult> {
    
    const startTime = Date.now();
    const traceSteps: TraceStep[] = [];
    const metrics: Record<string, number> = {
      reasoningTimeMs: 0, planningTimeMs: 0, validationTimeMs: 0, 
      criticTimeMs: 0, reflectionTimeMs: 0, repairTimeMs: 0
    };
    
    const context: IntelligenceContext = { 
      cycleId: `cycle-${Date.now()}`, 
      userRequest,
      goals: [],
      decisionHistory: [],
      runtimeOptions: {} 
    };

    // --- Helper to track time ---
    const runStep = async <T>(
      stepName: string, 
      metricKey: keyof PipelineMetrics | null, 
      fn: () => Promise<T>
    ): Promise<T> => {
      const stepStart = Date.now();
      try {
        const result = await fn();
        const duration = Date.now() - stepStart;
        if (metricKey) metrics[metricKey as string] += duration;
        traceSteps.push({ stepName, startedAt: new Date(stepStart), finishedAt: new Date(), durationMs: duration, status: "SUCCESS" });
        return result;
      } catch (err) {
        traceSteps.push({ stepName, startedAt: new Date(stepStart), finishedAt: new Date(), durationMs: Date.now() - stepStart, status: "FAILED" });
        throw err;
      }
    };

    try {
      // 1. REASONING
      const intentDecision = await runStep("Reasoning", "reasoningTimeMs", () => 
        this.reasoningEngine.analyzeRequest(context)
      );
      const intent = intentDecision.payload;

      // 2. PLANNING
      const planningDecision = await runStep("Planning", "planningTimeMs", () => 
        this.planningEngine.generateExecutionPlan(context, intentDecision)
      );
      let currentExecution = planningDecision.payload;

      const allReflectionDecisions: ReflectionDecision[] = [];
      const allChangeSets: ExecutionChangeSet[] = [];
      let previousScore = 0;

      // 3. THE QUALITY LOOP
      for (let i = 0; i < policy.maxIterations; i++) {
        // Validation
        const valContext = { execution: currentExecution, context: { id: "mock-prod" } as any, availableWorkers: [] };
        const valReport = await runStep(`Validation (Iter ${i+1})`, "validationTimeMs", async () => 
          this.executionValidator.validate(valContext)
        );

        if (!valReport.isValid && policy.validationRequired) {
          // If structure is broken, fail immediately. Repair doesn't fix structure automatically.
          return this.buildResult(currentExecution, valReport, null, allReflectionDecisions, allChangeSets, metrics, traceSteps, PipelineTerminationReason.VALIDATION_FAILED);
        }

        // Critic
        const criticDecision = await runStep(`Critic (Iter ${i+1})`, "criticTimeMs", () => 
          this.criticEngine.evaluateExecution(context, currentExecution)
        );
        const evaluation = criticDecision.payload;

        // Check Quality Threshold
        if (evaluation.overallScore >= policy.qualityThreshold) {
          return this.buildResult(currentExecution, valReport, evaluation, allReflectionDecisions, allChangeSets, metrics, traceSteps, PipelineTerminationReason.QUALITY_THRESHOLD_REACHED);
        }

        // Check Min Improvement
        if (i > 0 && (evaluation.overallScore - previousScore) < policy.minImprovement) {
          return this.buildResult(currentExecution, valReport, evaluation, allReflectionDecisions, allChangeSets, metrics, traceSteps, PipelineTerminationReason.NO_IMPROVEMENT);
        }
        previousScore = evaluation.overallScore;

        // Reflection
        const reflectionDecision = await runStep(`Reflection (Iter ${i+1})`, "reflectionTimeMs", () => 
          this.reflectionEngine.evaluateRecommendations(context, intent, evaluation.recommendations, policy.decisionPolicy)
        );
        const decisions = reflectionDecision.payload;
        allReflectionDecisions.push(...decisions);

        // Filter actionable decisions
        const actionable = decisions.filter(d => d.action === "ACCEPT" || d.action === "MODIFIED");
        if (actionable.length === 0) {
          // If reflection accepts nothing, we are done.
          return this.buildResult(currentExecution, valReport, evaluation, allReflectionDecisions, allChangeSets, metrics, traceSteps, PipelineTerminationReason.SUCCESS);
        }

        // Repair
        const repairDecision = await runStep(`Repair (Iter ${i+1})`, "repairTimeMs", () => 
          this.repairEngine.generateRepairPlan(context, currentExecution, actionable)
        );
        currentExecution = repairDecision.payload.execution;
        allChangeSets.push(repairDecision.payload.changeSet);
      }

      // 4. MAX ITERATIONS REACHED
      // Final Validation
      const finalValContext = { execution: currentExecution, context: { id: "mock-prod" } as any, availableWorkers: [] };
      const finalValReport = await runStep("Final Validation", "validationTimeMs", async () => 
        this.executionValidator.validate(finalValContext)
      );

      return this.buildResult(currentExecution, finalValReport, null, allReflectionDecisions, allChangeSets, metrics, traceSteps, PipelineTerminationReason.MAX_ITERATIONS);

    } catch (err) {
      return this.buildResult(null, null, null, [], [], metrics, traceSteps, PipelineTerminationReason.FATAL_ERROR);
    }
  }

  private buildResult(
    execution: Execution | null,
    valReport: any,
    criticEvaluation: any,
    reflectionDecisions: ReflectionDecision[],
    changeSets: ExecutionChangeSet[],
    metrics: Record<string, number>,
    traceSteps: TraceStep[],
    reason: PipelineTerminationReason
  ): PipelineResult {
    const finalMetrics: PipelineMetrics = {
      reasoningTimeMs: metrics.reasoningTimeMs,
      planningTimeMs: metrics.planningTimeMs,
      validationTimeMs: metrics.validationTimeMs,
      criticTimeMs: metrics.criticTimeMs,
      reflectionTimeMs: metrics.reflectionTimeMs,
      repairTimeMs: metrics.repairTimeMs,
      totalTimeMs: Object.values(metrics).reduce((a, b) => a + b, 0)
    };
    
    return {
      execution,
      validationReport: valReport,
      criticEvaluation,
      reflectionDecisions,
      changeSets,
      metrics: finalMetrics,
      trace: {
        id: `trace-${Date.now()}`,
        correlationId: execution ? execution.correlationId : "unknown",
        steps: traceSteps,
        totalDurationMs: finalMetrics.totalTimeMs
      },
      terminationReason: reason
    };
  }
}
