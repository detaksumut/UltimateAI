import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { KnowledgeTestEnvironment } from "../framework/KnowledgeTestEnvironment";

export default class LargeGraphTest implements ICertificationSuite {
  name = "LargeGraphTest";
  timeoutMs = 30000; // Large graph generation may take a few seconds

  async execute(seed: string): Promise<SuiteResult> {
    const start = Date.now();
    const results: any[] = [];

    // Test sizes: 100, 1000, 10000
    const sizes = [100, 1000, 10000];

    for (const size of sizes) {
      const env = new KnowledgeTestEnvironment();
      
      const beforeMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const startTime = Date.now();

      // We will create a parent-child chain of length `size`
      // Node 0 is root, Node i is child of Node i-1
      // For speed, we save them in batches
      console.log(`[LargeGraphTest] Generating graph of size ${size}...`);
      
      for (let i = 0; i < size; i++) {
        const parentId = i > 0 ? `node-${i-1}` : undefined;
        const parentIds = parentId ? [parentId] : [];
        const art = env.createDummyArtifact(`node-${i}`, parentIds);
        await env.artifactRepo.save(art);
      }

      // Wait until all nodes are processed by the ingestion engine
      const nodesMap = (env.knowledgeStore as any).nodes as Map<string, any>;
      // Each artifact creates 1 artifact node, 1 capability node (shared), 1 trace node (unique)
      // Wait, capability node PLANNING is shared. Trace node is unique.
      // So total nodes = size (artifact) + 1 (shared capability) + size (trace) = 2 * size + 1 nodes.
      const expectedNodes = 2 * size + 1;

      while (nodesMap.size < expectedNodes) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const generationDuration = Date.now() - startTime;
      const afterMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

      const nodes = Array.from(nodesMap.values());
      const edgesMap = (env.knowledgeStore as any).edges as Map<string, any>;
      const edges = Array.from(edgesMap.values());

      // 1. Measure Invariant Check Latency
      const invStart = Date.now();
      const cycleDetected = this.hasCycle(nodes, edges);
      const invDuration = Date.now() - invStart;

      // 2. Measure Traversal Latency (traverse from leaf to root)
      const travStart = Date.now();
      const path: string[] = [];
      let currentId = `kn-node-${size-1}-v1`;
      while (true) {
        const outgoing = await env.knowledgeStore.findChildren(currentId);
        const derivedFrom = outgoing.find(e => e.relationType === "DERIVED_FROM");
        if (!derivedFrom) break;
        currentId = derivedFrom.targetNodeId;
        path.push(currentId);
      }
      const travDuration = Date.now() - travStart;

      results.push({
        size,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        memoryMB: afterMem - beforeMem,
        generationMs: generationDuration,
        invariantCheckMs: invDuration,
        traversalMs: travDuration,
        traversalPathLength: path.length,
        cycleDetected
      });
    }

    const finalResult = results[results.length - 1];
    const passed = !finalResult.cycleDetected && finalResult.invariantCheckMs < 1000 && finalResult.traversalMs < 500;

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: {
        total10kNodes: finalResult.nodesCount,
        total10kEdges: finalResult.edgesCount,
        memoryUsedMB: finalResult.memoryMB,
        invariantCheckMs: finalResult.invariantCheckMs,
        traversalMs: finalResult.traversalMs
      },
      evidence: results,
      error: passed ? undefined : "Performance or cycle detection invariants failed."
    };
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
