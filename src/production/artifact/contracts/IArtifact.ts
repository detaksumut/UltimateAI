export enum ArtifactType {
  PLANNING_BLUEPRINT = "PLANNING_BLUEPRINT",
  MEMORY_SNAPSHOT = "MEMORY_SNAPSHOT",
  REASONING_RESULT = "REASONING_RESULT",
  VALIDATION_RESULT = "VALIDATION_RESULT",
  FINAL_OUTPUT = "FINAL_OUTPUT",
  INTERMEDIATE_DATA = "INTERMEDIATE_DATA",
  CERTIFICATION_REPORT = "CERTIFICATION_REPORT"
}

export enum ArtifactStatus {
  DRAFT = "DRAFT",
  FINAL = "FINAL",
  SUPERSEDED = "SUPERSEDED",
  ARCHIVED = "ARCHIVED"
}

export interface ArtifactIdentity {
  readonly id: string;
  readonly type: ArtifactType;
  readonly version: number;
  readonly timestamp: number;
  readonly contentHash: string; // Hash of the payload for deduplication and integrity
}

export interface ArtifactTrace {
  readonly traceId: string;
  readonly workflowId?: string;
  readonly jobId?: string;
  readonly taskId?: string;
}

export interface ArtifactLineage {
  readonly parentIds: string[]; // Artifacts used as inputs to create this
  readonly derivedArtifactIds: string[]; // Artifacts generated from this (updated dynamically)
}

export interface ArtifactProvenance {
  readonly creatorCapability: string; // e.g. "PLANNING"
  readonly creatorProvider?: string; // e.g. "OpenAI"
}

export interface ArtifactMetadata {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly labels: string[];
  readonly tags: Record<string, string>;
  readonly custom: Record<string, any>; // Flexible metadata
}

export interface IArtifact<T = any> {
  readonly identity: ArtifactIdentity;
  readonly status: ArtifactStatus;
  readonly trace: ArtifactTrace;
  readonly lineage: ArtifactLineage;
  readonly provenance: ArtifactProvenance;
  readonly metadata: ArtifactMetadata;
  readonly payload: T; // The actual data
}
