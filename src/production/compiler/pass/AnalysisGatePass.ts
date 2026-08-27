/**
 * AnalysisGatePass.ts
 *
 * Prevents compilation if the WorkflowAnalyzer detects critical issues.
 * Sets the diagnostic status to PASS, WARNING, or FAIL.
 */

import { ICompilerPass } from './ICompilerPass';
import { ICompilationContext } from '../contracts/ICompilationContext';
import { WorkflowAnalyzer } from '../../analysis/analyzer/WorkflowAnalyzer';

export class AnalysisGatePass implements ICompilerPass {
  public readonly name = 'AnalysisGatePass';
  
  public execute(context: ICompilationContext): void {
    const analyzer = new WorkflowAnalyzer();
    const report = analyzer.analyze({
      model: context.workflow_model,
      manifest: context.manifest,
      catalog_snapshot: { states: [], actions: [] }
    });
    
    context.analysis_report = report;
    
    if (report.summary.errors > 0) {
      context.diagnostics.status = 'FAIL';
      context.diagnostics.messages.push(`Compilation aborted: ${report.summary.errors} errors found.`);
    } else if (report.summary.warnings > 0) {
      context.diagnostics.status = 'WARNING';
      context.diagnostics.messages.push(`Compilation proceeding with ${report.summary.warnings} warnings.`);
    } else {
      context.diagnostics.status = 'PASS';
    }
  }
}
