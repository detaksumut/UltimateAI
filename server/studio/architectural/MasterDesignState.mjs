/**
 * server/studio/architectural/MasterDesignState.mjs
 * Single Source of Truth Persistent State Manager for Architectural Projects.
 */

import fs from 'fs';
import path from 'path';

export const COMPONENT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  REVIEW: 'REVIEW',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
  UPDATE_REQUIRED: 'UPDATE_REQUIRED',
  FINAL: 'FINAL'
});

export const PRODUCTION_STEPS = Object.freeze([
  'STEP_01_DENAH',
  'STEP_02_STRUKTUR',
  'STEP_03_TAMPAK_DEPAN',
  'STEP_04_TAMPAK_KIRI',
  'STEP_05_TAMPAK_KANAN',
  'STEP_06_TAMPAK_BELAKANG',
  'STEP_07_MODEL_3D',
  'STEP_08_HOLOGRAM_3D'
]);

export class MasterDesignState {
  constructor(storageDir = 'd:/Users/ultimateai/artifacts/architecture') {
    this.storageDir = storageDir;
    this._ensureDir();
    this.activeProject = null;
  }

  _ensureDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Initializes a new architectural project state from site analysis and design program.
   */
  createProject(projectId, siteAnalysis, designProgram) {
    const state = {
      projectId: projectId || `ARCH-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: COMPONENT_STATUS.DRAFT,
      currentStep: 'STEP_00_MASTER_DRAFT',

      site: {
        width: siteAnalysis.dimensions.width,
        length: siteAnalysis.dimensions.length,
        totalArea: siteAnalysis.dimensions.totalArea,
        orientation: siteAnalysis.orientation.value,
        setbacks: siteAnalysis.setbacks
      },

      architecture: {
        style: designProgram.concept.style,
        floors: designProgram.concept.floors,
        massing: designProgram.concept.massing,
        roof: designProgram.concept.roofType,
        facadeMaterials: designProgram.concept.facadeMaterials
      },

      floorPlan: {
        status: COMPONENT_STATUS.DRAFT,
        zoning: designProgram.zoning,
        metrics: designProgram.metrics,
        artifact: null
      },

      structure: {
        status: COMPONENT_STATUS.DRAFT,
        type: 'Grid Kolom Beton Bertulang 4x4m & Rangka Baja Ringan Baja Berat',
        artifact: null
      },

      elevations: {
        front: { status: COMPONENT_STATUS.DRAFT, artifact: null },
        left: { status: COMPONENT_STATUS.DRAFT, artifact: null },
        right: { status: COMPONENT_STATUS.DRAFT, artifact: null },
        rear: { status: COMPONENT_STATUS.DRAFT, artifact: null }
      },

      visualization: {
        exterior3D: { status: COMPONENT_STATUS.DRAFT, artifact: null },
        hologram3D: { status: COMPONENT_STATUS.DRAFT, artifact: null }
      },

      revisionHistory: []
    };

    this.activeProject = state;
    this.saveState();
    return state;
  }

  getState() {
    return this.activeProject;
  }

  saveState() {
    if (!this.activeProject) return;
    try {
      const filePath = path.join(this.storageDir, `${this.activeProject.projectId}_state.json`);
      fs.writeFileSync(filePath, JSON.stringify(this.activeProject, null, 2), 'utf8');
    } catch (e) {
      console.error('[MasterDesignState] Failed to persist state:', e.message);
    }
  }

  approveMasterDraft() {
    if (!this.activeProject) throw new Error('No active architectural project to approve');
    this.activeProject.status = COMPONENT_STATUS.APPROVED;
    this.activeProject.currentStep = 'STEP_01_DENAH';
    this.activeProject.updatedAt = new Date().toISOString();
    this.saveState();
    console.log(`[MASTER_STATE] Project ${this.activeProject.projectId} Master Draft APPROVED. Moving to STEP_01_DENAH.`);
    return this.activeProject;
  }

  lockFloorPlan(artifact) {
    if (!this.activeProject) throw new Error('No active project');
    this.activeProject.floorPlan.status = COMPONENT_STATUS.LOCKED;
    this.activeProject.floorPlan.artifact = artifact;
    this.activeProject.currentStep = 'STEP_02_STRUKTUR';
    this.activeProject.updatedAt = new Date().toISOString();
    this.saveState();
    console.log(`[MASTER_STATE] FLOOR_PLAN LOCKED. Next: STEP_02_STRUKTUR.`);
    return this.activeProject;
  }

  lockStructure(artifact) {
    if (!this.activeProject) throw new Error('No active project');
    this.activeProject.structure.status = COMPONENT_STATUS.LOCKED;
    this.activeProject.structure.artifact = artifact;
    this.activeProject.currentStep = 'STEP_03_TAMPAK_DEPAN';
    this.activeProject.updatedAt = new Date().toISOString();
    this.saveState();
    console.log(`[MASTER_STATE] STRUCTURE LOCKED. Next: STEP_03_TAMPAK_DEPAN.`);
    return this.activeProject;
  }

  completeElevation(face, artifact) {
    if (!this.activeProject) throw new Error('No active project');
    if (!this.activeProject.elevations[face]) throw new Error(`Invalid elevation face: ${face}`);
    
    this.activeProject.elevations[face].status = COMPONENT_STATUS.FINAL;
    this.activeProject.elevations[face].artifact = artifact;
    this.activeProject.updatedAt = new Date().toISOString();

    // Advance step
    if (face === 'front') this.activeProject.currentStep = 'STEP_04_TAMPAK_KIRI';
    else if (face === 'left') this.activeProject.currentStep = 'STEP_05_TAMPAK_KANAN';
    else if (face === 'right') this.activeProject.currentStep = 'STEP_06_TAMPAK_BELAKANG';
    else if (face === 'rear') this.activeProject.currentStep = 'STEP_07_MODEL_3D';

    this.saveState();
    return this.activeProject;
  }

  complete3DModel(artifact) {
    if (!this.activeProject) throw new Error('No active project');
    this.activeProject.visualization.exterior3D.status = COMPONENT_STATUS.FINAL;
    this.activeProject.visualization.exterior3D.artifact = artifact;
    this.activeProject.currentStep = 'STEP_08_HOLOGRAM_3D';
    this.activeProject.updatedAt = new Date().toISOString();
    this.saveState();
    return this.activeProject;
  }

  completeHologram(artifact) {
    if (!this.activeProject) throw new Error('No active project');
    this.activeProject.visualization.hologram3D.status = COMPONENT_STATUS.FINAL;
    this.activeProject.visualization.hologram3D.artifact = artifact;
    this.activeProject.status = COMPONENT_STATUS.FINAL;
    this.activeProject.currentStep = 'PROJECT_COMPLETED';
    this.activeProject.updatedAt = new Date().toISOString();
    this.saveState();
    return this.activeProject;
  }
}

export const masterDesignStateInstance = new MasterDesignState();
export default masterDesignStateInstance;
