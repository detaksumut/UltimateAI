/**
 * ICompilationAdapter.ts
 *
 * Ports & Adapters: Interface for all target deployment adapters.
 * They receive the fully optimized and verified ICompilationArtifact.
 * They NEVER perform validation or business logic.
 */

import { ICompilationArtifact } from '../contracts/ICompilationArtifact';

export interface ICompilationAdapter {
  readonly target: string;
  adapt(artifact: ICompilationArtifact): any; // Returns target-specific payload
}
