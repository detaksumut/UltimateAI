/**
 * IAnalysisRule.ts
 *
 * Interface for all static analysis rules (Structural & Semantic).
 */

import { IAnalysisContext } from '../../contracts/IAnalysisContext';
import { IDiagnosticFinding } from '../../contracts/IAnalysisReport';

export interface IAnalysisRule {
  evaluate(context: IAnalysisContext): IDiagnosticFinding[];
}
