import { IArtifactManifest } from "./IArtifactManifest";

export interface LogFileArtifact {
  readonly filepath: string;
  readonly content: string;
}

/**
 * IArtifactBundle
 * Kontrak arsitektur tingkat Foundation untuk menampung representasi memori imutabel dari berkas-berkas fisik hasil kompilasi.
 */
export interface IArtifactBundle {
  readonly bundleId: string;
  readonly executionId: string;
  readonly blueprintId: string;
  readonly artifacts: LogFileArtifact[];
  readonly manifest: IArtifactManifest;
  readonly bundleHash: string; // SHA-256 signature dari representasi data bundle
}
