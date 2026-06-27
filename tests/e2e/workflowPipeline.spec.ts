import { test, expect } from '@playwright/test';
import { WorkflowRegistry } from '../../src/engine/workflow/registry/WorkflowRegistry';
import { WorkflowStateMachine } from '../../src/engine/workflow/state/WorkflowStateMachine';
import { WorkflowEventBus } from '../../src/engine/workflow/events/WorkflowEventBus';
import { RetryExecutor } from '../../src/engine/workflow/retry/RetryExecutor';
import { ProgressReporter } from '../../src/engine/workflow/progress/ProgressReporter';
import { CancellationManager } from '../../src/engine/workflow/cancellation/CancellationManager';
import { WorkflowRunner } from '../../src/engine/workflow/runner/WorkflowRunner';
import { HandlerRegistry } from '../../src/engine/workflow/step/HandlerRegistry';
import { StepResolver } from '../../src/engine/workflow/step/StepResolver';
import { StepExecutionPipeline } from '../../src/engine/workflow/pipeline/StepExecutionPipeline';
import { LoggingStage } from '../../src/engine/workflow/pipeline/stages/LoggingStage';
import { MetricsStage } from '../../src/engine/workflow/pipeline/stages/MetricsStage';
import { TelemetryStage } from '../../src/engine/workflow/pipeline/stages/TelemetryStage';
import { AuthenticationStage } from '../../src/engine/workflow/pipeline/stages/AuthenticationStage';
import { CapabilityValidationStage } from '../../src/engine/workflow/pipeline/stages/CapabilityValidationStage';
import { RetryStage } from '../../src/engine/workflow/pipeline/stages/RetryStage';
import { HandlerInvocationStage } from '../../src/engine/workflow/pipeline/stages/HandlerInvocationStage';
import { IStepHandler } from '../../src/engine/workflow/step/IStepHandler';
import { HandlerContext } from '../../src/engine/workflow/types/HandlerContext';
import { Result, ok, err } from '../../src/engine/core/types/Result';

test.describe('Step Execution Pipeline Unit and Integration Tests', () => {
  let registry: WorkflowRegistry;
  let stateMachine: WorkflowStateMachine;
  let eventBus: WorkflowEventBus;
  let retryExecutor: RetryExecutor;
  let progressReporter: ProgressReporter;
  let cancellationManager: CancellationManager;
  let handlerRegistry: HandlerRegistry;
  let stepResolver: StepResolver;

  test.beforeEach(() => {
    registry = new WorkflowRegistry();
    stateMachine = new WorkflowStateMachine();
    eventBus = new WorkflowEventBus();
    retryExecutor = new RetryExecutor();
    progressReporter = new ProgressReporter();
    cancellationManager = new CancellationManager();
    handlerRegistry = new HandlerRegistry();
    stepResolver = new StepResolver(handlerRegistry);
  });

  test('Stage Lifecycle & Context Separation: Logging, Metrics, Telemetry execution', async () => {
    // 1. Setup a dummy handler that returns success
    const mockHandler: IStepHandler = {
      execute: async (context: HandlerContext): Promise<Result<any>> => {
        return ok('step-success-value');
      }
    };
    handlerRegistry.register('test/action/success', mockHandler);

    // 2. Compose pipeline with logging, metrics, telemetry, and invocation stages
    const loggingStage = new LoggingStage();
    const metricsStage = new MetricsStage();
    const telemetryStage = new TelemetryStage();
    const invocationStage = new HandlerInvocationStage(stepResolver);

    const pipeline = new StepExecutionPipeline([
      loggingStage,
      metricsStage,
      telemetryStage,
      invocationStage
    ]);

    // 3. Create context inputs
    const definition = {
      id: 'test-wf',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [{ id: 'step-1', name: 'Step One', action: 'test/action/success' }]
    };
    const step = definition.steps[0];
    const execution = {
      executionId: 'exec-123',
      workflowId: 'test-wf',
      startedAt: new Date(),
      state: 'Running' as const
    };

    const handlerContext: HandlerContext = {
      step,
      execution,
      definition,
      signal: new AbortController().signal
    };

    // 4. Run pipeline
    const pipelineResult = await pipeline.execute(handlerContext);

    // Assertions
    expect(pipelineResult.ok).toBe(true);
    if (pipelineResult.ok) {
      expect(pipelineResult.value).toBe('step-success-value');
    }
  });

  test('Flow Control: Skip and Short-Circuit behavior', async () => {
    // 1. Create a custom stage that short-circuits
    const shortCircuitStage = {
      name: 'ShortCircuitStage',
      execute: async (pipelineCtx: any, handlerCtx: any, next: any) => {
        return {
          status: 'short-circuit' as const,
          value: 'short-circuited-val'
        };
      }
    };

    // This should never run because of short-circuit before it
    const failHandler: IStepHandler = {
      execute: async (context) => err(new Error('Should not run'))
    };
    handlerRegistry.register('test/action/fail', failHandler);
    const invocationStage = new HandlerInvocationStage(stepResolver);

    const pipeline = new StepExecutionPipeline([shortCircuitStage, invocationStage]);

    const definition = {
      id: 'test-wf',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [{ id: 'step-1', name: 'Step One', action: 'test/action/fail' }]
    };
    const handlerContext: HandlerContext = {
      step: definition.steps[0],
      execution: { executionId: 'exec-1', workflowId: 'test-wf', startedAt: new Date(), state: 'Running' as const },
      definition,
      signal: new AbortController().signal
    };

    const result = await pipeline.execute(handlerContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('short-circuited-val');
    }
  });

  test('Flow Control: RetryStage loops on retriable errors', async () => {
    let callCount = 0;
    const flakeyHandler: IStepHandler = {
      execute: async (): Promise<Result<any>> => {
        callCount++;
        if (callCount < 3) {
          const retriableError = new Error('Flakey network failure');
          (retriableError as any).retriable = true;
          return err(retriableError);
        }
        return ok('flakey-success');
      }
    };
    handlerRegistry.register('test/action/flakey', flakeyHandler);

    const retryStage = new RetryStage(3, 10); // max 3 attempts, 10ms delay
    const invocationStage = new HandlerInvocationStage(stepResolver);
    const pipeline = new StepExecutionPipeline([retryStage, invocationStage]);

    const definition = {
      id: 'test-wf',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [{ id: 'step-1', name: 'Step One', action: 'test/action/flakey' }]
    };
    const handlerContext: HandlerContext = {
      step: definition.steps[0],
      execution: { executionId: 'exec-1', workflowId: 'test-wf', startedAt: new Date(), state: 'Running' as const },
      definition,
      signal: new AbortController().signal
    };

    const result = await pipeline.execute(handlerContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('flakey-success');
    }
    expect(callCount).toBe(3);
  });

  test('Flow Control: AuthenticationStage aborts execution', async () => {
    const mockHandler: IStepHandler = {
      execute: async () => ok('secured-value')
    };
    handlerRegistry.register('test/action/secure', mockHandler);

    const authStage = new AuthenticationStage();
    const invocationStage = new HandlerInvocationStage(stepResolver);
    const pipeline = new StepExecutionPipeline([authStage, invocationStage]);

    const definition = {
      id: 'test-wf',
      version: '1.0.0',
      name: 'Test Workflow',
      permissions: ['admin'],
      steps: [{ id: 'step-1', name: 'Step One', action: 'test/action/secure' }]
    };

    const handlerContext: HandlerContext = {
      step: definition.steps[0],
      execution: { executionId: 'exec-1', workflowId: 'test-wf', startedAt: new Date(), state: 'Running' as const },
      definition,
      signal: new AbortController().signal,
      metadata: { userRole: 'user' } // Not admin
    };

    const result = await pipeline.execute(handlerContext);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Authentication failed');
    }
  });

  test('Flow Control: CapabilityValidationStage enforces capability match', async () => {
    const mockHandler: IStepHandler = {
      execute: async () => ok('cap-value')
    };
    handlerRegistry.register('test/action/cap', mockHandler);

    // Engine supports only CHAT capability
    const capabilityStage = new CapabilityValidationStage(['CHAT']);
    const invocationStage = new HandlerInvocationStage(stepResolver);
    const pipeline = new StepExecutionPipeline([capabilityStage, invocationStage]);

    const definition = {
      id: 'test-wf',
      version: '1.0.0',
      name: 'Test Workflow',
      requiredCapabilities: ['IMAGE'], // IMAGE capability is missing
      steps: [{ id: 'step-1', name: 'Step One', action: 'test/action/cap' }]
    };

    const handlerContext: HandlerContext = {
      step: definition.steps[0],
      execution: { executionId: 'exec-1', workflowId: 'test-wf', startedAt: new Date(), state: 'Running' as const },
      definition,
      signal: new AbortController().signal
    };

    const result = await pipeline.execute(handlerContext);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('CapabilityValidationStage: Required capability IMAGE is not available');
    }
  });

  test('WorkflowRunner integration with StepExecutionPipeline', async () => {
    // 1. Setup mock handler
    const mockHandler: IStepHandler = {
      execute: async (context) => ok(`Handled: ${context.step.name}`)
    };
    handlerRegistry.register('action/test', mockHandler);

    // 2. Define workflow definition
    const definition = {
      id: 'test-wf-1',
      version: '1.0.0',
      name: 'Runner Integration Workflow',
      steps: [
        { id: 's1', name: 'First Step', action: 'action/test' },
        { id: 's2', name: 'Second Step', action: 'action/test' }
      ]
    };
    registry.register(definition);

    // 3. Setup step execution pipeline
    const loggingStage = new LoggingStage();
    const invocationStage = new HandlerInvocationStage(stepResolver);
    const pipeline = new StepExecutionPipeline([loggingStage, invocationStage]);

    // 4. Instantiate WorkflowRunner
    const runner = new WorkflowRunner(
      registry,
      stateMachine,
      eventBus,
      retryExecutor,
      progressReporter,
      cancellationManager,
      pipeline
    );

    // Track emitted events
    const events: any[] = [];
    eventBus.subscribe((evt) => {
      events.push(evt);
    });

    // 5. Execute runner
    const runResult = await runner.run('test-wf-1', {
      executionId: 'exec-idx',
      definitionId: 'test-wf-1',
      abortSignal: new AbortController().signal
    });

    // Assertions
    expect(runResult.ok).toBe(true);
    if (runResult.ok) {
      expect(runResult.value.success).toBe(true);
      expect(runResult.value.output).toBe('Handled: Second Step');
    }

    // Verify event bus emissions
    expect(events.length).toBe(4);
    expect(events[0].type).toBe('workflow.started');
    expect(events[1].type).toBe('step.completed');
    expect(events[2].type).toBe('step.completed');
    expect(events[3].type).toBe('workflow.completed');
  });
});
