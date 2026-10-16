/**
 * server/studio/core/StudioContext.mjs
 * Canonical Single Source of Truth for Studio Sessions:
 * 1. sessionId & studioType
 * 2. project: { projectId, title, createdAt, status }
 * 3. execution: { phase, currentIndex, currentStep }
 * 4. canonical plans & items (slidePlan, archSteps, dataPipeline)
 * 5. artifacts & stateVersion
 */


export const STUDIO_STATUSES = {
  NONE: 'NONE',
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETE: 'COMPLETE',
  PAUSED: 'PAUSED'
};

export const STUDIO_PHASES = {
  DRAFT: 'DRAFT',
  PRODUCTION: 'PRODUCTION',
  REVISION: 'REVISION',
  COMPLETE: 'COMPLETE'
};

export const ITEM_LIFECYCLE_STATUS = {
  PENDING: 'PENDING',
  GENERATING: 'GENERATING',
  QA: 'QA',
  READY: 'READY',
  LOCKED: 'LOCKED', // Canonical current version
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  UPDATE_REQUIRED: 'UPDATE_REQUIRED'
};

export class StudioContext {
  constructor({
    sessionId = '',
    studioType = 'ARCHITECTURAL_STUDIO',
    project = {},
    execution = {},
    artifacts = {},
    stateVersion = 1,
    // Studio-specific canonical plans
    archSteps = [],
    dataState = null,
    // Backwards-compatibility options
    projectId = '',
    projectTitle = '',
    status = 'ACTIVE',
    phase = 'DRAFT',
    masterDraft = null,
    metadata = {}
  } = {}) {
    const pId = project.projectId || project.id || projectId || `PROJ-${Date.now().toString().slice(-4)}`;
    const pTitle = project.title || projectTitle || '';
    const pStatus = project.status || status || STUDIO_STATUSES.ACTIVE;
    const now = new Date().toISOString();

    this.sessionId = sessionId || `SESSION-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.studioType = studioType || (project.studioType || 'ARCHITECTURAL_STUDIO');

    this.project = {
      id: pId,
      title: pTitle,
      projectId: pId,
      status: pStatus,
      createdAt: project.createdAt || now
    };

    const exPhase = execution.phase || phase || STUDIO_PHASES.DRAFT;
    const exIdx = execution.currentIndex ?? 0;
    const exStep = execution.currentStep || `STEP_${String(exIdx + 1).padStart(2, '0')}`;

    this.execution = {
      phase: exPhase,
      currentIndex: exIdx,
      currentStep: exStep
    };

    // Architectural state
    this.archSteps = archSteps || [];

    // Data Lab state
    this.dataState = dataState || {
      dataset: null,
      profile: null,
      activeChart: null,
      charts: [],
      history: []
    };

    this.artifacts = artifacts || {};
    this.masterDraft = masterDraft || null;
    this.metadata = metadata || {};
    this.stateVersion = stateVersion || 1;
    this.createdAt = now;
    this.updatedAt = now;

    // Backward-compatibility structure for studio and slides
    this.studio = {
      type: this.studioType,
      phase: this.execution.phase,
      status: this.project.status
    };
  } // end constructor

  // Complete project
  markComplete() {
    this.project.status = STUDIO_STATUSES.COMPLETE;
    this.studio.status = STUDIO_STATUSES.COMPLETE;
    this.execution.phase = STUDIO_PHASES.COMPLETE;
    this.updatedAt = new Date().toISOString();
  }

  // Backward-compatibility accessors
  get projectId() { return this.project.projectId; }
  set projectId(val) { this.project.projectId = val; this.project.id = val; }

  get projectTitle() { return this.project.title; }
  set projectTitle(val) { this.project.title = val; }

  get status() { return this.project.status; }
  set status(val) {
    this.project.status = val;
    this.studio.status = val;
  }

  get phase() { return this.execution.phase; }
  set phase(val) {
    this.execution.phase = val;
    this.studio.phase = val;
  }




  toJSON() {
    this.studio.phase = this.execution.phase;
    this.studio.status = this.project.status;

    return {
      sessionId: this.sessionId,
      studioType: this.studioType,
      project: {
        id: this.project.id,
        projectId: this.project.projectId || this.project.id,
        title: this.project.title,
        status: this.project.status || 'ACTIVE',
        createdAt: this.project.createdAt || this.createdAt
      },
      execution: this.execution,
      archSteps: this.archSteps,
      dataState: this.dataState,
      artifacts: this.artifacts,
      masterDraft: this.masterDraft,
      metadata: this.metadata,
      stateVersion: this.stateVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Backward-compatible projections
      studio: this.studio
    };
  }
}

export default StudioContext;
