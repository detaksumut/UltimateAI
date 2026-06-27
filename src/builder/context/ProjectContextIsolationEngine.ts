// src/builder/context/ProjectContextIsolationEngine.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';

export interface ProjectSession {
  projectId: string;
  projectContextId: string;
  memory: Record<string, any>;
  prototypeHistory: any[];
  adjustmentHistory: any[];
  approvalHistory: any[];
}

export class ProjectContextIsolationEngine {
  private static activeSessions: Map<string, ProjectSession> = new Map();

  /**
   * Clears any inherited static/global semantic context from previous runs.
   */
  public clearSemanticContext(): void {
    // Scrub internal cache Map
    ProjectContextIsolationEngine.activeSessions.clear();
    
    // Clear global scope properties if any leaks are found
    if (typeof global !== 'undefined') {
      const g = global as any;
      delete g.__lastProjectModel;
      delete g.__lastProjectDomain;
      delete g.__lastProjectScreens;
    }
  }

  /**
   * Initializes a strictly isolated Project Session boundary.
   */
  public createSession(prompt: string): ProjectSession {
    // Always clear semantic history first to enforce a fresh sandbox environment
    this.clearSemanticContext();

    const projectId = 'proj-' + Math.random().toString(36).substr(2, 9);
    const projectContextId = 'ctx-' + Math.random().toString(36).substr(2, 9);

    const session: ProjectSession = {
      projectId,
      projectContextId,
      memory: {},
      prototypeHistory: [],
      adjustmentHistory: [],
      approvalHistory: []
    };

    ProjectContextIsolationEngine.activeSessions.set(projectId, session);
    return session;
  }

  /**
   * Freezes the core semantic elements to prevent any downstream context corruption.
   */
  public lockContext(model: ProjectIntelligenceModel): ProjectIntelligenceModel {
    if (!model) return model;

    const locked = { ...model };
    locked.contextLocked = true;
    
    // Freeze the elements
    Object.freeze(locked.intent);
    Object.freeze(locked.domain);
    if (locked.entities) locked.entities.forEach(ent => Object.freeze(ent));
    if (locked.workflows) locked.workflows.forEach(wf => Object.freeze(wf));
    if (locked.businessRules) Object.freeze(locked.businessRules);
    
    return locked;
  }
}
