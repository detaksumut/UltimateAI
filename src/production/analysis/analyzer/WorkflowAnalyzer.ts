/**
 * WorkflowAnalyzer.ts
 *
 * Orchestrator that applies all registered rules against the context.
 */

import { IAnalysisContext } from '../contracts/IAnalysisContext';
import { IAnalysisReport, IDiagnosticFinding } from '../contracts/IAnalysisReport';
import { IAnalysisRule } from './rules/IAnalysisRule';
import { DeadStateRule } from './rules/DeadStateRule';
import { DuplicateTransitionRule } from './rules/DuplicateTransitionRule';

export class WorkflowAnalyzer {
  private rules: IAnalysisRule[];
  
  constructor(additionalRules: IAnalysisRule[] = []) {
    // Default rules
    this.rules = [
      new DeadStateRule(),
      new DuplicateTransitionRule(),
      ...additionalRules
    ];
  }
  
  public analyze(context: IAnalysisContext): IAnalysisReport {
    const findings: IDiagnosticFinding[] = [];
    let errors = 0;
    let warnings = 0;
    let suggestions = 0;
    
    for (const rule of this.rules) {
      const results = rule.evaluate(context);
      findings.push(...results);
      
      for (const r of results) {
        if (r.severity === 'error') errors++;
        if (r.severity === 'warning') warnings++;
        if (r.severity === 'suggestion') suggestions++;
      }
    }
    
    return {
      findings,
      summary: {
        errors,
        warnings,
        suggestions,
        is_valid: errors === 0
      }
    };
  }
}
