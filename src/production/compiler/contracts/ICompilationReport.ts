/**
 * ICompilationReport.ts
 *
 * Comprehensive engineering artifact summarizing the entire compilation lifecycle.
 */

import { ICompilationArtifact } from './ICompilationArtifact';

export interface ICompilationReport {
  readonly target: string;
  readonly duration_ms: number;
  readonly passes_executed: string[];
  readonly diagnostics_status: string;
  readonly diagnostic_messages: string[];
  readonly artifact_checksum?: string;
  readonly artifact?: ICompilationArtifact; // Only present if compilation succeeded
}
