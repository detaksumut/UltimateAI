import { IKnowledgeStore } from "./IKnowledgeStore";
import { KnowledgeNode } from "../contracts/KnowledgeNode";
import { KnowledgeEdge } from "../contracts/KnowledgeEdge";

export class InMemoryKnowledgeStore implements IKnowledgeStore {
  private nodes = new Map<string, KnowledgeNode>();
  private edges = new Map<string, KnowledgeEdge>();

  async saveNode(node: KnowledgeNode): Promise<void> {
    this.nodes.set(node.identity.id, node);
  }

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    this.edges.set(edge.id, edge);
  }

  async getNode(id: string): Promise<KnowledgeNode | undefined> {
    return this.nodes.get(id);
  }

  async getEdge(id: string): Promise<KnowledgeEdge | undefined> {
    return this.edges.get(id);
  }

  async findByArtifact(artifactId: string): Promise<KnowledgeNode[]> {
    return Array.from(this.nodes.values()).filter(n => n.artifactId === artifactId);
  }

  async findChildren(nodeId: string): Promise<KnowledgeEdge[]> {
    return Array.from(this.edges.values()).filter(e => e.sourceNodeId === nodeId);
  }

  async findParents(nodeId: string): Promise<KnowledgeEdge[]> {
    return Array.from(this.edges.values()).filter(e => e.targetNodeId === nodeId);
  }

  async findByCapability(capability: string): Promise<KnowledgeNode[]> {
    // For now, this requires traversing edges. We can find all GENERATED_BY edges
    // pointing to a Capability node.
    // Or we can rely on node metadata if we store capability there.
    // Let's rely on metadata for now to keep it simple.
    return Array.from(this.nodes.values()).filter(n => n.metadata?.creatorCapability === capability);
  }

  async findByTrace(traceId: string): Promise<KnowledgeNode[]> {
    return Array.from(this.nodes.values()).filter(n => n.metadata?.traceId === traceId);
  }

  async findConnected(nodeId: string): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    const outgoing = await this.findChildren(nodeId);
    const incoming = await this.findParents(nodeId);
    
    const allEdges = [...outgoing, ...incoming];
    
    const nodeIds = new Set<string>();
    allEdges.forEach(e => {
      nodeIds.add(e.sourceNodeId);
      nodeIds.add(e.targetNodeId);
    });
    
    const nodes: KnowledgeNode[] = [];
    for (const id of nodeIds) {
      const n = await this.getNode(id);
      if (n) nodes.push(n);
    }
    
    return { nodes, edges: allEdges };
  }
}
