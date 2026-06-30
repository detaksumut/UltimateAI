import { RuntimeEventBusImpl } from "../../../production/runtime/events/RuntimeEventBus";
import { InMemoryArtifactStore } from "../../../production/artifact/store/InMemoryArtifactStore";
import { ArtifactRepository } from "../../../production/artifact/repository/ArtifactRepository";
import { InMemoryKnowledgeStore } from "../../../production/knowledge/store/InMemoryKnowledgeStore";
import { KnowledgeIngestionEngine } from "../../../production/knowledge/ingestion/KnowledgeIngestionEngine";
import { IArtifact, ArtifactType, ArtifactStatus } from "../../../production/artifact/contracts/IArtifact";

import { SystemClock } from "../../../infrastructure/clock/SystemClock";
import { PendingReferenceRegistry } from "../../../production/knowledge/ingestion/PendingReferenceRegistry";

export class KnowledgeTestEnvironment {
  public eventBus = new RuntimeEventBusImpl();
  public artifactStore = new InMemoryArtifactStore();
  public artifactRepo = new ArtifactRepository(this.artifactStore, this.eventBus);
  public knowledgeStore = new InMemoryKnowledgeStore();
  public ingestionEngine = new KnowledgeIngestionEngine(
    this.eventBus,
    this.artifactRepo,
    this.knowledgeStore,
    new SystemClock(),
    new PendingReferenceRegistry()
  );

  public createDummyArtifact(id: string, parentIds: string[] = []): IArtifact {
    return {
      identity: {
        id,
        type: ArtifactType.FINAL_OUTPUT,
        version: 1,
        timestamp: Date.now(),
        contentHash: `hash-${id}`
      },
      status: ArtifactStatus.FINAL,
      trace: {
        traceId: `t-${id}`
      },
      lineage: {
        parentIds,
        derivedArtifactIds: []
      },
      provenance: {
        creatorCapability: "PLANNING"
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        labels: [],
        tags: {},
        custom: {}
      },
      payload: `payload-${id}`
    };
  }

  public async saveArtifact(artifact: IArtifact): Promise<void> {
    await this.artifactRepo.save(artifact);
    // Yield execution to allow event handlers on the event loop to finish
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
