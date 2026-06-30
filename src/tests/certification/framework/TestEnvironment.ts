import { ExecutionScheduler } from "../../../production/scheduler/engine/ExecutionScheduler";
import { PriorityDispatchStrategy } from "../../../production/scheduler/strategy/PriorityDispatchStrategy";
import { ResourceManager } from "../../../production/scheduler/resource/ResourceManager";
import { RuntimeEventBusImpl } from "../../../production/runtime/events/RuntimeEventBus";
import { MockLearningRuntime } from "../../../production/runtime/MockRuntime";
import { ReliabilityInterceptor } from "../../../production/reliability/interceptor/ReliabilityInterceptor";
import { CheckpointManager } from "../../../production/reliability/checkpoint/CheckpointManager";
import { FailureClassifier } from "../../../production/reliability/classification/FailureClassifier";
import { CircuitBreakerRegistry } from "../../../production/reliability/registry/CircuitBreakerRegistry";
import { WorkflowEngine } from "../../../production/workflow/engine/WorkflowEngine";

export class TestEnvironment {
  public eventBus: RuntimeEventBusImpl;
  public resourceManager: ResourceManager;
  public scheduler: ExecutionScheduler;
  public workflowEngine: WorkflowEngine;
  public interceptor: ReliabilityInterceptor;

  constructor() {
    this.eventBus = new RuntimeEventBusImpl();
    this.resourceManager = new ResourceManager(10); // Generous global limit for tests
    const dispatchStrategy = new PriorityDispatchStrategy();

    // Mock dependencies
    const mockRuntime = new MockLearningRuntime();
    
    // In a real environment, the interceptor wraps the real coordinator.
    // For certification testing, we construct the real interceptor but point it at the mock runtime
    const checkpointManager = new CheckpointManager();
    const failureClassifier = new FailureClassifier();
    const circuitBreaker = new CircuitBreakerRegistry(this.eventBus);
    
    // We are simulating the coordinator passing capability requests directly to the mock runtime
    const mockCoordinator = {
      executeCapability: async (capability: any, ctx: any) => {
        return mockRuntime.execute(ctx);
      }
    };
    
    const mockResolver = {
      resolve: (cap: any) => mockRuntime
    };

    this.interceptor = new ReliabilityInterceptor(
      mockCoordinator as any,
      circuitBreaker,
      checkpointManager,
      mockResolver as any
    );

    // Pass the interceptor as the coordinator to the scheduler
    this.scheduler = new ExecutionScheduler(
      dispatchStrategy,
      this.resourceManager,
      this.interceptor as any,
      this.eventBus
    );

    this.workflowEngine = new WorkflowEngine(this.scheduler);
  }

  createDummyWorkflow(id: string, capability: any = "PLANNING"): Workflow {
    return {
      metadata: { id, name: id, version: "1", createdBy: "test", tags: [], description: "" },
      stages: [
        {
          id: "s1",
          jobs: [
            {
              id: "j1",
              dependencies: [],
              tasks: [{ id: "t1", name: "t1", capability, dependencies: [] }]
            }
          ]
        }
      ]
    };
  }

  async runWorkflow(workflow: Workflow, traceId: string): Promise<void> {
    return this.workflowEngine.execute(workflow, { 
      traceId, 
      runtimeContext: {
        trace: { traceId, requestId: traceId, correlationId: traceId, sessionId: traceId },
        timestamp: Date.now()
      } as any 
    });
  }
}
