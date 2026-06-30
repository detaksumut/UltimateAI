import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { KnowledgeTestEnvironment } from "../framework/KnowledgeTestEnvironment";

export default class InvariantReachabilityTest implements ICertificationSuite {
  name = "InvariantReachabilityTest";
  timeoutMs = 5000;

  async execute(seed: string): Promise<SuiteResult> {
    const start = Date.now();
    const env = new KnowledgeTestEnvironment();

    // 1. Create a clean acyclic graph: A <- B <- C
    const artA = env.createDummyArtifact("a");
    const artB = env.createDummyArtifact("b", ["a"]);
    const artC = env.createDummyArtifact("c", ["b"]);

    await env.saveArtifact(artA);
    await env.saveArtifact(artB);
    await env.saveArtifact(artC);

    const nodes1 = await this.getStoreNodes(env);
    const edges1 = await this.getStoreEdges(env);

    const cycleDetected1 = this.hasCycle(nodes1, edges1);

    // 2. Force-inject a cycle manually to verify our detector works
    // (A is derived from C)
    const cycleEdge = {
      id: "edge-c-to-a-cyclic",
      relationType: "DERIVED_FROM" as any,
      sourceNodeId: "kn-a-v1", // A is derived from C
      targetNodeId: "kn-c-v1",
      confidence: 1.0,
      createdAt: Date.now()
    };
    await env.knowledgeStore.saveEdge(cycleEdge);

    const nodes2 = await this.getStoreNodes(env);
    const edges2 = await this.getStoreEdges(env);

    const cycleDetected2 = this.hasCycle(nodes2, edges2);

    // Remove the forced cycle edge to clean up store
    const edgeMap = (env.knowledgeStore as any).edges as Map<string, any>;
    edgeMap.delete("edge-c-to-a-cyclic");

    // 3. Reachability checks
    const planningNodes = await env.knowledgeStore.findByCapability("PLANNING");
    const traceNodes = await env.knowledgeStore.findByTrace("t-c");

    let passed = true;
    const errors: string[] = [];

    if (cycleDetected1) {
      passed = false;
      errors.push("Lineage DAG check failed: detected cycle in a valid acyclic graph.");
    }

    if (!cycleDetected2) {
      passed = false;
      errors.push("Lineage DAG check failed: failed to detect a forced cycle.");
    }

    if (planningNodes.length === 0) {
      passed = false;
      errors.push("Reachability check failed: findByCapability returned zero nodes.");
    }

    if (traceNodes.length === 0) {
      passed = false;
      errors.push("Reachability check failed: findByTrace returned zero nodes.");
    }

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: {
        cycleDetected1,
        cycleDetected2,
        reachabilityPlanningCount: planningNodes.length,
        reachabilityTraceCount: traceNodes.length
      },
      evidence: [
        {
          cycleDetected1,
          cycleDetected2,
          planningNodes: planningNodes.map(n => n.identity.id),
          traceNodes: traceNodes.map(n => n.identity.id),
          errors
        }
      ],
      error: passed ? undefined : `DAG Invariant and Reachability check failed: ${errors.join("; ")}`
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

  private hasCycle(nodes: any[], edges: any[]): boolean {
    const adj = new Map<string, string[]>();
    for (const edge of edges) {
      if (edge.relationType === "DERIVED_FROM") {
        if (!adj.has(edge.sourceNodeId)) {
          adj.set(edge.sourceNodeId, []);
        }
        adj.get(edge.sourceNodeId)!.push(edge.targetNodeId);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (u: string): boolean => {
      visited.add(u);
      recStack.add(u);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        if (!visited.has(v)) {
          if (dfs(v)) return true;
        } else if (recStack.has(v)) {
          return true;
        }
      }

      recStack.delete(u);
      return false;
    };

    for (const node of nodes) {
      const u = node.identity.id;
      if (!visited.has(u)) {
        if (dfs(u)) return true;
      }
    }

    return false;
  }
}
