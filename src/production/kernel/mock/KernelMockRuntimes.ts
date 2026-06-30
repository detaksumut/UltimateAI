// src/production/kernel/mock/KernelMockRuntimes.ts

import { IRuntime } from "../../runtime/contracts/IRuntime";
import { IRuntimeContext } from "../../runtime/contracts/IRuntimeContext";
import { IRuntimeResult } from "../../runtime/contracts/IRuntimeResult";
import { RuntimeManifest } from "../../runtime/registry/RuntimeManifest";
import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";
import { RuntimeLifecycle } from "../../runtime/contracts/RuntimeLifecycle";

// Base Mock Class
export class BaseMockRuntime implements IRuntime {
  state: RuntimeLifecycle = RuntimeLifecycle.READY;
  constructor(
    public readonly manifest: RuntimeManifest, 
    private readonly mockOutput: any,
    private readonly customBehavior?: () => Promise<void>
  ) {}

  async execute(context: IRuntimeContext): Promise<IRuntimeResult> {
    this.state = RuntimeLifecycle.RUNNING;
    
    if (this.customBehavior) {
      await this.customBehavior();
    }

    const startedAt = Date.now();
    await new Promise(r => setTimeout(r, 20)); // simulated latency
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
        identity: { artifactId: `mock-art-${Date.now()}`, createdAt: Date.now() },
        trace: context.trace,
        ...this.mockOutput
      }
    };
  }
}

// Concrete Mocks
export const MockPlanning = new BaseMockRuntime({
  id: "planning-v1", name: "Mock Planning Runtime", version: "1.0", author: "System", description: "Plans",
  capabilities: [RuntimeCapability.PLANNING], requiredCapabilities: [], contractVersion: "1.0", startupPriority: 1, healthCheck: async () => true
}, { blueprintId: "bp-001", strategySteps: ["Do X", "Do Y"] });

export const MockReasoning = new BaseMockRuntime({
  id: "reasoning-v1", name: "Mock Reasoning Runtime", version: "1.0", author: "System", description: "Reasons",
  capabilities: [RuntimeCapability.REASONING], requiredCapabilities: [], contractVersion: "1.0", startupPriority: 2, healthCheck: async () => true
}, { conclusionId: "conc-001", recommendation: "Proceed with X" });

export const MockExecution = new BaseMockRuntime({
  id: "execution-v1", name: "Mock Execution Runtime", version: "1.0", author: "System", description: "Executes",
  capabilities: [RuntimeCapability.EXECUTION], requiredCapabilities: [], contractVersion: "1.0", startupPriority: 3, healthCheck: async () => true
}, { executionLogId: "log-001", workflowStatus: "COMPLETED" });

let knowledgeAttempts = 0;
export const MockKnowledge = new BaseMockRuntime({
  id: "knowledge-v1", name: "Mock Knowledge Runtime", version: "1.0", author: "System", description: "Knows",
  capabilities: [RuntimeCapability.KNOWLEDGE], requiredCapabilities: [], contractVersion: "1.0", startupPriority: 4, healthCheck: async () => true
}, { reconstructionId: "recon-001", facts: ["Fact 1"] }, async () => {
  knowledgeAttempts++;
  if (knowledgeAttempts === 1) {
    throw new Error("Network timeout while reaching knowledge graph."); // Transient error
  }
});

export const MockLearning = new BaseMockRuntime({
  id: "learning-v1", name: "Mock Learning Runtime", version: "1.0", author: "System", description: "Learns",
  capabilities: [RuntimeCapability.LEARNING], requiredCapabilities: [], contractVersion: "1.0", startupPriority: 5, healthCheck: async () => true
}, { learnedKnowledgeId: "lk-001", summary: "Learned X" });

export const MockEvolution = new BaseMockRuntime({
  id: "evolution-v1", name: "Mock Evolution Runtime", version: "1.0", author: "System", description: "Evolves",
  capabilities: [RuntimeCapability.EVOLUTION], requiredCapabilities: [], contractVersion: "1.0", startupPriority: 6, healthCheck: async () => true
}, { evolutionResultId: "evo-001", merged: true });

export const MockDelivery = new BaseMockRuntime({
  id: "delivery-v1", name: "Mock Delivery Runtime", version: "1.0", author: "System", description: "Delivers",
  capabilities: [RuntimeCapability.DELIVERY], requiredCapabilities: [], contractVersion: "1.0", startupPriority: 7, healthCheck: async () => true
}, { deliveryId: "del-001", presentedToUser: true });
