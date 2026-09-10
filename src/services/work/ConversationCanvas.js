/**
 * ConversationCanvas.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Universal Output Surface
 *
 * All domain artifacts flow through this canvas. One canvas per conversation.
 * Supports progressive streaming with flying animation states.
 *
 * Artifact States:
 *   FLYING    → Being streamed/rendered (animation in progress)
 *   LANDED    → Fully rendered and visible
 *   PINNED    → User has interacted (expanded, copied, etc.)
 *
 * Structure:
 *   Conversation
 *     └── ConversationCanvas
 *          ├── Artifact 01 (LANDED)
 *          ├── Artifact 02 (FLYING → LANDED)
 *          ├── Artifact 03 (FLYING)
 *          └── ...
 * ═══════════════════════════════════════════════════════════════════════
 */

let canvasCounter = 0;

const ARTIFACT_STATE = {
  FLYING: 'FLYING',
  LANDED: 'LANDED',
  PINNED: 'PINNED',
};

class ConversationCanvas {
  constructor(conversationId, options = {}) {
    this.conversationId = conversationId;
    this.id = `CANVAS-${Date.now()}-${++canvasCounter}`;
    this.artifacts = [];
    this.listeners = new Set();

    // Streaming configuration
    this.streamingDelay = options.streamingDelay || 100; // ms between artifacts
    this.charStreamingSpeed = options.charStreamingSpeed || 5; // ms per character
    this.isStreaming = false;
    this.streamQueue = [];
    this.currentStreamId = null;
  }

  /**
   * Append artifact immediately (no animation)
   */
  appendArtifact(artifact) {
    const canvasArtifact = {
      canvasId: this.id,
      streamArtifactId: artifact.id,
      taskId: artifact.taskId,
      type: artifact.type,
      content: artifact.content,
      metadata: artifact.metadata,
      domain: artifact.domain,
      state: ARTIFACT_STATE.LANDED,
      order: this.artifacts.length + 1,
      timestamp: artifact.timestamp || new Date().toISOString(),
    };

    this.artifacts.push(canvasArtifact);
    this._notify('artifact_appended', canvasArtifact);
    this._notify('artifact_landed', canvasArtifact);
    return canvasArtifact;
  }

  /**
   * Stream artifact with flying animation
   * Returns a promise that resolves when animation completes
   */
  async streamArtifact(artifact, options = {}) {
    const streamId = `STREAM-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const canvasArtifact = {
      canvasId: this.id,
      streamArtifactId: artifact.id,
      taskId: artifact.taskId,
      type: artifact.type,
      content: artifact.content,
      metadata: artifact.metadata,
      domain: artifact.domain,
      state: ARTIFACT_STATE.FLYING,
      order: this.artifacts.length + 1,
      timestamp: artifact.timestamp || new Date().toISOString(),
      streamId,
    };

    this.artifacts.push(canvasArtifact);
    this._notify('artifact_flying', canvasArtifact);

    // Start streaming animation
    return this._animateArtifact(canvasArtifact, streamId, options);
  }

  /**
   * Animate artifact streaming
   */
  async _animateArtifact(canvasArtifact, streamId, options = {}) {
    this.isStreaming = true;
    this.currentStreamId = streamId;

    const content = canvasArtifact.content || '';
    const delay = options.delay || this.streamingDelay;
    const charSpeed = options.charSpeed || this.charStreamingSpeed;
    const animateType = options.animateType || this._getAnimateType(canvasArtifact.type);

    try {
      switch (animateType) {
        case 'charByChar':
          await this._streamCharByChar(canvasArtifact, content, charSpeed);
          break;
        case 'lineByLine':
          await this._streamLineByLine(canvasArtifact, content, delay);
          break;
        case 'block':
          await this._streamBlock(canvasArtifact, content, delay);
          break;
        case 'instant':
        default:
          // No animation, just land immediately
          break;
      }

      // Mark as landed
      canvasArtifact.state = ARTIFACT_STATE.LANDED;
      this._notify('artifact_landed', canvasArtifact);

    } catch (error) {
      console.error('[ConversationCanvas] Stream error:', error.message);
      // Still mark as landed on error
      canvasArtifact.state = ARTIFACT_STATE.LANDED;
      this._notify('artifact_landed', canvasArtifact);
    } finally {
      this.isStreaming = false;
      this.currentStreamId = null;
    }

    return canvasArtifact;
  }

  /**
   * Stream content character by character
   */
  async _streamCharByChar(artifact, content, charSpeed) {
    const chars = content.split('');
    let accumulated = '';

    for (let i = 0; i < chars.length; i++) {
      accumulated += chars[i];
      this._notify('artifact_streaming', {
        ...artifact,
        partialContent: accumulated,
        progress: (i + 1) / chars.length,
      });

      // Delay between characters (skip for spaces/newlines for speed)
      if (chars[i] !== ' ' && chars[i] !== '\n') {
        await this._delay(charSpeed);
      }
    }
  }

  /**
   * Stream content line by line
   */
  async _streamLineByLine(artifact, content, delay) {
    const lines = content.split('\n');
    let accumulated = '';

    for (let i = 0; i < lines.length; i++) {
      accumulated += (i > 0 ? '\n' : '') + lines[i];
      this._notify('artifact_streaming', {
        ...artifact,
        partialContent: accumulated,
        progress: (i + 1) / lines.length,
      });

      await this._delay(delay);
    }
  }

  /**
   * Stream content in blocks (by section/heading)
   */
  async _streamBlock(artifact, content, delay) {
    // Split by markdown headings or double newlines
    const blocks = content.split(/\n(?=#{1,3} )|\n\n/);
    let accumulated = '';

    for (let i = 0; i < blocks.length; i++) {
      accumulated += (i > 0 ? '\n\n' : '') + blocks[i];
      this._notify('artifact_streaming', {
        ...artifact,
        partialContent: accumulated,
        progress: (i + 1) / blocks.length,
      });

      await this._delay(delay);
    }
  }

  /**
   * Get animation type based on artifact type
   */
  _getAnimateType(type) {
    switch (type) {
      case 'TEXT':
      case 'MARKDOWN':
        return 'lineByLine';
      case 'JSON':
        return 'block';
      case 'SVG_VECTOR':
      case 'IMAGE':
        return 'block';
      case 'CODE':
        return 'lineByLine';
      case 'AUDIO_META':
        return 'instant';
      default:
        return 'lineByLine';
    }
  }

  /**
   * Pause streaming (for user interaction)
   */
  pauseStream() {
    if (this.currentStreamId) {
      this._notify('stream_paused', { streamId: this.currentStreamId });
    }
  }

  /**
   * Resume streaming
   */
  resumeStream() {
    if (this.currentStreamId) {
      this._notify('stream_resumed', { streamId: this.currentStreamId });
    }
  }

  /**
   * Skip current stream animation (show full content immediately)
   */
  skipStream() {
    if (this.currentStreamId) {
      this._notify('stream_skipped', { streamId: this.currentStreamId });
    }
  }

  /**
   * Mark artifact as pinned (user interacted)
   */
  pinArtifact(streamArtifactId) {
    const artifact = this.artifacts.find(a => a.streamArtifactId === streamArtifactId);
    if (artifact) {
      artifact.state = ARTIFACT_STATE.PINNED;
      this._notify('artifact_pinned', artifact);
    }
    return artifact;
  }

  /**
   * Update artifact content
   */
  updateArtifact(streamArtifactId, content) {
    const idx = this.artifacts.findIndex(a => a.streamArtifactId === streamArtifactId);
    if (idx === -1) return null;

    this.artifacts[idx].content = content;
    this.artifacts[idx].updatedAt = new Date().toISOString();
    this._notify('artifact_updated', this.artifacts[idx]);
    return this.artifacts[idx];
  }

  /**
   * Get artifact by order
   */
  getByOrder(order) {
    return this.artifacts.find(a => a.order === order) || null;
  }

  /**
   * Get artifact by type
   */
  getByType(type) {
    return this.artifacts.filter(a => a.type === type);
  }

  /**
   * Get artifacts by state
   */
  getByState(state) {
    return this.artifacts.filter(a => a.state === state);
  }

  /**
   * Get flying artifacts (currently streaming)
   */
  getFlying() {
    return this.getByState(ARTIFACT_STATE.FLYING);
  }

  /**
   * Get landed artifacts (fully rendered)
   */
  getLanded() {
    return this.getByState(ARTIFACT_STATE.LANDED);
  }

  /**
   * Get all artifacts
   */
  getAll() {
    return [...this.artifacts];
  }

  /**
   * Get count
   */
  get count() {
    return this.artifacts.length;
  }

  /**
   * Clear canvas
   */
  clear() {
    this.artifacts = [];
    this.isStreaming = false;
    this.currentStreamId = null;
    this._notify('cleared', null);
  }

  /**
   * Subscribe to canvas events
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
          console.error('[ConversationCanvas] Listener error:', err.message);
        }
      }
    }
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get snapshot for persistence
   */
  getSnapshot() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      artifacts: this.artifacts.map(a => ({ ...a })),
      isStreaming: this.isStreaming,
    };
  }

  /**
   * Restore from snapshot
   */
  static fromSnapshot(snapshot) {
    const canvas = new ConversationCanvas(snapshot.conversationId);
    canvas.id = snapshot.id;
    canvas.artifacts = (snapshot.artifacts || []).map(a => ({ ...a }));
    canvas.isStreaming = false;
    canvas.currentStreamId = null;
    return canvas;
  }
}

export { ConversationCanvas, ARTIFACT_STATE };
export default ConversationCanvas;
