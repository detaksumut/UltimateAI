import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";
import { ArtifactRepository } from "../../artifact/repository/ArtifactRepository";
import { IKnowledgeStore } from "../store/IKnowledgeStore";
import { KnowledgeNode } from "../contracts/KnowledgeNode";
import { KnowledgeEdge } from "../contracts/KnowledgeEdge";
import { KnowledgeNodeType } from "../contracts/KnowledgeNodeType";
import { KnowledgeRelationType } from "../contracts/KnowledgeRelationType";

export class KnowledgeIngestionEngine {
  constructor(
    private readonly eventBus: IRuntimeEventBus,
    private readonly artifactRepo: ArtifactRepository,
    private readonly knowledgeStore: IKnowledgeStore
  ) {
    this.register();
  }

  private register() {
    this.eventBus.subscribe("ArtifactStored", async (event) => {
      console.log(`[KnowledgeIngestionEngine] Received event: ${JSON.stringify(event.payload)}`);
      try {
        await this.handleArtifactStored(event.payload.artifactId, event.payload.version);
      } catch (e) {
        console.error("[KnowledgeIngestionEngine] Failed to ingest artifact:", e);
      }
    });
  }

  private async handleArtifactStored(artifactId: string, version: number) {
    // 1. Retrieve the full artifact payload from the single source of truth
    const artifact = await this.artifactRepo.get(artifactId, version);
    if (!artifact) return;

    // We use a deterministic node ID for the artifact node
    const artifactNodeId = `kn-${artifact.identity.id}-v${artifact.identity.version}`;
    
    // Idempotency check: Does this node already exist?
    const existing = await this.knowledgeStore.getNode(artifactNodeId);
    if (existing) return; // Already ingested

    const now = Date.now();

    // 2. Create the Artifact Node
    const node: KnowledgeNode = {
      identity: {
        id: artifactNodeId,
        nodeType: KnowledgeNodeType.ARTIFACT_NODE,
        version: 1,
        createdAt: now
      },
      artifactId: artifact.identity.id,
      contentHash: artifact.identity.contentHash,
      metadata: {
        creatorCapability: artifact.provenance.creatorCapability,
        traceId: artifact.trace.traceId
      }
    };
    await this.knowledgeStore.saveNode(node);

    // 3. Create Edges for Lineage (DERIVED_FROM)
    for (const parentId of artifact.lineage.parentIds) {
      // Find the parent's latest node ID. For simplicity here, we assume we link to the latest known node for that artifact ID.
      // In a robust system, the parentIds in lineage should probably include versions.
      // But for this demonstration, we'll just link to the logical artifact ID.
      
      const edge: KnowledgeEdge = {
        id: `edge-${parentId}-to-${artifactNodeId}`,
        relationType: KnowledgeRelationType.DERIVED_FROM,
        sourceNodeId: artifactNodeId, // This artifact is derived FROM parent
        targetNodeId: `kn-${parentId}-v1`, // Assuming v1 for simplicity, ideally we'd query the graph
        confidence: 1.0,
        createdAt: now
      };
      await this.knowledgeStore.saveEdge(edge);
    }

    // 4. Create Edges for Provenance (GENERATED_BY)
    if (artifact.provenance.creatorCapability) {
      const capabilityNodeId = `cap-${artifact.provenance.creatorCapability}`;
      
      // Ensure capability node exists
      if (!(await this.knowledgeStore.getNode(capabilityNodeId))) {
        await this.knowledgeStore.saveNode({
          identity: {
            id: capabilityNodeId,
            nodeType: KnowledgeNodeType.CAPABILITY_NODE,
            version: 1,
            createdAt: now
          },
          artifactId: "",
          contentHash: "",
          metadata: {}
        });
      }

      await this.knowledgeStore.saveEdge({
        id: `edge-${artifactNodeId}-gen-${capabilityNodeId}`,
        relationType: KnowledgeRelationType.GENERATED_BY,
        sourceNodeId: artifactNodeId,
        targetNodeId: capabilityNodeId,
        confidence: 1.0,
        createdAt: now
      });
    }

    // 5. Create Edges for Trace (BELONGS_TO)
    if (artifact.trace.traceId) {
      const traceNodeId = `trace-${artifact.trace.traceId}`;
      
      if (!(await this.knowledgeStore.getNode(traceNodeId))) {
        await this.knowledgeStore.saveNode({
          identity: {
            id: traceNodeId,
            nodeType: KnowledgeNodeType.CONTEXT_NODE,
            version: 1,
            createdAt: now
          },
          artifactId: "",
          contentHash: "",
          metadata: {}
        });
      }

      await this.knowledgeStore.saveEdge({
        id: `edge-${artifactNodeId}-bel-${traceNodeId}`,
        relationType: KnowledgeRelationType.BELONGS_TO,
        sourceNodeId: artifactNodeId,
        targetNodeId: traceNodeId,
        confidence: 1.0,
        createdAt: now
      });
    }
    
    console.log(`[KnowledgeIngestion] Ingested Artifact ${artifact.identity.id} -> Node ${artifactNodeId}`);
  }
}
