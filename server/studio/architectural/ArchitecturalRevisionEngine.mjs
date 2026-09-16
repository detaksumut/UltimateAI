/**
 * server/studio/architectural/ArchitecturalRevisionEngine.mjs
 * Coordinated Revision Propagation and Impact Analyzer.
 */

import { COMPONENT_STATUS, masterDesignStateInstance } from './MasterDesignState.mjs';

export class ArchitecturalRevisionEngine {
  constructor(stateManager = masterDesignStateInstance) {
    this.state = stateManager;
  }

  /**
   * Evaluates the impact of an architectural revision instruction without necessarily applying it yet.
   */
  evaluateRevision(instruction = '', state = null) {
    const project = state || this.state.getState();
    const clean = String(instruction || '').toLowerCase();
    const affectedComponents = [];

    // 1. Spatial layout modification (moving rooms, resizing)
    if (/geser|pindah|tukar|kamar|ruang|dapur|garasi|posisi|luaskan/i.test(clean)) {
      affectedComponents.push('floorPlan', 'structure', 'rearElevation', 'leftElevation', 'rightElevation', '3dModel', 'hologram');
    } 
    // 2. Facade, roof, or material modification
    else if (/warna|cat|material|fasad|kayu|batu\s+alam|kaca|atap|genteng/i.test(clean)) {
      affectedComponents.push('frontElevation', 'leftElevation', 'rightElevation', 'rearElevation', '3dModel', 'hologram');
    } 
    // 3. General revision
    else {
      affectedComponents.push('floorPlan', '3dModel');
    }

    return {
      instruction: instruction.trim(),
      affectedComponents,
      requiresRegeneration: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Evaluates a user revision instruction and propagates updates across affected artifacts.
   */
  applyRevision(instructionOrEval = '', stateManagerOverride = null) {
    const stateMgr = stateManagerOverride || this.state;
    const project = stateMgr.getState();
    if (!project) {
      throw new Error('Cannot apply revision: no active architectural project');
    }

    const instruction = typeof instructionOrEval === 'object' && instructionOrEval.instruction
      ? instructionOrEval.instruction
      : String(instructionOrEval || '');

    const evaluation = typeof instructionOrEval === 'object' && Array.isArray(instructionOrEval.affectedComponents)
      ? instructionOrEval
      : this.evaluateRevision(instruction, project);

    const affectedComponents = evaluation.affectedComponents;

    // Propagate COMPONENT_STATUS.UPDATE_REQUIRED to affected components in state
    if (affectedComponents.includes('floorPlan')) {
      project.floorPlan.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }
    if (affectedComponents.includes('structure')) {
      project.structure.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }
    if (affectedComponents.includes('frontElevation') || affectedComponents.includes('elevations')) {
      project.elevations.front.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }
    if (affectedComponents.includes('leftElevation') || affectedComponents.includes('elevations')) {
      project.elevations.left.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }
    if (affectedComponents.includes('rightElevation') || affectedComponents.includes('elevations')) {
      project.elevations.right.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }
    if (affectedComponents.includes('rearElevation') || affectedComponents.includes('elevations')) {
      project.elevations.rear.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }
    if (affectedComponents.includes('3dModel')) {
      project.visualization.exterior3D.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }
    if (affectedComponents.includes('hologram')) {
      project.visualization.hologram3D.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    }

    // Record in revision log
    const revRecord = {
      revId: `REV-${project.revisionHistory.length + 1}`,
      timestamp: new Date().toISOString(),
      instruction,
      affectedComponents
    };
    project.revisionHistory.push(revRecord);
    project.status = COMPONENT_STATUS.UPDATE_REQUIRED;
    project.updatedAt = new Date().toISOString();
    
    stateMgr.saveState();
    console.log(`[REVISION_ENGINE] Applied revision "${instruction}". ${affectedComponents.length} components flagged for update.`);

    return project;
  }
}

export const architecturalRevisionEngineInstance = new ArchitecturalRevisionEngine();
export default architecturalRevisionEngineInstance;
