/**
 * ArtifactStream.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Universal Artifact Stream
 *
 * All domain services append artifacts here. Artifacts flow to the
 * ConversationCanvas for display. Single stream per work session.
 *
 * Artifact types:
 *   TEXT, SVG_VECTOR, IMAGE, THREEJS_SCENE, MARKDOWN, LINK, TABLE, JSON
 * ═══════════════════════════════════════════════════════════════════════
 */

let artifactCounter = 0;

class ArtifactStream {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.artifacts = [];
    this.listeners = new Set();
  }

  /**
   * Append a new artifact to the stream
   */
  append(artifact) {
    const record = {
      id: artifact.id || `ART-${Date.now()}-${++artifactCounter}`,
      taskId: artifact.taskId || null,
      type: artifact.type || 'TEXT',
      content: artifact.content || '',
      metadata: artifact.metadata || {},
      domain: artifact.domain || 'UNKNOWN',
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    this.artifacts.push(record);
    this._notify('append', record);
    return record;
  }

  /**
   * Update an existing artifact by ID
   */
  update(artifactId, updates) {
    const idx = this.artifacts.findIndex(a => a.id === artifactId);
    if (idx === -1) return null;

    this.artifacts[idx] = {
      ...this.artifacts[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this._notify('update', this.artifacts[idx]);
    return this.artifacts[idx];
  }

  /**
   * Update artifact by task ID
   */
  updateByTaskId(taskId, updates) {
    const artifact = this.artifacts.find(a => a.taskId === taskId);
    if (!artifact) return null;
    return this.update(artifact.id, updates);
  }

  /**
   * Get artifact by ID
   */
  getById(artifactId) {
    return this.artifacts.find(a => a.id === artifactId) || null;
  }

  /**
   * Get artifact by task ID
   */
  getByTaskId(taskId) {
    return this.artifacts.find(a => a.taskId === taskId) || null;
  }

  /**
   * Get all artifacts
   */
  getAll() {
    return [...this.artifacts];
  }

  /**
   * Get latest artifact
   */
  getLatest() {
    return this.artifacts.length > 0 ? this.artifacts[this.artifacts.length - 1] : null;
  }

  /**
   * Get artifacts by type
   */
  getByType(type) {
    return this.artifacts.filter(a => a.type === type);
  }

  /**
   * Get artifacts by domain
   */
  getByDomain(domain) {
    return this.artifacts.filter(a => a.domain === domain);
  }

  /**
   * Get count
   */
  get count() {
    return this.artifacts.length;
  }

  /**
   * Clear all artifacts
   */
  clear() {
    this.artifacts = [];
    this._notify('clear', null);
  }

  /**
   * Subscribe to stream events
   */
  on(event, callback) {
    this.listeners.add({ event, callback });
    return () => this.listeners.delete({ event, callback });
  }

  /**
   * Notify listeners
   */
  _notify(event, data) {
    for (const listener of this.listeners) {
      if (listener.event === event || listener.event === '*') {
        try {
          listener.callback(event, data);
        } catch (err) {
          console.error('[ArtifactStream] Listener error:', err.message);
        }
      }
    }
  }

  /**
   * Get snapshot for persistence
   */
  getSnapshot() {
    return {
      sessionId: this.sessionId,
      artifacts: this.artifacts.map(a => ({ ...a })),
    };
  }

  /**
   * Restore from snapshot
   */
  static fromSnapshot(snapshot) {
    const stream = new ArtifactStream(snapshot.sessionId);
    stream.artifacts = (snapshot.artifacts || []).map(a => ({ ...a }));
    return stream;
  }
}

export { ArtifactStream };
export default ArtifactStream;
