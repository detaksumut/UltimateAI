import { KnowledgeNode } from "../contracts/KnowledgeNode";
import { KnowledgeEdge } from "../contracts/KnowledgeEdge";

export interface IKnowledgeStore {
  saveNode(node: KnowledgeNode): Promise<void>;
  saveEdge(edge: KnowledgeEdge): Promise<void>;
  
  getNode(id: string): Promise<KnowledgeNode | undefined>;
  getEdge(id: string): Promise<KnowledgeEdge | undefined>;
  
  // Query API
  findByArtifact(artifactId: string): Promise<KnowledgeNode[]>;
  findChildren(nodeId: string): Promise<KnowledgeEdge[]>; // Outgoing edges (e.g. DERIVED_FROM where this node is source)
  findParents(nodeId: string): Promise<KnowledgeEdge[]>; // Incoming edges (e.g. DERIVED_FROM where this node is target)
  findByCapability(capability: string): Promise<KnowledgeNode[]>;
  findByTrace(traceId: string): Promise<KnowledgeNode[]>;
  
  // Gets all nodes connected to a node within a certain depth (simple 1-hop implementation for now)
  findConnected(nodeId: string): Promise<{ nodes: KnowledgeNode[], edges: KnowledgeEdge[] }>;
}
