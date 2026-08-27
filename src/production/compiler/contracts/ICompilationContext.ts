/**
 * ICompilationContext.ts
 *
 * The shared state passed sequentially through all Compiler Passes.
 * Prevents redundant querying and encapsulates the compilation lifecycle.
 */

import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';
import { IAutomationManifest } from '../../automation/contracts/IAutomationManifest';
import { IAnalysisReport } from '../../analysis/contracts/IAnalysisReport';
import { IOptimizationResult } from '../../analysis/contracts/IOptimizationResult';
import { ICompilationArtifact } from './ICompilationArtifact';

export interface ICompilationContext {
  readonly manifest: IAutomationManifest;
  
  // Evolving states during compilation
  workflow_model: IWorkflowModel;
  analysis_report?: IAnalysisReport;
  optimization_result?: IOptimizationResult;
  artifact?: ICompilationArtifact;
  
  readonly diagnostics: {
    status: 'PENDING' | 'PASS' | 'WARNING' | 'FAIL';
    messages: string[];
  };
}
