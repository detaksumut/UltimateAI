// src/production/execution/store/IExecutionArtifactStore.ts

/**
 * Dedicated storage for heavy physical artifacts generated during execution
 * (e.g., builds, temporary files, diff patches, images).
 * Separates heavy payload from the lightweight ExecutionLog.
 */
export interface IExecutionArtifactStore {
  /**
   * Stores a physical artifact and returns a lightweight reference ID.
   */
  storeArtifact(executionId: string, artifactName: string, bufferOrPath: any): Promise<string>;
  
  /**
   * Retrieves a previously stored physical artifact.
   */
  getArtifact(artifactId: string): Promise<any>;
}
