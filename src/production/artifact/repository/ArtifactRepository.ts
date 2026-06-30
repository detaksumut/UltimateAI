import { IArtifactStore } from "../store/IArtifactStore";
import { IArtifact, ArtifactStatus } from "../contracts/IArtifact";
import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";

export class ArtifactRepository {
  constructor(
    private readonly store: IArtifactStore,
    private readonly eventBus: IRuntimeEventBus
  ) {}

  async save(artifact: IArtifact): Promise<void> {
    const isNew = await this.store.get(artifact.identity.id, artifact.identity.version) === undefined;
    
    // If it's a new version (version > 1), we should ideally mark the older version as SUPERSEDED.
    // In a real database, we would run a transaction here.
    if (isNew && artifact.identity.version > 1) {
      const older = await this.store.getLatest(artifact.identity.id);
      if (older && older.identity.version < artifact.identity.version) {
        // Mark old as superseded (creates a mutated copy since artifacts are immutable)
        const superseded = { ...older, status: ArtifactStatus.SUPERSEDED };
        await this.store.save(superseded);
      }
    }
    
    await this.store.save(artifact);
    
    this.eventBus.publish({
      eventId: `art-evt-${Date.now()}`,
      correlationId: artifact.trace.traceId,
      executionId: "",
      runtimeId: "artifact-repo",
      eventType: "ArtifactStored",
      timestamp: Date.now(),
      payload: { artifactId: artifact.identity.id, version: artifact.identity.version }
    });
  }

  async getLatest(id: string): Promise<IArtifact | undefined> {
    const artifact = await this.store.getLatest(id);
    if (artifact) {
      this.eventBus.publish({
        eventId: `art-evt-${Date.now()}`,
        correlationId: artifact.trace.traceId,
        executionId: "",
        runtimeId: "artifact-repo",
        eventType: "ArtifactRetrieved",
        timestamp: Date.now(),
        payload: { artifactId: artifact.identity.id, version: artifact.identity.version }
      });
    }
    return artifact;
  }

  async get(id: string, version: number): Promise<IArtifact | undefined> {
    return this.store.get(id, version);
  }

  async findByTrace(traceId: string): Promise<IArtifact[]> {
    return this.store.findByTrace(traceId);
  }
}
