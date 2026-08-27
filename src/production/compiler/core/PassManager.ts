/**
 * PassManager.ts
 *
 * Orchestrates the sequential execution of compiler passes.
 */

import { ICompilerPass } from '../pass/ICompilerPass';
import { ICompilationContext } from '../contracts/ICompilationContext';
import { ICompilationReport } from '../contracts/ICompilationReport';

export class PassManager {
  private passes: ICompilerPass[] = [];
  
  public addPass(pass: ICompilerPass): void {
    this.passes.push(pass);
  }
  
  public run(context: ICompilationContext): ICompilationReport {
    const startTime = Date.now();
    const passesExecuted: string[] = [];
    
    for (const pass of this.passes) {
      if (context.diagnostics.status === 'FAIL') break;
      pass.execute(context);
      passesExecuted.push(pass.name);
    }
    
    const duration = Date.now() - startTime;
    
    return {
      target: context.manifest.operational.runtime,
      duration_ms: duration,
      passes_executed: passesExecuted,
      diagnostics_status: context.diagnostics.status,
      diagnostic_messages: context.diagnostics.messages,
      artifact_checksum: context.artifact?.metadata.checksum,
      artifact: context.artifact
    };
  }
}
