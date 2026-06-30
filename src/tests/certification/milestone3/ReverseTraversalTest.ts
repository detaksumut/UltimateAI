import { ICertificationSuite, SuiteResult } from "../framework/CertificationContracts";
import { KnowledgeTestEnvironment } from "../framework/KnowledgeTestEnvironment";

export default class ReverseTraversalTest implements ICertificationSuite {
  name = "ReverseTraversalTest";
  timeoutMs = 5000;

  async execute(seed: string): Promise<SuiteResult> {
    const start = Date.now();
    const env = new KnowledgeTestEnvironment();

    // Create lineage chain: A (grandparent) <- B (parent) <- C (child)
    const artA = env.createDummyArtifact("grandparent-a");
    const artB = env.createDummyArtifact("parent-b", ["grandparent-a"]);
    const artC = env.createDummyArtifact("child-c", ["parent-b"]);

    // Ingest them in order
    await env.saveArtifact(artA);
    await env.saveArtifact(artB);
    await env.saveArtifact(artC);

    const nodeAId = `kn-grandparent-a-v1`;
    const nodeBId = `kn-parent-b-v1`;
    const nodeCId = `kn-child-c-v1`;

    // 1. Upward Traversal (Child C -> Parent B -> Grandparent A)
    // Upward follows outgoing edges (findChildren returns edges where sourceNodeId = current)
    const upwardPath: string[] = [nodeCId];
    let currentId = nodeCId;
    while (true) {
      const outgoing = await env.knowledgeStore.findChildren(currentId);
      const derivedFrom = outgoing.find(e => e.relationType === "DERIVED_FROM");
      if (!derivedFrom) break;
      currentId = derivedFrom.targetNodeId;
      upwardPath.push(currentId);
    }

    // 2. Downward Traversal (Grandparent A -> Parent B -> Child C)
    // Downward follows incoming edges (findParents returns edges where targetNodeId = current)
    const downwardPath: string[] = [nodeAId];
    currentId = nodeAId;
    while (true) {
      const incoming = await env.knowledgeStore.findParents(currentId);
      const derivedFrom = incoming.find(e => e.relationType === "DERIVED_FROM");
      if (!derivedFrom) break;
      currentId = derivedFrom.sourceNodeId;
      downwardPath.push(currentId);
    }

    // Assert path consistency
    const upwardExpected = [nodeCId, nodeBId, nodeAId];
    const downwardExpected = [nodeAId, nodeBId, nodeCId];

    let passed = true;
    const errors: string[] = [];

    if (upwardPath.length !== upwardExpected.length || !upwardPath.every((v, i) => v === upwardExpected[i])) {
      passed = false;
      errors.push(`Upward path incorrect. Expected ${JSON.stringify(upwardExpected)}, got ${JSON.stringify(upwardPath)}`);
    }

    if (downwardPath.length !== downwardExpected.length || !downwardPath.every((v, i) => v === downwardExpected[i])) {
      passed = false;
      errors.push(`Downward path incorrect. Expected ${JSON.stringify(downwardExpected)}, got ${JSON.stringify(downwardPath)}`);
    }

    // Check bidirectionality reverse match
    const reversedUpward = [...upwardPath].reverse();
    if (!reversedUpward.every((v, i) => v === downwardPath[i])) {
      passed = false;
      errors.push("Upward path reversed does not match downward path!");
    }

    return {
      suite: this.name,
      status: passed ? "PASS" : "FAIL",
      durationMs: Date.now() - start,
      metrics: {
        pathLength: upwardPath.length
      },
      evidence: [
        {
          upwardPath,
          downwardPath,
          errors
        }
      ],
      error: passed ? undefined : `Reverse traversal checks failed: ${errors.join("; ")}`
    };
  }
}
