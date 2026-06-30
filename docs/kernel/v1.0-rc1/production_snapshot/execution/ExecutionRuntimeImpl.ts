// src/production/execution/ExecutionRuntimeImpl.ts

import { IRuntime } from "../runtime/contracts/IRuntime";
import { RuntimeManifest } from "../runtime/registry/RuntimeManifest";
import { RuntimeCapability } from "../runtime/contracts/RuntimeCapability";
import { IRuntimeEventBus } from "../runtime/events/RuntimeEventBus";
import { RuntimeLifecycle } from "../runtime/contracts/RuntimeLifecycle";

import { IExecutionContext } from "./contracts/IExecutionContext";
import { ExecutionResult } from "./contracts/ExecutionResult";
import { WorkflowStatus } from "./runner/WorkflowStatus";

import { IExecutionPlanner } from "./planner/IExecutionPlanner";
import { IWorkflowRunner } from "./runner/IWorkflowRunner";
import { IExecutionMonitor } from "./monitor/IExecutionMonitor";
import { IExecutionLogger } from "./logger/IExecutionLogger";

export class ExecutionRuntimeImpl implements IRuntime<IExecutionContext, ExecutionResult> {
  readonly manifest: RuntimeManifest = {
    id: "execution-runtime-v1",
    name: "UltimateAI Execution Runtime",
    version: "1.0.0",
    author: "System",
    description: "Executes blueprints",
    capabilities: [RuntimeCapability.EXECUTION],
    requiredCapabilities: [],
    contractVersion: "1.0",
    startupPriority: 2,
    healthCheck: async () => true
  };
  
  state: RuntimeLifecycle = RuntimeLifecycle.READY;

  constructor(
    private readonly planner: IExecutionPlanner,
    private readonly runner: IWorkflowRunner,
    private readonly monitor: IExecutionMonitor,
    private readonly logger: IExecutionLogger,
    private readonly eventBus: IRuntimeEventBus
  ) {}

  async execute(context: IExecutionContext): Promise<ExecutionResult> {
    this.state = RuntimeLifecycle.RUNNING;
    const startedAt = Date.now();
    const warnings: string[] = [];
    
    // 1. Initialize Logging
    const logId = this.logger.openLog(context.trace.requestId, context.blueprint.blueprintId);

    try {
      // 2. Tactical Planning (Principle 35)
      const taskGraph = await this.planner.planTactics(context.blueprint);
      this.emitEvent("ExecutionPlanned", context, { graphId: taskGraph.graphId });

      // 3. Workflow Execution
      this.logger.append(logId, { type: "TASK_STARTED", entityId: taskGraph.graphId, payload: { status: "RUNNING" } });
      
      const workflowState = await this.runner.run(taskGraph);
      
      this.logger.append(logId, { type: "WORKFLOW_COMPLETED", entityId: taskGraph.graphId, payload: { state: workflowState } });
      this.emitEvent("ExecutionCompleted", context, { state: workflowState });

      this.state = RuntimeLifecycle.READY;
      // 4. Return Output
      return {
        runtimeId: this.manifest.id,
        startedAt,
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        status: workflowState.status === WorkflowStatus.COMPLETED ? "SUCCESS" : "PARTIAL",
        warnings,
        payload: {
          identity: { artifactId: `exec-res-${Date.now()}`, createdAt: Date.now() },
          trace: context.trace,
          workflowStatus: workflowState.status,
          completedTasks: workflowState.completedTasks.length,
          failedTasks: workflowState.failedTasks.length,
          executionLogId: logId,
          artifactIds: [] // Sourced from ArtifactStore internally during run
        }
      };

    } catch (error: any) {
      // Handle severe infrastructure or policy failures
      this.logger.append(logId, { type: "WORKFLOW_FAILED", entityId: "workflow", payload: { error: error.message } });
      this.emitEvent("ExecutionFailed", context, { error: error.message });

      this.state = RuntimeLifecycle.READY;
      return {
        runtimeId: this.manifest.id,
        startedAt,
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        status: "FAILURE",
        warnings: [...warnings, error.message],
        payload: {
          identity: { artifactId: `exec-res-fail-${Date.now()}`, createdAt: Date.now() },
          trace: context.trace,
          workflowStatus: WorkflowStatus.FAILED,
          completedTasks: 0,
          failedTasks: 0,
          executionLogId: logId,
          artifactIds: []
        }
      };
    }
  }

  private emitEvent(eventType: string, context: IExecutionContext, payload: any) {
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
