/**
 * IAnalysisContext.ts
 *
 * Defines the complete context required for analysis.
 * Isolates the analyzer from direct coupling to specific state/action catalog files.
 */

import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';
import { IAutomationManifest } from '../../automation/contracts/IAutomationManifest';

export interface IAnalysisContext {
  readonly model: IWorkflowModel;
  readonly manifest?: IAutomationManifest;
  
  // Catalog snapshots for cross-validation without I/O
  readonly catalog_snapshot: {
    readonly states: string[];
    readonly actions: string[];
  };
}
