export interface ArtifactRecord {
  readonly artifactId: string;
  readonly requirementId: string;
  readonly analysisId: string;
  readonly blueprintId: string;
  readonly executionId: string;
  readonly bundleId: string;
  readonly filepath: string;
  readonly filehash: string;
  readonly filetype: "BACKEND" | "DATABASE" | "API" | "CONFIG" | "DOCUMENTATION" | "MANIFEST";
  readonly generatedAt: number;
}

/**
 * IArtifactManifest
 * Kontrak arsitektur tingkat Foundation untuk menjamin traceability jejak audit audit secara end-to-end.
 */
export interface IArtifactManifest {
  readonly manifestId: string;
  readonly blueprintId: string;
  readonly executionId: string;
  readonly records: ArtifactRecord[];
}
