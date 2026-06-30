import { 
  IArtifact, 
  ArtifactType, 
  ArtifactStatus, 
  ArtifactTrace, 
  ArtifactProvenance 
} from "../contracts/IArtifact";
import * as crypto from "crypto";

export class ArtifactFactory {
  /**
   * Generates a deterministic hash for the payload.
   */
  static hashPayload(payload: any): string {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Creates a brand new artifact (Version 1).
   */
  static create<T>(
    id: string,
    type: ArtifactType,
    payload: T,
    trace: ArtifactTrace,
    provenance: ArtifactProvenance,
    parentIds: string[] = [],
    labels: string[] = []
  ): IArtifact<T> {
    
    const now = Date.now();
    const hash = this.hashPayload(payload);

    return {
      identity: {
        id,
        type,
        version: 1,
        timestamp: now,
        contentHash: hash
      },
      status: ArtifactStatus.DRAFT, // Default for new outputs
      trace,
      lineage: {
        parentIds,
        derivedArtifactIds: []
      },
      provenance,
      metadata: {
        createdAt: now,
        updatedAt: now,
        labels,
        tags: {},
        custom: {}
      },
      payload
    };
  }

  /**
   * Evolves an existing artifact into a new version.
   * Identity ID remains the same, version increments, timestamps update.
   */
  static evolve<T>(
    previous: IArtifact<any>,
    newPayload: T,
    provenance: ArtifactProvenance,
    additionalParentIds: string[] = []
  ): IArtifact<T> {
    const now = Date.now();
    const hash = this.hashPayload(newPayload);
    
    return {
      identity: {
        id: previous.identity.id,
        type: previous.identity.type,
        version: previous.identity.version + 1,
        timestamp: now,
        contentHash: hash
      },
      status: ArtifactStatus.DRAFT,
      trace: previous.trace,
      lineage: {
        parentIds: Array.from(new Set([...previous.lineage.parentIds, ...additionalParentIds])),
        derivedArtifactIds: [] // Resets for the new version
      },
      provenance,
      metadata: {
        createdAt: previous.metadata.createdAt,
        updatedAt: now,
        labels: previous.metadata.labels,
        tags: previous.metadata.tags,
        custom: previous.metadata.custom
      },
      payload: newPayload
    };
  }
}
