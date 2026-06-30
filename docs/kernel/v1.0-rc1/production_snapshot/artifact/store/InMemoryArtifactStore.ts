import { IArtifactStore } from "./IArtifactStore";
import { IArtifact, ArtifactStatus } from "../contracts/IArtifact";

export class InMemoryArtifactStore implements IArtifactStore {
  // Map of artifactId -> array of versions (sorted by version ascending)
  private store = new Map<string, IArtifact[]>();

  async save(artifact: IArtifact): Promise<void> {
    const { id, version } = artifact.identity;
    
    if (!this.store.has(id)) {
      this.store.set(id, []);
    }
    
    const versions = this.store.get(id)!;
    
    // Check if version already exists (for updates like derivedArtifactIds)
    const existingIndex = versions.findIndex(a => a.identity.version === version);
    if (existingIndex >= 0) {
      versions[existingIndex] = artifact;
    } else {
      // New version
      versions.push(artifact);
      versions.sort((a, b) => a.identity.version - b.identity.version);
    }
  }

  async get(id: string, version: number): Promise<IArtifact | undefined> {
    const versions = this.store.get(id);
    if (!versions) return undefined;
    
    return versions.find(a => a.identity.version === version);
  }

  async getLatest(id: string): Promise<IArtifact | undefined> {
    const versions = this.store.get(id);
    if (!versions || versions.length === 0) return undefined;
    
    return versions[versions.length - 1]; // Because we sort ascending on save
  }

  async findByTrace(traceId: string): Promise<IArtifact[]> {
    const results: IArtifact[] = [];
    
    for (const versions of this.store.values()) {
      for (const artifact of versions) {
        if (artifact.trace.traceId === traceId) {
          results.push(artifact);
        }
      }
    }
    
    return results;
  }
}
