import { IWorkflowRegistry, IWorkflowEventBus } from '../interfaces';
import { WorkflowStateMachine } from '../state/WorkflowStateMachine';
import { RetryExecutor } from '../retry/RetryExecutor';
import { ProgressReporter } from '../progress/ProgressReporter';
import { CancellationManager } from '../cancellation/CancellationManager';
import { WorkflowContext } from '../types/WorkflowContext';
import { WorkflowResult } from '../types/WorkflowResult';
import { Result, ok, err } from '../../core/types/Result';
import { StepExecutionPipeline } from '../pipeline/StepExecutionPipeline';
import { HandlerContext } from '../types/HandlerContext';
import { WorkflowExecution } from '../types/WorkflowExecution';
import { WorkflowEvent } from '../types/WorkflowEvent';
import { WorkflowState } from '../types/WorkflowState';

/**
 * WorkflowRunner – coordinates execution of a workflow definition.
 * Delegates all step execution behaviors to the StepExecutionPipeline.
 */
export class WorkflowRunner {
  constructor(
    private readonly registry: IWorkflowRegistry,
    private readonly stateMachine: WorkflowStateMachine,
    private readonly eventBus: IWorkflowEventBus,
    private readonly retryExecutor: RetryExecutor,
    private readonly progressReporter: ProgressReporter,
    private readonly cancellationManager: CancellationManager,
    private readonly pipeline: StepExecutionPipeline,
  ) {}

  /**
   * Execute a workflow by its definition id.
   */
  async run(
    definitionId: string,
    context: WorkflowContext,
    abortSignal?: AbortSignal,
  ): Promise<Result<WorkflowResult, Error>> {
    // Retrieve workflow definition.
    const definition = this.registry.get(definitionId);
    if (!definition) {
      return err(new Error(`Workflow definition ${definitionId} not found`));
    }

    // Attach cancellation handling.
    if (abortSignal) {
      if (abortSignal.aborted) {
        this.cancellationManager.abort();
      } else {
        abortSignal.addEventListener('abort', () => {
          this.cancellationManager.abort();
        });
      }
    }

    const execution: WorkflowExecution = {
      executionId: `exec-${Math.random().toString(36).substring(2, 9)}`,
      workflowId: definition.id,
      startedAt: new Date(),
      state: 'Pending'
    };

    let currentState = WorkflowState.Pending;

    // Emit start event.
    const startEvent: WorkflowEvent = {
      id: `evt-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      executionId: execution.executionId,
      workflowId: definition.id,
      type: 'workflow.started',
      payload: { definitionId, context }
    };
    this.eventBus.publish(startEvent);
    currentState = this.stateMachine.transition(currentState, startEvent);
    execution.state = currentState as any;

    let finalOutput: any = null;
    let stepIndex = 0;

    for (const step of definition.steps) {
      // Check cancellation before each step
      if (abortSignal?.aborted || this.cancellationManager.signal.aborted) {
        const cancelEvent: WorkflowEvent = {
          id: `evt-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date(),
          executionId: execution.executionId,
          workflowId: definition.id,
          type: 'workflow.cancelled',
          payload: { reason: 'Cancellation requested' }
        };
        this.eventBus.publish(cancelEvent);
        currentState = this.stateMachine.transition(currentState, cancelEvent);
        execution.state = currentState as any;
        execution.finishedAt = new Date();
        execution.durationMs = execution.finishedAt.getTime() - execution.startedAt.getTime();
        return err(new Error('Workflow execution cancelled'));
      }

      // Report progress
      const progress = Math.round((stepIndex / definition.steps.length) * 100);
      this.progressReporter.report(progress);

      const handlerContext: HandlerContext = {
        step,
        execution,
        definition,
        signal: abortSignal || this.cancellationManager.signal,
        metadata: { ...context.metadata }
      };

      // Execute step via step execution pipeline
      const stepResult = await this.pipeline.execute(handlerContext);

      if (!stepResult.ok) {
        const failedEvent: WorkflowEvent = {
          id: `evt-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date(),
          executionId: execution.executionId,
          workflowId: definition.id,
          type: 'workflow.failed',
          payload: { error: stepResult.error, stepId: step.id }
        };
        this.eventBus.publish(failedEvent);
        currentState = this.stateMachine.transition(currentState, failedEvent);
        execution.state = currentState as any;
        execution.finishedAt = new Date();
        execution.durationMs = execution.finishedAt.getTime() - execution.startedAt.getTime();
        execution.error = stepResult.error;

        this.progressReporter.report(0);
        return err(stepResult.error);
      }

      // Step completed event
      const stepCompletedEvent: WorkflowEvent = {
        id: `evt-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date(),
        executionId: execution.executionId,
        workflowId: definition.id,
        type: 'step.completed',
        payload: { stepId: step.id, result: stepResult.value }
      };
      this.eventBus.publish(stepCompletedEvent);

      finalOutput = stepResult.value;
      stepIndex++;
    }

    // Workflow completed
    execution.finishedAt = new Date();
    execution.durationMs = execution.finishedAt.getTime() - execution.startedAt.getTime();

    const workflowResult: WorkflowResult = {
      resultId: `res-${Math.random().toString(36).substring(2, 9)}`,
      executionId: execution.executionId,
      success: true,
      output: finalOutput
    };

    const completedEvent: WorkflowEvent = {
      id: `evt-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      executionId: execution.executionId,
      workflowId: definition.id,
      type: 'workflow.completed',
      payload: { result: workflowResult }
    };
    this.eventBus.publish(completedEvent);
    currentState = this.stateMachine.transition(currentState, completedEvent);
    execution.state = currentState as any;

    this.progressReporter.report(100);

    return ok(workflowResult);
  }
}
