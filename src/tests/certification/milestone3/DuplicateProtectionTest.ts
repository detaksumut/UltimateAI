import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { KnowledgeTestEnvironment } from "../framework/KnowledgeTestEnvironment";

export default class DuplicateProtectionTest implements ICertificationSuite {
  name = "DuplicateProtectionTest";
  timeoutMs = 5000;

  async execute(seed: string): Promise<SuiteResult> {
    const start = Date.now();
    const env = new KnowledgeTestEnvironment();

    const parent = env.createDummyArtifact("parent-x");
    const child = env.createDummyArtifact("child-y", ["parent-x"]);

    // 1. Fire child 50 times (goes to registry)
    for (let i = 0; i < 50; i++) {
      await env.saveArtifact(child);
    }

    const midNodes = await this.getStoreNodes(env);
    const midEdges = await this.getStoreEdges(env);
    const midPending = env.ingestionEngine.pendingRegistry.getPendingCount();

    // 2. Fire parent 50 times (promotes edge)
    for (let i = 0; i < 50; i++) {
      await env.saveArtifact(parent);
    }

    const postNodes = await this.getStoreNodes(env);
    const postEdges = await this.getStoreEdges(env);
    const postPending = env.ingestionEngine.pendingRegistry.getPendingCount();

    // 3. Fire child and parent another 50 times mixed
    for (let i = 0; i < 50; i++) {
      await env.saveArtifact(child);
      await env.saveArtifact(parent);
    }

    const finalNodes = await this.getStoreNodes(env);
    const finalEdges = await this.getStoreEdges(env);
    const finalPending = env.ingestionEngine.pendingRegistry.getPendingCount();

    // Validations
    let passed = true;
    const errors: string[] = [];

    // Mid check: Child node should be 1, capability node 1, trace node 1 (total 3 nodes)
    // Pending edges should be 1
    if (midNodes.length !== 3) {
      passed = false;
      errors.push(`Mid-point: Expected 3 nodes (child + capability + trace), got ${midNodes.length}`);
    }
    if (midEdges.length !== 2) { // GENERATED_BY + BELONGS_TO are saved immediately
      passed = false;
      errors.push(`Mid-point: Expected 2 edges saved immediately, got ${midEdges.length}`);
    }
    if (midPending !== 1) {
      passed = false;
      errors.push(`Mid-point: Expected 1 pending edge, got ${midPending}`);
    }

    // Final checks:
    // Total nodes: parent (1) + child (1) + capability (1) + trace (2, since child and parent have different trace IDs) = 5 nodes
    // Wait, trace node ID is trace-${artifact.trace.traceId}.
    // child trace: t-child-y
    // parent trace: t-parent-x
    // So yes, 2 trace nodes, 1 capability node (PLANNING is shared), 2 artifact nodes. Total 5 nodes.
    if (finalNodes.length !== 5) {
      passed = false;
      errors.push(`Final: Expected 5 nodes, got ${finalNodes.length}: ${JSON.stringify(finalNodes.map(n => n.identity.id))}`);
    }

    // Edges:
    // child: DERIVED_FROM (1), GENERATED_BY (1), BELONGS_TO (1)
    // parent: GENERATED_BY (1), BELONGS_TO (1) (no parent)
    // Total edges: 5 edges. No duplicates!
    if (finalEdges.length !== 5) {
      passed = false;
      errors.push(`Final: Expected 5 edges, got ${finalEdges.length}: ${JSON.stringify(finalEdges.map(e => e.id))}`);
    }

    if (finalPending !== 0) {
      passed = false;
      errors.push(`Final: Expected 0 pending edges, got ${finalPending}`);
    }

    // Asserts map contains actual unique edge IDs only
    const edgeIds = finalEdges.map(e => e.id);
    const uniqueEdgeIds = new Set(edgeIds);
    if (edgeIds.length !== uniqueEdgeIds.size) {
      passed = false;
      errors.push("Duplicate edge IDs found in store!");
    }

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: {
        totalNodes: finalNodes.length,
        totalEdges: finalEdges.length,
        pendingCount: finalPending
      },
      evidence: [
        {
          nodes: finalNodes.map(n => n.identity.id),
          edges: finalEdges.map(e => e.id),
          errors
        }
      ],
      error: passed ? undefined : `Duplicate protection check failed: ${errors.join("; ")}`
    };
  }

  private async getStoreNodes(env: KnowledgeTestEnvironment): Promise<any[]> {
    const map = (env.knowledgeStore as any).nodes as Map<string, any>;
    return Array.from(map.values());
  }

  private async getStoreEdges(env: KnowledgeTestEnvironment): Promise<any[]> {
    const map = (env.knowledgeStore as any).edges as Map<string, any>;
    return Array.from(map.values());
  }
}
