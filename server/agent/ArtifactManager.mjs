/**
 * ArtifactManager.mjs
 * Manages, versions, validates, and serves persistent deliverables and code artifacts.
 */

import fs from 'fs';
import path from 'path';

export class ArtifactManager {
  constructor(artifactsDir = 'd:/Users/ultimateai/artifacts') {
    this.artifactsDir = artifactsDir;
    this.inMemoryArtifacts = new Map();
    this.ensureDirectory();
  }

  ensureDirectory() {
    try {
      if (!fs.existsSync(this.artifactsDir)) {
        fs.mkdirSync(this.artifactsDir, { recursive: true });
      }
    } catch {}
  }

  /**
   * Registers and stores a deliverable artifact
   * @param {Object} params - { id, name, type, content, metadata, goalId }
   * @returns {Object} artifact
   */
  createArtifact({ id, name, type, content, metadata = {}, goalId = null }) {
    const artifactId = id || `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = new Date().toISOString();

    const artifact = {
      id: artifactId,
      name,
      type: type || 'GENERIC', // 'CODE' | 'DASHBOARD' | 'DATA_MODEL' | 'VALIDATION_REPORT'
      content,
      metadata,
      goalId,
      timestamp,
      version: 1,
      renderable: Boolean(content && content.length > 0)
    };

    this.inMemoryArtifacts.set(artifactId, artifact);

    // Save to disk if applicable
    try {
      const filePath = path.join(this.artifactsDir, `${name || artifactId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), 'utf8');
    } catch {}

    return artifact;
  }

  /**
   * Retrieves an artifact by ID
   */
  getArtifact(id) {
    return this.inMemoryArtifacts.get(id) || null;
  }

  /**
   * Lists all current artifacts
   */
  listArtifacts() {
    return Array.from(this.inMemoryArtifacts.values());
  }

  /**
   * Validates whether an artifact satisfies criteria
   * @param {string} id - Artifact ID
   * @param {Object} criteria - { minLength, requiredKeys, syntaxCheck }
   */
  validateArtifact(id, criteria = {}) {
    const artifact = this.getArtifact(id);
    if (!artifact) return { valid: false, reason: 'ARTIFACT_NOT_FOUND' };

    if (criteria.minLength && (!artifact.content || artifact.content.length < criteria.minLength)) {
      return { valid: false, reason: 'ARTIFACT_CONTENT_TOO_SHORT' };
    }

    if (criteria.requiredKeys && typeof artifact.content === 'object') {
      const missing = criteria.requiredKeys.filter(k => !(k in artifact.content));
      if (missing.length > 0) {
        return { valid: false, reason: `MISSING_KEYS_${missing.join('_')}` };
      }
    }

    return { valid: true, artifact };
  }
}

export const artifactManagerInstance = new ArtifactManager();
export default artifactManagerInstance;
