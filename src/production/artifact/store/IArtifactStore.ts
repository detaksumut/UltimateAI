import { IArtifact } from "../contracts/IArtifact";

export interface IArtifactStore {
  /**
   * Save a new artifact or update an existing one (e.g., adding derived lineage or updating status).
   */
  save(artifact: IArtifact): Promise<void>;
  
  /**
   * Retrieve an artifact by exact ID and Version.
   */
  get(id: string, version: number): Promise<IArtifact | undefined>;
  
  /**
   * Retrieve the latest version of an artifact by ID.
   */
  getLatest(id: string): Promise<IArtifact | undefined>;
  
  /**
   * Query all artifacts associated with a trace.
   */
  findByTrace(traceId: string): Promise<IArtifact[]>;
}
