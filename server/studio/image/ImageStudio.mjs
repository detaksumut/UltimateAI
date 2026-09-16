/**
 * ImageStudio.mjs
 * IMAGE_STUDIO — artifact consumer layer for JIN image generation.
 *
 * Position in the 9Router pipeline:
 *   NineRouterGatewayAdapter -> image artifact -> IMAGE_STUDIO (this module)
 *   ImageStudio receives an artifact REFERENCE and registers it in a project.
 *
 * Slides reuse the same artifacts through SLIDE_STUDIO (SlideStudio) as before.
 * This module does NOT create a second artifact system: it only registers
 * references created by ImageGeneration._persistArtifact.
 *
 * Storage:
 *   - In-memory project registry (lifespan of the process).
 *   - Optional manifest JSON persisted next to the image artifact for audit.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PERSIST_ROOT = path.resolve('d:/Users/ultimateai/storage/artifacts/images');

export class ImageStudio {
  constructor() {
    this._projects = new Map();
  }

  createProject({ title = 'untitled', requestId = null, artifactId = null, url = null } = {}) {
    const projectId = `imagestudio-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const project = {
      projectId,
      title: String(title || 'untitled'),
      requestId: requestId || null,
      createdAt: new Date().toISOString(),
      artifacts: []
    };
    if (artifactId && url) {
      project.artifacts.push({
        artifactId,
        url,
        registeredAt: new Date().toISOString()
      });
    }
    this._projects.set(projectId, project);
    return { success: true, project };
  }

  /**
   * IMAGE_STUDIO consumes an artifact reference.
   * @param {object} params
   *   artifact - the ImageGeneration artifact { id, url, localPath, type, metadata, ... }
   * @returns {{ success:true, projectId, artifactId, reference } | { success:false, reason }}
   */
  registerArtifact({ artifact, requestId = null, prompt = '', model = null, provider = '9ROUTER' } = {}) {
    if (!artifact || !artifact.id || !artifact.url) {
      return { success: false, reason: 'IMAGE_STUDIO_REQUIRES_ARTIFACT_REFERENCE' };
    }

    const existing = [...this._projects.values()].find((p) =>
      p.artifacts.some((a) => a.artifactId === artifact.id)
    );
    if (existing) {
      return {
        success: true,
        projectId: existing.projectId,
        artifactId: artifact.id,
        reference: { artifactId: artifact.id, url: artifact.url, localPath: artifact.localPath || null, projectId: existing.projectId }
      };
    }

    const project = this.createProject({
      title: artifact.metadata?.originalPrompt || artifact.originalPrompt || prompt || 'untitled',  
      requestId: requestId || artifact.requestId || null,
      artifactId: artifact.id,
      url: artifact.url
    });

    const reference = {
      artifactId: artifact.id,
      url: artifact.url,
      localPath: artifact.localPath || null,
      projectId: project.project.projectId
    };

    this._persistManifest({
      syncKey: `imagestudio:${artifact.id}:${Date.now()}`,
      projectId: project.project.projectId,
      artifactId: artifact.id,
      url: artifact.url,
      localPath: artifact.localPath || null,
      requestId: requestId || artifact.requestId || null,
      prompt: prompt || artifact.prompt || '',
      model: model || artifact.model || null,
      provider: provider || '9ROUTER',
      createdAt: new Date().toISOString()
    });

    console.log(`[IMAGE_STUDIO] Artifact ${artifact.id} registered (project ${project.project.projectId})`);
    return { success: true, ...reference, reference };
  }

  listProjects() {
    return [...this._projects.values()].map((p) => ({
      projectId: p.projectId,
      title: p.title,
      artifactCount: p.artifacts.length,
      createdAt: p.createdAt
    }));
  }

  _persistManifest(record) {
    try {
      if (!fs.existsSync(PERSIST_ROOT)) fs.mkdirSync(PERSIST_ROOT, { recursive: true });
      const filename = `${record.artifactId}.studio.json`;
      fs.writeFileSync(path.join(PERSIST_ROOT, filename), JSON.stringify(record, null, 2));
    } catch {
      // manifest is best-effort only
    }
  }
}

export const imageStudioInstance = new ImageStudio();
export default imageStudioInstance;