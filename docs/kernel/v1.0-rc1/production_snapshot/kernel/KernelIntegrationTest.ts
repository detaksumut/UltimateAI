// src/production/kernel/KernelIntegrationTest.ts

import { RuntimeRegistryImpl } from "../runtime/registry/RuntimeRegistry";
import { RuntimeResolverImpl } from "../runtime/resolver/RuntimeResolver";
import { RuntimeEventBusImpl } from "../runtime/events/RuntimeEventBus";
import { RuntimeCoordinatorImpl } from "../runtime/coordinator/RuntimeCoordinator";
import { TraceChain } from "../runtime/contracts/TraceChain";
import { ProductionKernel } from "./ProductionKernel";
import {
  MockPlanning,
  MockReasoning,
  MockExecution,
  MockKnowledge,
  MockLearning,
  MockEvolution,
  MockDelivery
} from "./mock/KernelMockRuntimes";

import { RuntimeHealthProjector } from "../observability/projectors/RuntimeHealthProjector";
import { RuntimeMetricsProjector } from "../observability/projectors/RuntimeMetricsProjector";
import { ArtifactTimelineProjector } from "../observability/projectors/ArtifactTimelineProjector";
import { ObservabilityReportBuilder } from "../observability/report/ObservabilityReportBuilder";

import { ReliabilityInterceptor } from "../reliability/interceptor/ReliabilityInterceptor";
import { CircuitBreakerRegistry } from "../reliability/registry/CircuitBreakerRegistry";
import { CheckpointManager } from "../reliability/checkpoint/CheckpointManager";
import { ResumeEngine } from "../reliability/recovery/ResumeEngine";
import { WorkflowEngine } from "../workflow/engine/WorkflowEngine";
import { ExecutionScheduler } from "../scheduler/engine/ExecutionScheduler";
import { ResourceManager } from "../scheduler/resource/ResourceManager";
import { PriorityDispatchStrategy } from "../scheduler/strategy/PriorityDispatchStrategy";

import { ArtifactFactory } from "../artifact/factory/ArtifactFactory";
import { ArtifactRepository } from "../artifact/repository/ArtifactRepository";
import { InMemoryArtifactStore } from "../artifact/store/InMemoryArtifactStore";
import { ArtifactType } from "../artifact/contracts/IArtifact";

import { InMemoryKnowledgeStore } from "../knowledge/store/InMemoryKnowledgeStore";
import { KnowledgeIngestionEngine } from "../knowledge/ingestion/KnowledgeIngestionEngine";

async function runTest() {
  console.log("=== UltimateAI v1.1 Reliability Integration Test ===\n");

  const registry = new RuntimeRegistryImpl();
  const resolver = new RuntimeResolverImpl(registry);
  const eventBus = new RuntimeEventBusImpl();
  
  // Base Coordinator
  const baseCoordinator = new RuntimeCoordinatorImpl(resolver, eventBus);

  // Reliability Components
  const circuitBreaker = new CircuitBreakerRegistry();
  const checkpointManager = new CheckpointManager();
  const reliabilityCoordinator = new ReliabilityInterceptor(baseCoordinator, circuitBreaker, checkpointManager, resolver);
  
  // Scheduler Components
  const resourceManager = new ResourceManager();
  const dispatchStrategy = new PriorityDispatchStrategy();
  const executionScheduler = new ExecutionScheduler(dispatchStrategy, resourceManager, reliabilityCoordinator, eventBus);
  
  // Artifact Components
  const artifactStore = new InMemoryArtifactStore();
  const artifactRepository = new ArtifactRepository(artifactStore, eventBus);

  // Knowledge Graph Components
  const knowledgeStore = new InMemoryKnowledgeStore();
  const knowledgeIngestion = new KnowledgeIngestionEngine(eventBus, artifactRepository, knowledgeStore);

  // Quick Artifact Demo
  console.log("[ArtifactRepository] Saving a test Planning Blueprint...");
  const sampleArtifact = ArtifactFactory.create(
    "plan-001",
    ArtifactType.PLANNING_BLUEPRINT,
    { steps: ["Research", "Write"] },
    { traceId: "trace-demo-123" },
    { creatorCapability: "PLANNING" }
  );
  await artifactRepository.save(sampleArtifact);
  console.log(`[ArtifactRepository] Saved Artifact: ${sampleArtifact.identity.id} v${sampleArtifact.identity.version}`);
  
  // Let EventBus process the async ArtifactStored event
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Verify Knowledge Graph
  const nodes = await knowledgeStore.findByTrace("trace-demo-123");
  const planNode = (await knowledgeStore.findByArtifact("plan-001"))[0];
  const edges = await knowledgeStore.findChildren(planNode.identity.id);
  
  console.log(`[KnowledgeGraph] Trace trace-demo-123 has ${nodes.length} nodes associated.`);
  console.log(`[KnowledgeGraph] Node ${planNode.identity.id} has ${edges.length} outgoing edges.\n`);

  // Memory Intelligence Components
  const { CandidateGenerator } = await import("../memory/retrieval/CandidateGenerator");
  const { RankingEngine } = await import("../memory/retrieval/RankingEngine");
  const { KnowledgeRetrievalEngine } = await import("../memory/retrieval/KnowledgeRetrievalEngine");
  const { RetrievalStrategy } = await import("../memory/contracts/RetrievalStrategy");
  
  const candidateGenerator = new CandidateGenerator(knowledgeStore);
  const rankingEngine = new RankingEngine();
  const memoryEngine = new KnowledgeRetrievalEngine(eventBus, candidateGenerator, rankingEngine, artifactRepository);

  console.log("[MemoryIntelligence] Simulating Planner Context Retrieval...");
  const retrievedContexts = await memoryEngine.retrieve(
    "PLANNING", // Context ID (Capability name)
    RetrievalStrategy.CAPABILITY, // Strategy
    { maxContextArtifacts: 5, maxDepth: 2, minimumScore: 0.5, allowCrossWorkflow: true },
    "trace-demo-123"
  );
  
  console.log(`[MemoryIntelligence] Retrieved ${retrievedContexts.length} contexts.`);
  retrievedContexts.forEach(c => {
    console.log(`  -> Artifact: ${c.artifact.identity.id} | Score: ${c.ranking.score} | Reason: ${c.ranking.reason}`);
  });
  console.log("\n");
  
  // Workflow Engine
  const workflowEngine = new WorkflowEngine(executionScheduler);
  
  const resumeEngine = new ResumeEngine(new ProductionKernel(workflowEngine), checkpointManager);

  // Initialize Observability Projectors
  const healthProjector = new RuntimeHealthProjector(eventBus);
  const metricsProjector = new RuntimeMetricsProjector(eventBus);
  const timelineProjector = new ArtifactTimelineProjector(eventBus);
  const reportBuilder = new ObservabilityReportBuilder(healthProjector, metricsProjector, timelineProjector);

  // Register Runtimes
  registry.register(MockPlanning);
  registry.register(MockReasoning);
  registry.register(MockExecution);
  registry.register(MockKnowledge); // Fails on first attempt
  registry.register(MockLearning);
  registry.register(MockEvolution);
  registry.register(MockDelivery);

  const kernel = new ProductionKernel(workflowEngine);

  const trace: TraceChain = {
    traceId: "trace-" + Math.random().toString(36).substring(2, 10),
    requestId: "req-1002",
    correlationId: "corr-user-request-2",
    sessionId: "sess-abc"
  };

  console.log(`Trace: ${trace.traceId}`);
  
  eventBus.subscribe("RuntimeExecutionCompleted", (evt: any) => {
    console.log(`  ✔ ${evt.runtimeId} (took ${evt.payload?.durationMs || 0}ms)`);
  });

  const report = await kernel.processUserRequest("Fix the auth module with observability", trace);

  console.log(`\nCompleted in ${report.totalDurationMs} ms`);
  console.log(`Final Status: ${report.finalStatus}`);

  // Trigger Report Generation
  await reportBuilder.buildReport(trace.traceId);
}

runTest().catch(console.error);
