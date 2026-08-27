/**
 * NativePackageAdapter.ts
 *
 * Generates the Native Package.
 * The Native Runtime just loads this directly.
 */

import { ICompilationAdapter } from './ICompilationAdapter';
import { ICompilationArtifact } from '../contracts/ICompilationArtifact';

export class NativePackageAdapter implements ICompilationAdapter {
  public readonly target = 'native';
  
  public adapt(artifact: ICompilationArtifact): any {
    // Native Package is simply the Canonical WorkflowModel plus manifest metadata
    return {
      format: 'UltimateAINative',
      package_version: '1.0',
      artifact_checksum: artifact.metadata.checksum,
      workflow: artifact.payload
    };
  }
}
