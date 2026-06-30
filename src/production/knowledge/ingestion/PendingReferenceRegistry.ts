import { KnowledgeEdge } from "../contracts/KnowledgeEdge.js";
import { IPendingReferenceRegistry } from "../contracts/IPendingReferenceRegistry.js";

export class PendingReferenceRegistry implements IPendingReferenceRegistry {
  // Map of targetNodeId -> KnowledgeEdge[]
  private pendingByTarget = new Map<string, KnowledgeEdge[]>();

  public register(edge: KnowledgeEdge): void {
    if (!this.pendingByTarget.has(edge.targetNodeId)) {
      this.pendingByTarget.set(edge.targetNodeId, []);
    }
    const list = this.pendingByTarget.get(edge.targetNodeId)!;
    
    // Deduplicate pending edges to prevent multiple registrations of the same edge ID
    if (!list.some(e => e.id === edge.id)) {
      list.push(edge);
    }
  }

  public getAndClear(targetNodeId: string): KnowledgeEdge[] {
    const list = this.pendingByTarget.get(targetNodeId) || [];
    this.pendingByTarget.delete(targetNodeId);
    return list;
  }

  public getPendingCount(): number {
    let count = 0;
    for (const list of this.pendingByTarget.values()) {
      count += list.length;
    }
    return count;
  }
}
