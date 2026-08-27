/**
 * ArtifactManager.mjs
 * Enterprise Artifact Persistence, Versioning, Manifests, and Integrity Verification.
 * Strictly guarantees persistence truthfulness with explicit persistenceStatus.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ArtifactManager {
  constructor(artifactsBaseDir = 'd:/Users/ultimateai/artifacts') {
    this.artifactsBaseDir = artifactsBaseDir;
    this.inMemoryArtifacts = new Map();
    this.ensureBaseDirectory();
  }

  ensureBaseDirectory() {
    try {
      if (!fs.existsSync(this.artifactsBaseDir)) {
        fs.mkdirSync(this.artifactsBaseDir, { recursive: true });
      }
    } catch (err) {
      console.error('[ArtifactManager] Failed to create base artifacts directory:', err);
    }
  }

  /**
   * Generates SHA-256 hash of content
   */
  computeHash(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Registers and stores a deliverable artifact with version control & explicit persistence validation
   * @param {Object} params - { id, name, type, content, metadata, goalId }
   * @returns {Object} artifact - includes persistenceStatus: 'PERSISTED' | 'PERSISTENCE_FAILED'
   */
  createArtifact({ id, name, type, content, metadata = {}, goalId = null }) {
    const artifactId = id || `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const safeName = (name || artifactId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const artifactFolder = path.join(this.artifactsBaseDir, safeName);

    let persistenceStatus = 'PERSISTED';
    let persistenceError = null;

    try {
      if (!fs.existsSync(artifactFolder)) {
        fs.mkdirSync(artifactFolder, { recursive: true });
      }
    } catch (err) {
      persistenceStatus = 'PERSISTENCE_FAILED';
      persistenceError = err.message;
      console.error(`[ArtifactManager] Error creating folder for artifact ${safeName}:`, err);
    }

    // Determine Version Number
    const existing = this.inMemoryArtifacts.get(artifactId);
    const version = existing ? existing.version + 1 : 1;
    const timestamp = new Date().toISOString();
    const hash = this.computeHash(content);

    const artifact = {
      id: artifactId,
      name: safeName,
      type: type || 'GENERIC', // 'CODE' | 'DASHBOARD' | 'DATA_MODEL' | 'VALIDATION_REPORT'
      content,
      metadata,
      goalId,
      timestamp,
      version,
      hash,
      renderable: Boolean(content && (typeof content === 'object' || content.length > 0)),
      persistenceStatus,
      persistenceError
    };

    // Persist real artifact files to disk
    if (persistenceStatus === 'PERSISTED') {
      try {
        // 1. Versioned content file
        const contentFileName = type === 'CODE' ? `App_v${version}.jsx` : `content_v${version}.json`;
        const contentPath = path.join(artifactFolder, contentFileName);
        const contentData = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        fs.writeFileSync(contentPath, contentData, 'utf8');

        // 2. Manifest file
        const manifestPath = path.join(artifactFolder, 'manifest.json');
        const manifestData = {
          artifactId,
          name: safeName,
          currentVersion: version,
          latestHash: hash,
          lastUpdated: timestamp,
          type: artifact.type,
          persistenceStatus: 'PERSISTED',
          history: [
            ...(existing?.manifest?.history || []),
            { version, hash, timestamp, file: contentFileName }
          ]
        };
        fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
        artifact.manifest = manifestData;
        artifact.contentFile = contentPath;
      } catch (err) {
        artifact.persistenceStatus = 'PERSISTENCE_FAILED';
        artifact.persistenceError = err.message;
        console.error(`[ArtifactManager] Failed to persist artifact ${safeName} to disk:`, err);
      }
    }

    this.inMemoryArtifacts.set(artifactId, artifact);
    return artifact;
  }

  /**
   * Retrieves an artifact by ID
   */
  getArtifact(id) {
    return this.inMemoryArtifacts.get(id) || null;
  }

  /**
   * Lists all current artifacts with metadata
   */
  listArtifacts() {
    return Array.from(this.inMemoryArtifacts.values());
  }

  /**
   * Validates whether an artifact satisfies criteria and was persisted
   * @param {string} id - Artifact ID
   * @param {Object} criteria - { minLength, requiredKeys, expectedType, requirePersisted }
   */
  validateArtifact(id, criteria = {}) {
    const artifact = this.getArtifact(id);
    if (!artifact) return { valid: false, reason: 'ARTIFACT_NOT_FOUND' };

    if (criteria.requirePersisted !== false && artifact.persistenceStatus !== 'PERSISTED') {
      return { valid: false, reason: `PERSISTENCE_FAILED_${artifact.persistenceError || 'DISK_WRITE_ERROR'}` };
    }

    if (criteria.expectedType && artifact.type !== criteria.expectedType) {
      return { valid: false, reason: `TYPE_MISMATCH_EXPECTED_${criteria.expectedType}` };
    }

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
