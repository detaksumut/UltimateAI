import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { KnowledgeTestEnvironment } from "../framework/KnowledgeTestEnvironment";

export default class ReferentialIntegrityTest implements ICertificationSuite {
  name = "ReferentialIntegrityTest";
  timeoutMs = 5000;

  async execute(seed: string): Promise<SuiteResult> {
    const start = Date.now();

    // ----------------------------------------------------
    // Scenario 1: Parent then Child (Normal Order)
    // ----------------------------------------------------
    const env1 = new KnowledgeTestEnvironment();
    const parentA = env1.createDummyArtifact("parent-a");
    const childB = env1.createDummyArtifact("child-b", ["parent-a"]);

    await env1.saveArtifact(parentA);
    await env1.saveArtifact(childB);

    const nodes1 = await this.getStoreNodes(env1);
    const edges1 = await this.getStoreEdges(env1);
    const pendingCount1 = env1.ingestionEngine.pendingRegistry.getPendingCount();

    // Verify referential integrity of Scenario 1
    const brokenEdges1 = this.findBrokenEdges(nodes1, edges1);

    // ----------------------------------------------------
    // Scenario 2: Child then Parent (Out-of-Order + Promotion)
    // ----------------------------------------------------
    const env2 = new KnowledgeTestEnvironment();
    const parentA2 = env2.createDummyArtifact("parent-a");
    const childB2 = env2.createDummyArtifact("child-b", ["parent-a"]);

    // Ingest child first
    await env2.saveArtifact(childB2);

    const nodes2Mid = await this.getStoreNodes(env2);
    const edges2Mid = await this.getStoreEdges(env2);
    const pendingCount2Mid = env2.ingestionEngine.pendingRegistry.getPendingCount();

    // Ingest parent next (triggers promotion)
    await env2.saveArtifact(parentA2);

    const nodes2Final = await this.getStoreNodes(env2);
    const edges2Final = await this.getStoreEdges(env2);
    const pendingCount2Final = env2.ingestionEngine.pendingRegistry.getPendingCount();

    // Verify referential integrity of Scenario 2 (Final)
    const brokenEdges2 = this.findBrokenEdges(nodes2Final, edges2Final);

    // ----------------------------------------------------
    // Assertions & Validations
    // ----------------------------------------------------
    const checks: string[] = [];
    let passed = true;

    // A. Check Scenario 1
    if (brokenEdges1.length > 0) {
      passed = false;
      checks.push(`Scenario 1 has broken edges: ${JSON.stringify(brokenEdges1)}`);
    }
    if (pendingCount1 !== 0) {
      passed = false;
      checks.push(`Scenario 1 has leftover pending edges: ${pendingCount1}`);
    }

    // B. Check Scenario 2 Midway
    // The DERIVED_FROM edge should NOT exist in the store yet, it must be in the registry
    const derivedMid = edges2Mid.filter(e => e.relationType === "DERIVED_FROM");
    if (derivedMid.length > 0) {
      passed = false;
      checks.push(`Scenario 2 mid-point: DERIVED_FROM edges written prematurely: ${JSON.stringify(derivedMid)}`);
    }
    if (pendingCount2Mid !== 1) {
      passed = false;
      checks.push(`Scenario 2 mid-point: Pending count should be 1, got ${pendingCount2Mid}`);
    }

    // C. Check Scenario 2 Final
    if (brokenEdges2.length > 0) {
      passed = false;
      checks.push(`Scenario 2 has broken edges: ${JSON.stringify(brokenEdges2)}`);
    }
    if (pendingCount2Final !== 0) {
      passed = false;
      checks.push(`Scenario 2 final: Leftover pending edges: ${pendingCount2Final}`);
    }

    // D. Compare Scenario 1 and Scenario 2 Final Graphs
    const graphsIdentical = this.compareGraphs(nodes1, edges1, nodes2Final, edges2Final);
    if (!graphsIdentical) {
      passed = false;
      checks.push("Graphs from Scenario 1 and Scenario 2 are NOT identical!");
    }

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: {
        scenario1Nodes: nodes1.length,
        scenario1Edges: edges1.length,
        scenario2Nodes: nodes2Final.length,
        scenario2Edges: edges2Final.length,
        brokenEdgesCount: brokenEdges1.length + brokenEdges2.length
      },
      evidence: [
        {
          scenario1: { nodes: nodes1.map(n => n.identity.id), edges: edges1.map(e => e.id) },
          scenario2Mid: { nodes: nodes2Mid.map(n => n.identity.id), edges: edges2Mid.map(e => e.id), pendingCount: pendingCount2Mid },
          scenario2Final: { nodes: nodes2Final.map(n => n.identity.id), edges: edges2Final.map(e => e.id), pendingCount: pendingCount2Final },
          checks
        }
      ],
      error: passed ? undefined : `Referential integrity checks failed: ${checks.join("; ")}`
    };
  }

  private async getStoreNodes(env: KnowledgeTestEnvironment): Promise<any[]> {
    // Simply query nodes in store. InMemoryKnowledgeStore exposes private nodes, but wait!
    // Since getNode is available, how do we get all nodes?
    // We can query by capability or by artifact, but InMemoryKnowledgeStore has a queryable list of nodes.
    // Wait! Let's check if we can access the private `nodes` map.
    // Yes, via `(env.knowledgeStore as any).nodes`. This is a private Map in InMemoryKnowledgeStore.
    // Since this is a test, accessing private properties via `as any` is standard practice.
    const map = (env.knowledgeStore as any).nodes as Map<string, any>;
    return Array.from(map.values());
  }

  private async getStoreEdges(env: KnowledgeTestEnvironment): Promise<any[]> {
    const map = (env.knowledgeStore as any).edges as Map<string, any>;
    return Array.from(map.values());
  }

  private findBrokenEdges(nodes: any[], edges: any[]): any[] {
    const nodeIds = new Set(nodes.map(n => n.identity.id));
    return edges.filter(e => !nodeIds.has(e.sourceNodeId) || !nodeIds.has(e.targetNodeId));
  }

  private compareGraphs(n1: any[], e1: any[], n2: any[], e2: any[]): boolean {
    const ids1 = new Set(n1.map(n => n.identity.id));
    const ids2 = new Set(n2.map(n => n.identity.id));
    if (ids1.size !== ids2.size) return false;
    for (const id of ids1) {
      if (!ids2.has(id)) return false;
    }

    const edgeIds1 = new Set(e1.map(e => e.id));
    const edgeIds2 = new Set(e2.map(e => e.id));
    if (edgeIds1.size !== edgeIds2.size) return false;
    for (const id of edgeIds1) {
      if (!edgeIds2.has(id)) return false;
    }

    return true;
  }
}
