// src/production/kernel/ProductionKernel.ts

import { WorkflowEngine } from "../workflow/engine/WorkflowEngine";
import { WorkflowBuilder } from "../workflow/builder/WorkflowBuilder";
import { RuntimeCapability } from "../runtime/contracts/RuntimeCapability";
import { TraceChain } from "../runtime/contracts/TraceChain";
import { IRuntimeContext } from "../runtime/contracts/IRuntimeContext";
import { KernelExecutionReport } from "./KernelExecutionReport";
import { ExecutionContext } from "../workflow/contracts/ExecutionContext";

/**
 * Principle 40: The Kernel Owns the Primary Cognitive Loop.
 * Principle 42: The Kernel Orchestrates, Never Thinks.
 */
export class ProductionKernel {
  constructor(private readonly workflowEngine: WorkflowEngine) {}

  /**
   * Executes the full closed-loop cognitive pipeline for a user request.
   */
  async processUserRequest(userRequest: string, trace: TraceChain): Promise<KernelExecutionReport> {
    const startedAt = Date.now();
    const runtimeSequence: string[] = [];
    const executionTimes: Record<string, number> = {};
    const warnings: string[] = [];
    
    // Create the global context
    const runtimeContext: IRuntimeContext = { trace, timestamp: startedAt };
    const executionContext: ExecutionContext = {
      traceId: trace.traceId,
      workflowId: "CognitiveLoop-v1",
      runtimeContext
    };

    // Construct standard Cognitive Workflow using Builder
    const workflow = new WorkflowBuilder("CognitiveLoop-v1")
      .withMetadata("Cognitive Loop", "1.0.0", "The primary cognitive execution pipeline")
      .addStage("Preparation", stage => stage
        .addJob("PlanAndReason", job => job
          .addTask("planning", RuntimeCapability.PLANNING)
          .addTask("reasoning-pre", RuntimeCapability.REASONING, t => t.dependsOn("planning"))
        )
      )
      .addStage("Action", stage => stage
        .addJob("Execute", job => job
          .addTask("execution", RuntimeCapability.EXECUTION)
        )
      )
      .addStage("Synthesis", stage => stage
        // Knowledge and Learning can potentially run in parallel if they don't depend on each other,
        // but traditionally learning depends on knowledge. Let's make them parallel jobs to demonstrate.
        .addJob("KnowledgeJob", job => job.addTask("knowledge", RuntimeCapability.KNOWLEDGE))
        .addJob("LearningJob", job => job.addTask("learning", RuntimeCapability.LEARNING))
      )
      .addStage("Evolution", stage => stage
        .addJob("EvolveAndReason", job => job
          .addTask("evolution", RuntimeCapability.EVOLUTION)
          .addTask("reasoning-post", RuntimeCapability.REASONING, t => t.dependsOn("evolution"))
        )
      )
      .addStage("Finalization", stage => stage
        .addJob("Deliver", job => job
          .addTask("delivery", RuntimeCapability.DELIVERY)
        )
      )
      .build();

    try {
      await this.workflowEngine.execute(workflow, executionContext);

      return {
        traceId: trace.traceId,
        runtimeSequence, // Deprecated in Workflow model, kept for backwards compatibility in report
        executionTimes, // Deprecated
        warnings,
        finalStatus: "SUCCESS",
        totalDurationMs: Date.now() - startedAt
      };
      
    } catch (error: any) {
      warnings.push(`Workflow interrupted: ${error.message}`);
      return {
        traceId: trace.traceId,
        runtimeSequence,
        executionTimes,
        warnings,
        finalStatus: "FAILURE",
        totalDurationMs: Date.now() - startedAt
      };
    }
  }
}
