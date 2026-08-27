/**
 * ICompilationArtifact.ts
 *
 * The ultimate agnostic output of the Compiler.
 * Adapters consume this artifact to build target-specific code.
 */

export interface ICompilationArtifact {
  readonly workflow_id: string;
  readonly artifact_type: 'native' | 'n8n' | 'temporal' | 'camunda';
  readonly target: string;
  
  readonly metadata: {
    readonly compiler_version: string;
    readonly generated_at: string;
    readonly checksum: string; // Hash of the final payload
  };
  
  // The normalized, optimized, ready-to-deploy workflow structure
  readonly payload: any;
}
