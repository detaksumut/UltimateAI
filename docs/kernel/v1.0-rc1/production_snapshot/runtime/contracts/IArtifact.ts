// src/production/runtime/contracts/IArtifact.ts

/**
 * The immutable identity of an artifact.
 */
export interface ArtifactIdentity {
  readonly artifactId: string;
  readonly createdAt: number; // Unix Epoch
}

/**
 * The trace metadata that allows complete end-to-end reconstruction of the artifact's origin.
 */
export interface ArtifactTrace {
  readonly traceId: string;
  readonly correlationId: string;
  readonly pipelineId?: string;
  readonly executionId?: string;
}

/**
 * Principle 45: Every Artifact Is Traceable.
 * The foundational contract for all payloads exchanged across the Cognitive Loop.
 */
export interface IArtifact {
  readonly identity: ArtifactIdentity;
  readonly trace: ArtifactTrace;
}
