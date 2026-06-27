// src/builder/approval/ApprovalManager.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';

export class ApprovalManager {
  /**
   * Approves and locks the project model.
   */
  public approve(model: ProjectIntelligenceModel): ProjectIntelligenceModel {
    return {
      ...model,
      locked: true
    };
  }

  /**
   * Verifies if the project model is locked/approved.
   */
  public isApproved(model: ProjectIntelligenceModel): boolean {
    return !!model.locked;
  }
}
