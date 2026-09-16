/**
 * server/studio/core/StudioSessionManager.mjs
 * Central Active Studio Session Manager for JIN.
 * Maintains project state, canonical plans, execution lifecycle, and project isolation.
 */

import fs from 'fs';
import path from 'path';
import { StudioContext, STUDIO_STATUSES, STUDIO_PHASES, ITEM_LIFECYCLE_STATUS } from './StudioContext.mjs';

export class StudioSessionManager {
  constructor() {
    this.sessions = new Map(); // studioType -> StudioContext
    this.activeStudio = null;
    this.persistPath = 'd:/Users/ultimateai/artifacts/studio_session.json';
    this._loadPersisted();
  }

  _loadPersisted() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const raw = fs.readFileSync(this.persistPath, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.activeStudio && data.sessions) {
          this.activeStudio = data.activeStudio;
          for (const [sType, sData] of Object.entries(data.sessions)) {
            this.sessions.set(sType, new StudioContext(sData));
          }
        } else if (data && data.activeStudio && data.session) {
          this.activeStudio = data.activeStudio;
          this.sessions.set(data.activeStudio, new StudioContext(data.session));
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  _savePersisted() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serializedSessions = {};
      for (const [sType, sCtx] of this.sessions.entries()) {
        serializedSessions[sType] = sCtx.toJSON();
      }
      fs.writeFileSync(this.persistPath, JSON.stringify({
        activeStudio: this.activeStudio,
        sessions: serializedSessions
      }, null, 2), 'utf8');
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Initializes or updates an active SLIDE_STUDIO presentation project session.
   */
  createOrUpdateSlideSession({
    projectId,
    deckId,
    projectTitle,
    totalSlides = 20,
    currentSlide = 1,
    masterDraft = null,
    slidePlan = [],
    phase = STUDIO_PHASES.DRAFT,
    status = STUDIO_STATUSES.ACTIVE
  }) {
    const session = new StudioContext({
      studioType: 'SLIDE_STUDIO',
      project: {
        projectId: projectId || deckId || `DECK-${Date.now().toString().slice(-4)}`,
        title: projectTitle,
        status: status || STUDIO_STATUSES.ACTIVE
      },
      execution: {
        phase: phase || STUDIO_PHASES.DRAFT,
        currentIndex: Math.max(0, currentSlide - 1),
        currentStep: `SLIDE_${String(currentSlide).padStart(2, '0')}`
      },
      totalSlides: totalSlides || slidePlan?.length || 0,
      slidePlan: slidePlan || [],
      masterDraft
    });

    this.sessions.set('SLIDE_STUDIO', session);
    this.activeStudio = 'SLIDE_STUDIO';
    this._savePersisted();
    return session;
  }

  /**
   * Initializes or updates an active ARCHITECTURAL_STUDIO project session.
   */
  createOrUpdateArchSession({
    projectId,
    projectTitle,
    totalSteps = 8,
    currentStep = 1,
    masterDraft = null,
    projectState = null,
    status = STUDIO_STATUSES.ACTIVE,
    phase = STUDIO_PHASES.PRODUCTION
  }) {
    const stepCodes = [
      'STEP_01_DENAH', 'STEP_02_STRUKTUR', 'STEP_03_TAMPAK_DEPAN', 'STEP_04_TAMPAK_KIRI',
      'STEP_05_TAMPAK_KANAN', 'STEP_06_TAMPAK_BELAKANG', 'STEP_07_MODEL_3D', 'STEP_08_HOLOGRAM_3D'
    ];

    const session = new StudioContext({
      studioType: 'ARCHITECTURAL_STUDIO',
      project: {
        projectId: projectId || `ARCH-${Date.now().toString().slice(-4)}`,
        title: projectTitle,
        status: status || STUDIO_STATUSES.ACTIVE
      },
      execution: {
        phase: phase || STUDIO_PHASES.PRODUCTION,
        currentIndex: Math.max(0, currentStep - 1),
        currentStep: stepCodes[currentStep - 1] || 'STEP_01_DENAH'
      },
      archSteps: stepCodes.map((code, idx) => ({
        stepNumber: idx + 1,
        code,
        status: idx === 0 ? ITEM_LIFECYCLE_STATUS.READY : ITEM_LIFECYCLE_STATUS.PENDING
      })),
      masterDraft,
      metadata: { projectState }
    });

    this.sessions.set('ARCHITECTURAL_STUDIO', session);
    this.activeStudio = 'ARCHITECTURAL_STUDIO';
    this._savePersisted();
    return session;
  }

  /**
   * Initializes or updates an active DATA_LAB project session.
   */
  createOrUpdateDataSession({
    projectId,
    projectTitle,
    dataset = null,
    profile = null,
    status = STUDIO_STATUSES.ACTIVE,
    phase = STUDIO_PHASES.DRAFT
  }) {
    const session = new StudioContext({
      studioType: 'DATA_LAB',
      project: {
        projectId: projectId || `DATA-${Date.now().toString().slice(-4)}`,
        title: projectTitle || 'Analisis Dataset',
        status: status || STUDIO_STATUSES.ACTIVE
      },
      execution: {
        phase: phase || STUDIO_PHASES.DRAFT,
        currentIndex: 0,
        currentStep: 'DATASET_PROFILE'
      },
      dataState: {
        dataset,
        profile,
        activeChart: null,
        charts: [],
        history: []
      }
    });

    this.sessions.set('DATA_LAB', session);
    this.activeStudio = 'DATA_LAB';
    this._savePersisted();
    return session;
  }

  /**
   * Returns the current active session if it is not COMPLETE.
   * Enforces R18: Completed studios do NOT act as active session without reopening.
   */
  getActiveSession(studioFilter = null) {
    if (this.sessions.size === 0 || !this.activeStudio) {
      this._loadPersisted();
    }

    if (studioFilter) {
      const s = this.sessions.get(studioFilter);
      if (s && s.project?.status !== STUDIO_STATUSES.COMPLETE) {
        return s;
      }
      return null;
    }

    if (this.activeStudio && this.sessions.has(this.activeStudio)) {
      const s = this.sessions.get(this.activeStudio);
      if (s && s.project.status !== STUDIO_STATUSES.COMPLETE) {
        return s;
      }
    }

    // Find any non-completed active session
    for (const s of this.sessions.values()) {
      if (s.project.status !== STUDIO_STATUSES.COMPLETE) {
        return s;
      }
    }

    return null;
  }

  hasActiveSession(studio = null) {
    return Boolean(this.getActiveSession(studio));
  }

  completeSession(studio = null) {
    const targetType = studio || this.activeStudio;
    const s = targetType ? this.sessions.get(targetType) : null;
    if (s) {
      s.markComplete();
      if (this.activeStudio === targetType) {
        this.activeStudio = null;
      }
      this._savePersisted();
    }
    return s;
  }

  updateSession(studio, updates = {}) {
    const s = this.sessions.get(studio);
    if (!s) return null;
    Object.assign(s, updates, { updatedAt: new Date().toISOString() });
    this._savePersisted();
    return s;
  }

  clearSession(studio = null) {
    if (studio) {
      this.sessions.delete(studio);
      if (this.activeStudio === studio) {
        this.activeStudio = null;
      }
    } else {
      this.sessions.clear();
      this.activeStudio = null;
    }
    this._savePersisted();
  }
}

export const studioSessionManagerInstance = new StudioSessionManager();
export default studioSessionManagerInstance;
