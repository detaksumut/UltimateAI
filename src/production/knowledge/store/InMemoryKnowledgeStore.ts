import { IKnowledgeStore } from "./IKnowledgeStore";
import { KnowledgeNode } from "../contracts/KnowledgeNode";
import { KnowledgeEdge } from "../contracts/KnowledgeEdge";

export class InMemoryKnowledgeStore implements IKnowledgeStore {
  private nodes = new Map<string, KnowledgeNode>();
  private edges = new Map<string, KnowledgeEdge>();

  // Index maps for performance optimization (O(1) lookups)
  private edgesBySource = new Map<string, KnowledgeEdge[]>();
  private edgesByTarget = new Map<string, KnowledgeEdge[]>();
  private nodesByArtifact = new Map<string, KnowledgeNode[]>();
  private nodesByCapability = new Map<string, KnowledgeNode[]>();
  private nodesByTrace = new Map<string, KnowledgeNode[]>();

  async saveNode(node: KnowledgeNode): Promise<void> {
    this.nodes.set(node.identity.id, node);
    
    // Index by artifact ID
    if (node.artifactId) {
      if (!this.nodesByArtifact.has(node.artifactId)) {
        this.nodesByArtifact.set(node.artifactId, []);
      }
      this.nodesByArtifact.get(node.artifactId)!.push(node);
    }

    // Index by creator capability
    if (node.metadata?.creatorCapability) {
      const cap = node.metadata.creatorCapability;
      if (!this.nodesByCapability.has(cap)) {
        this.nodesByCapability.set(cap, []);
      }
      this.nodesByCapability.get(cap)!.push(node);
    }

    // Index by trace ID
    if (node.metadata?.traceId) {
      const trace = node.metadata.traceId;
      if (!this.nodesByTrace.has(trace)) {
        this.nodesByTrace.set(trace, []);
      }
      this.nodesByTrace.get(trace)!.push(node);
    }
  }

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    this.edges.set(edge.id, edge);

    // Index by source
    if (!this.edgesBySource.has(edge.sourceNodeId)) {
      this.edgesBySource.set(edge.sourceNodeId, []);
    }
    this.edgesBySource.get(edge.sourceNodeId)!.push(edge);

    // Index by target
    if (!this.edgesByTarget.has(edge.targetNodeId)) {
      this.edgesByTarget.set(edge.targetNodeId, []);
    }
    this.edgesByTarget.get(edge.targetNodeId)!.push(edge);
  }

  async getNode(id: string): Promise<KnowledgeNode | undefined> {
    return this.nodes.get(id);
  }

  async getEdge(id: string): Promise<KnowledgeEdge | undefined> {
    return this.edges.get(id);
  }

  async findByArtifact(artifactId: string): Promise<KnowledgeNode[]> {
    return this.nodesByArtifact.get(artifactId) || [];
  }

  async findChildren(nodeId: string): Promise<KnowledgeEdge[]> {
    return this.edgesBySource.get(nodeId) || [];
  }

  async findParents(nodeId: string): Promise<KnowledgeEdge[]> {
    return this.edgesByTarget.get(nodeId) || [];
  }

  async findByCapability(capability: string): Promise<KnowledgeNode[]> {
    return this.nodesByCapability.get(capability) || [];
  }

  async findByTrace(traceId: string): Promise<KnowledgeNode[]> {
    return this.nodesByTrace.get(traceId) || [];
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
