/**
 * DuplicateTransitionRule.ts
 *
 * Diagnostic Code: WF002
 * Checks for identical transitions (same from, to, and action).
 */

import { IAnalysisRule } from './IAnalysisRule';
import { IAnalysisContext } from '../../contracts/IAnalysisContext';
import { IDiagnosticFinding } from '../../contracts/IAnalysisReport';

export class DuplicateTransitionRule implements IAnalysisRule {
  public evaluate(context: IAnalysisContext): IDiagnosticFinding[] {
    const findings: IDiagnosticFinding[] = [];
    const seen = new Set<string>();
    
    for (const t of context.model.transitions) {
      const sig = `${t.from}|${t.action}|${t.to}`;
      if (seen.has(sig)) {
        findings.push({
          code: 'WF002',
          severity: 'warning',
          message: `Duplicate transition detected from '${t.from}' via '${t.action}' to '${t.to}'.`,
          affected_elements: [sig]
        });
      } else {
        seen.add(sig);
      }
    }
    
    return findings;
  }
}
