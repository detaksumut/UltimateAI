// src/execution/runtime/ExecutionRuntime.ts

import { ExecutionRequest } from "../models/ExecutionRequest";
import { ExecutionResult } from "../models/ExecutionResult";
import { ExecutionContext } from "../models/ExecutionContext";
import { TaskScheduler } from "../scheduler/TaskScheduler";
import { TaskExecutor } from "../executor/TaskExecutor";
import { RuntimeStateManager } from "../runtime/RuntimeStateManager";
import { IExecutionEventPublisher } from "../interfaces/IExecutionEventPublisher";
import { ExecutionEvent } from "../models/ExecutionEvent";
import { ExecutionState } from "../models/ExecutionState";
import { ExecutionMode } from "../models/ExecutionMode";
import { RetryStrategyFactory } from "../retry/factories/RetryStrategyFactory";
import { RetryContext } from "../retry/models/RetryContext";

/**
 * ExecutionRuntime manages the lifecycle of the execution context and orchestrates
 * the entire workflow using injected collaborators.
 */
export class ExecutionRuntime {
  /**
   * Construct the runtime with its required services.
   * All collaborators are injected – ExecutionRuntime itself holds no mutable state.
   */
  constructor(
    private readonly scheduler: TaskScheduler,
    private readonly executor: TaskExecutor,
    private readonly stateManager: RuntimeStateManager,
    private readonly eventPublisher?: IExecutionEventPublisher,
  ) {}

  /**
  * Create a fresh immutable ExecutionContext based on the incoming request.
  * For now we derive executionId and workflowId from the first task node (if any).
  * Variables and metadata are initialized empty; mutable state should be stored
  * in RuntimeStateManager (TODO for future).
  */
  private createExecutionContext(request: ExecutionRequest): ExecutionContext {
    const firstNodeId = request.graph.nodes[0]?.id ?? "unknown";
    return {
      executionId: `exec-${firstNodeId}`,
      workflowId: `wf-${firstNodeId}`,
      variables: new Map(),
      metadata: {},
      cancellationToken: { isCancellationRequested: false },
    };
  }

  /**
   * Orchestrates execution of the supplied request.
   * Sequential loop for Sprint 1 – parallel, retry, timeout, etc. are deferred to future sprints.
   */
  public async run(request: ExecutionRequest): Promise<ExecutionResult> {
    // Read and parse ExecutionOptions (Sprint 2 Milestone 1 configuration layer)
    const options = request.options ?? {};
    const executionMode = options.executionMode ?? ExecutionMode.Sequential;
    const failFast = options.failFast ?? false;
    const maxParallelism = options.maxParallelism ?? 1;

    // TODO Sprint 2 Milestone 3: Implement TimeoutPolicy evaluation and timeout abort triggers
    // TODO Sprint 2 Milestone 4: Implement Parallel ExecutionMode utilizing maxParallelism scheduler limits

    const retryStrategy = RetryStrategyFactory.create(options.retryPolicy);
    const context = this.createExecutionContext(request);
    const totalTasks = request.graph.nodes.length;
    let workflowSuccess = true;

    // Publish workflow start if event publisher is available
    this.eventPublisher?.publish({ type: "WorkflowStarted", timestamp: new Date(), executionId: context.executionId, payload: {} });

    // Main execution loop
    while (true) {
      // Check cancellation before fetching ready tasks
      if (context.cancellationToken.isCancellationRequested) {
        this.stateManager.setWorkflowState(ExecutionState.Cancelled);
        this.eventPublisher?.publish({ type: "WorkflowFailed", timestamp: new Date(), executionId: context.executionId, payload: {} });
        workflowSuccess = false;
        break;
      }

      const completedIds = this.stateManager.getCompletedTaskIds();
      const readyTasks = this.scheduler.getReadyTasks(request.graph, completedIds);

      if (readyTasks.length === 0) {
        // No more tasks to run – exit loop
        break;
      }

      // For sequential execution take the first ready task
      const task = readyTasks[0];

      // Publish task start
      this.eventPublisher?.publish({ type: "TaskStarted", timestamp: new Date(), executionId: context.executionId, payload: { taskId: task.id } });

      let attempt = 1;
      let finalResult;

      while (true) {
        finalResult = await this.executor.execute(task, context);

        if (finalResult.success) {
          break; // Success
        }

        // Handle retry evaluation
        const retryCtx: Readonly<RetryContext> = Object.freeze({
          currentAttempt: attempt,
          maxAttempts: options.retryPolicy?.maxAttempts ?? 1,
          lastError: finalResult.error,
        });

        if (retryStrategy.shouldRetry(retryCtx)) {
          attempt++;
          const delay = retryStrategy.nextDelay(retryCtx);
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          break; // Max attempts reached or retry not allowed
        }
      }

      const result = finalResult;

      // Update RuntimeStateManager with task outcome
      if (result.success) {
        this.stateManager.setTaskState(task.id, ExecutionState.Completed);
        this.stateManager.setTaskOutput(task.id, result.output);
        this.eventPublisher?.publish({ type: "TaskCompleted", timestamp: new Date(), executionId: context.executionId, payload: { taskId: task.id } });
      } else {
        this.stateManager.setTaskState(task.id, ExecutionState.Failed);
        // Guard: TaskExecutionResult.error is optional; narrow before passing.
        // TODO Sprint 2: Evaluate changing TaskExecutionResult to a discriminated union
        //   so that type narrowing is automatic and the contract is stronger.
        if (result.error) {
          this.stateManager.addError(result.error);
        }
        this.eventPublisher?.publish({ type: "TaskFailed", timestamp: new Date(), executionId: context.executionId, payload: { taskId: task.id } });
        workflowSuccess = false;
        
        if (failFast) {
          break;
        }
      }
    }

    // Determine final workflow state
    if (context.cancellationToken.isCancellationRequested) {
      this.stateManager.setWorkflowState(ExecutionState.Cancelled);
    } else if (workflowSuccess) {
      this.stateManager.setWorkflowState(ExecutionState.Completed);
    } else {
      this.stateManager.setWorkflowState(ExecutionState.Failed);
    }

    this.eventPublisher?.publish({ type: "WorkflowCompleted", timestamp: new Date(), executionId: context.executionId, payload: {} });

    // Build final ExecutionResult
    const result: ExecutionResult = {
      success: workflowSuccess && !context.cancellationToken.isCancellationRequested,
      outputs: this.stateManager.getTaskOutputs(),
      metrics: this.stateManager.getMetrics(totalTasks),
      errors: this.stateManager.getErrors(),
    };
    return result;
  }
}
