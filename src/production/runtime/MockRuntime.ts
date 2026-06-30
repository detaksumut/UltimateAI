import { IRuntime } from "./contracts/IRuntime";
import { IRuntimeContext } from "./contracts/IRuntimeContext";
import { IRuntimeResult } from "./contracts/IRuntimeResult";
import { RuntimeManifest } from "./registry/RuntimeManifest";
import { RuntimeCapability } from "./contracts/RuntimeCapability";
import { RuntimeRegistryImpl } from "./registry/RuntimeRegistry";
import { RuntimeResolverImpl } from "./resolver/RuntimeResolver";
import { RuntimeEventBusImpl } from "./events/RuntimeEventBus";
import { RuntimeCoordinatorImpl } from "./coordinator/RuntimeCoordinator";
import { RuntimeLifecycle } from "./contracts/RuntimeLifecycle";

/**
 * A mock runtime to verify the Integration Foundation end-to-end.
 */
export class MockLearningRuntime implements IRuntime<IRuntimeContext, IRuntimeResult<any>> {
  readonly manifest: RuntimeManifest = {
    id: "mock-learning-v1",
    name: "Mock Learning Runtime",
    version: "1.0.0",
    author: "System",
    description: "Mock learning for tests",
    capabilities: [RuntimeCapability.LEARNING],
    requiredCapabilities: [],
    contractVersion: "1.0",
    startupPriority: 10,
    healthCheck: async () => true
  };
  
  state: RuntimeLifecycle = RuntimeLifecycle.READY;

  async execute(context: IRuntimeContext): Promise<IRuntimeResult<any>> {
    this.state = RuntimeLifecycle.RUNNING;
    const startedAt = Date.now();
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const finishedAt = Date.now();
    this.state = RuntimeLifecycle.READY;
    
    return {
      runtimeId: this.manifest.id,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      status: "SUCCESS",
      warnings: [],
      payload: {
        identity: { artifactId: `mock-learn-${Date.now()}`, createdAt: Date.now() },
        trace: context.trace,
        message: `Mock learned something for execution ${context.trace.executionId}`
      }
    };
  }
}

/**
 * End-to-end verification script.
 * Proves that the Kernel can request LEARNING capability, and it flows through Coordinator -> Resolver -> Registry -> Runtime,
 * while emitting events to the Bus.
 */
export async function runMockIntegrationFlow() {
  console.log("=== Starting End-to-End Mock Integration Flow ===");

  // 1. Setup Foundation
  const registry = new RuntimeRegistryImpl();
  const resolver = new RuntimeResolverImpl(registry);
  const eventBus = new RuntimeEventBusImpl();
  const coordinator = new RuntimeCoordinatorImpl(resolver, eventBus);

  // 2. Register Mock Runtime
  const mockLearningRuntime = new MockLearningRuntime();
  registry.register(mockLearningRuntime);
  console.log(`Registered Runtime: ${mockLearningRuntime.manifest.name}`);

  // 3. Subscribe to Events (Observability)
  eventBus.subscribe("RuntimeExecutionStarted", (event) => {
    console.log(`[EVENT] ${event.eventType} - Runtime: ${event.runtimeId} - Capability: ${event.payload.capability}`);
  });
  
  eventBus.subscribe("RuntimeExecutionCompleted", (event) => {
    console.log(`[EVENT] ${event.eventType} - Runtime: ${event.runtimeId} - Status: ${event.payload.result.status}`);
  });

  // 4. Kernel Requests Execution (Only knows capability)
  const context: IRuntimeContext = {
    trace: {
      traceId: "trace-global-1",
      requestId: "req-1",
      correlationId: "corr-123",
      sessionId: "sess-abc"
    },
    timestamp: Date.now()
  };

  console.log("Kernel: Requesting LEARNING capability...");
  try {
    const result = await coordinator.executeCapability(RuntimeCapability.LEARNING, context);
    console.log(`Kernel: Received Result Payload: "${result.payload}"`);
  } catch (err) {
    console.error("Integration Flow Failed:", err);
  }
  
  console.log("=== End-to-End Flow Complete ===");
}

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMockIntegrationFlow().catch(console.error);
}
