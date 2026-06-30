import { IKnowledgeStore } from "./IKnowledgeStore";
import { KnowledgeNode } from "../contracts/KnowledgeNode";
import { KnowledgeEdge } from "../contracts/KnowledgeEdge";
import * as fs from "fs";
import * as path from "path";

export class LocalFileKnowledgeStore implements IKnowledgeStore {
  private readonly nodesDir: string;
  private readonly edgesDir: string;

  constructor(baseDir: string = path.join(process.cwd(), "reports", "knowledge")) {
    this.nodesDir = path.join(baseDir, "nodes");
    this.edgesDir = path.join(baseDir, "edges");
    if (!fs.existsSync(this.nodesDir)) fs.mkdirSync(this.nodesDir, { recursive: true });
    if (!fs.existsSync(this.edgesDir)) fs.mkdirSync(this.edgesDir, { recursive: true });
  }

  private getNodePath(id: string): string { return path.join(this.nodesDir, `${id}.json`); }
  private getEdgePath(id: string): string { return path.join(this.edgesDir, `${id}.json`); }

  async saveNode(node: KnowledgeNode): Promise<void> {
    fs.writeFileSync(this.getNodePath(node.identity.id), JSON.stringify(node, null, 2), "utf-8");
  }

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    fs.writeFileSync(this.getEdgePath(edge.id), JSON.stringify(edge, null, 2), "utf-8");
  }

  async getNode(id: string): Promise<KnowledgeNode | undefined> {
    const p = this.getNodePath(id);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
    return undefined;
  }

  async getEdge(id: string): Promise<KnowledgeEdge | undefined> {
    const p = this.getEdgePath(id);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
    return undefined;
  }

  private async loadAllNodes(): Promise<KnowledgeNode[]> {
    if (!fs.existsSync(this.nodesDir)) return [];
    return fs.readdirSync(this.nodesDir)
      .filter(f => f.endsWith(".json"))
      .map(f => JSON.parse(fs.readFileSync(path.join(this.nodesDir, f), "utf-8")));
  }
  
  private async loadAllEdges(): Promise<KnowledgeEdge[]> {
    if (!fs.existsSync(this.edgesDir)) return [];
    return fs.readdirSync(this.edgesDir)
      .filter(f => f.endsWith(".json"))
      .map(f => JSON.parse(fs.readFileSync(path.join(this.edgesDir, f), "utf-8")));
  }

  async findByArtifact(artifactId: string): Promise<KnowledgeNode[]> {
    const nodes = await this.loadAllNodes();
    return nodes.filter(n => n.artifactId === artifactId);
  }

  async findChildren(nodeId: string): Promise<KnowledgeEdge[]> {
    const edges = await this.loadAllEdges();
    return edges.filter(e => e.sourceNodeId === nodeId);
  }

  async findParents(nodeId: string): Promise<KnowledgeEdge[]> {
    const edges = await this.loadAllEdges();
    return edges.filter(e => e.targetNodeId === nodeId);
  }

  async findByCapability(capability: string): Promise<KnowledgeNode[]> {
    const nodes = await this.loadAllNodes();
    return nodes.filter(n => n.metadata?.creatorCapability === capability);
  }

  async findByTrace(traceId: string): Promise<KnowledgeNode[]> {
    const nodes = await this.loadAllNodes();
    return nodes.filter(n => n.metadata?.traceId === traceId);
  }

  async findConnected(nodeId: string): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    const outgoing = await this.findChildren(nodeId);
    const incoming = await this.findParents(nodeId);
    
    const allEdges = [...outgoing, ...incoming];
    const nodeIds = new Set<string>();
    allEdges.forEach(e => { nodeIds.add(e.sourceNodeId); nodeIds.add(e.targetNodeId); });
    
    const nodes: KnowledgeNode[] = [];
    for (const id of nodeIds) {
      const n = await this.getNode(id);
      if (n) nodes.push(n);
    }
    
    return { nodes, edges: allEdges };
  }
}
