/**
 * IAnalysisReport.ts
 *
 * Defines the diagnostic structure of static analysis findings.
 */

export interface IDiagnosticFinding {
  readonly code: string; // e.g. "WF001"
  readonly severity: 'error' | 'warning' | 'suggestion';
  readonly message: string;
  readonly affected_elements: string[]; // e.g. state names or transition ids
}

export interface IAnalysisReport {
  readonly findings: IDiagnosticFinding[];
  
  readonly summary: {
    readonly errors: number;
    readonly warnings: number;
    readonly suggestions: number;
    readonly is_valid: boolean; // true if errors === 0
  };
}
