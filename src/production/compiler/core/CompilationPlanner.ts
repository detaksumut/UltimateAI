/**
 * CompilationPlanner.ts
 *
 * Factory that defines the Compilation Strategy (Passes + Adapter) based on Manifest.
 */

import { IAutomationManifest } from '../../automation/contracts/IAutomationManifest';
import { PassManager } from './PassManager';
import { AnalysisGatePass } from '../pass/AnalysisGatePass';
import { StructuralCleanupPass } from '../pass/StructuralCleanupPass';
import { ArtifactBuilderPass } from '../pass/ArtifactBuilderPass';
import { ICompilationAdapter } from '../adapters/ICompilationAdapter';
import { NativePackageAdapter } from '../adapters/NativePackageAdapter';
import { N8nAdapter } from '../adapters/N8nAdapter';

export interface ICompilationStrategy {
  passManager: PassManager;
  adapter: ICompilationAdapter;
}

export class CompilationPlanner {
  
  public plan(manifest: IAutomationManifest): ICompilationStrategy {
    const pm = new PassManager();
    
    // Standard Universal Passes (Analysis -> Clean -> Build)
    pm.addPass(new AnalysisGatePass());
    pm.addPass(new StructuralCleanupPass());
    pm.addPass(new ArtifactBuilderPass());
    
    let adapter: ICompilationAdapter;
    
    switch (manifest.operational.runtime) {
      case 'native':
        adapter = new NativePackageAdapter();
        break;
      case 'n8n':
        adapter = new N8nAdapter();
        break;
      default:
        throw new Error(`Compilation Strategy not supported for target: ${manifest.operational.runtime}`);
    }
    
    return {
      passManager: pm,
      adapter: adapter
    };
  }
}
