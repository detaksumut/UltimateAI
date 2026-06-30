import { IKnowledgeStore } from "../../knowledge/store/IKnowledgeStore";
import { KnowledgeNode } from "../../knowledge/contracts/KnowledgeNode";
import { RetrievalStrategy } from "../contracts/RetrievalStrategy";
import { MemoryPolicy } from "../contracts/MemoryPolicy";

export interface CandidateResult {
  node: KnowledgeNode;
  knowledgePath: string[];
}

export class CandidateGenerator {
  constructor(private readonly knowledgeStore: IKnowledgeStore) {}

  async generate(
    strategy: RetrievalStrategy,
    contextId: string, // Could be an artifactId, capability, or traceId depending on strategy
    policy: MemoryPolicy
  ): Promise<CandidateResult[]> {
    switch (strategy) {
      case RetrievalStrategy.LINEAGE:
        return this.traverseLineage(contextId, policy.maxDepth);
      case RetrievalStrategy.CAPABILITY:
        return this.findByCapability(contextId);
      case RetrievalStrategy.WORKFLOW:
        return this.findByWorkflow(contextId);
      case RetrievalStrategy.RECENT:
        return this.findRecent(policy.maxContextArtifacts);
      case RetrievalStrategy.SEMANTIC:
        // Stub for future LLM / Embedding search
        console.warn("[CandidateGenerator] SEMANTIC strategy is currently a stub.");
        return [];
      case RetrievalStrategy.HYBRID:
        // Combine multiple deterministic strategies
        const lineage = await this.traverseLineage(contextId, policy.maxDepth);
        const capability = await this.findByCapability(contextId);
        return [...lineage, ...capability];
      default:
        return [];
    }
  }

  private async traverseLineage(artifactId: string, maxDepth: number): Promise<CandidateResult[]> {
    const results: CandidateResult[] = [];
    const queue: { id: string; depth: number; path: string[] }[] = [{ id: artifactId, depth: 0, path: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) continue;
      
      const nodes = await this.knowledgeStore.findByArtifact(current.id);
      if (nodes.length === 0) continue;
      
      const node = nodes[0];
      if (visited.has(node.identity.id)) continue;
      visited.add(node.identity.id);

      if (current.depth > 0) {
        results.push({ node, knowledgePath: current.path });
      }

      // Find parents (DERIVED_FROM edges where this node is the source)
      const outgoingEdges = await this.knowledgeStore.findChildren(node.identity.id);
      for (const edge of outgoingEdges) {
        if (edge.relationType === "DERIVED_FROM") {
          const targetNode = await this.knowledgeStore.getNode(edge.targetNodeId);
          if (targetNode && targetNode.artifactId) {
            queue.push({ 
              id: targetNode.artifactId, 
              depth: current.depth + 1, 
              path: [...current.path, edge.id, targetNode.identity.id] 
            });
          }
        }
      }
    }

    return results;
  }

  private async findByCapability(capability: string): Promise<CandidateResult[]> {
    const nodes = await this.knowledgeStore.findByCapability(capability);
    return nodes.map(node => ({ node, knowledgePath: [node.identity.id] }));
  }

  private async findByWorkflow(traceId: string): Promise<CandidateResult[]> {
    const nodes = await this.knowledgeStore.findByTrace(traceId);
    return nodes.map(node => ({ node, knowledgePath: [node.identity.id] }));
  }

  private async findRecent(limit: number): Promise<CandidateResult[]> {
    // In a real system, we'd query the DB for the most recently created ArtifactNodes
    // For now, we will just fetch by trace or return empty as a stub since we lack a global node list.
    // Assuming we have a way to fetch recent nodes, we would return them.
    return []; 
  }
}
