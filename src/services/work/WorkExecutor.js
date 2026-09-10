/**
 * WorkExecutor.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Execution Engine
 *
 * The operating system for JIN's work. Executes tasks ONE AT A TIME
 * following the invariant:
 *
 *   ONE TASK → VERIFY → DISPLAY → COMMIT → NEXT TASK
 *
 * Invariants:
 *   MAX_CONCURRENT_WORK_TASKS = 1
 *   NEXT_TASK_ALLOWED = current task COMMITTED
 *   COMPLETED = generated && verified && displayed && committed
 * ═══════════════════════════════════════════════════════════════════════
 */

import { WorkSession, TASK_STATUS, SESSION_STATUS, INVARIANTS } from './WorkSession.js';
import { ArtifactStream } from './ArtifactStream.js';
import { ConversationCanvas } from './ConversationCanvas.js';

class WorkExecutor {
  constructor(session, options = {}) {
    this.session = session;
    this.artifactStream = options.artifactStream || new ArtifactStream(session.id);
    this.canvas = options.canvas || new ConversationCanvas(session.id);
    this.domainServices = new Map();
    this.adapters = new Map();

    this.onTaskStart = options.onTaskStart || (() => {});
    this.onTaskComplete = options.onTaskComplete || (() => {});
    this.onTaskFailed = options.onTaskFailed || (() => {});
    this.onArtifactReady = options.onArtifactReady || (() => {});
    this.onSessionComplete = options.onSessionComplete || (() => {});

    this._interrupted = false;
    this._pauseRequested = false;
  }

  /**
   * Register a domain service for a specific domain type
   */
  registerDomain(domain, service) {
    this.domainServices.set(domain, service);
    return this;
  }

  /**
   * Register an adapter for cross-cutting concerns
   */
  registerAdapter(name, adapter) {
    this.adapters.set(name, adapter);
    return this;
  }

  /**
   * Execute the entire work session
   */
  async execute() {
    this.session.status = SESSION_STATUS.EXECUTING;
    const startTime = Date.now();

    try {
      while (!this.session.isAllCompleted() && !this._interrupted && !this._pauseRequested) {
        if (this.session.isStuck()) {
          this.session.status = SESSION_STATUS.FAILED;
          break;
        }

        // Look for next task: QUEUED (fresh) or RUNNING (retry after failure)
        const nextTask = this.session.getNextTask();
        const retryTask = this.session.getRetryTask();
        const taskToRun = nextTask || retryTask;

        if (!taskToRun) {
          if (this.session.isAllCompleted()) break;
          await this._sleep(10);
          continue;
        }

        await this._executeTaskPipeline(taskToRun);
      }

      if (this.session.isAllCompleted()) {
        this.session.status = SESSION_STATUS.COMPLETED;
      } else if (this._pauseRequested) {
        this.session.status = SESSION_STATUS.PAUSED;
      }

      const result = this._buildResult(Date.now() - startTime);
      this.onSessionComplete(result);
      return result;

    } catch (error) {
      this.session.status = SESSION_STATUS.FAILED;
      throw error;
    }
  }

  /**
   * Execute the full pipeline for a single task:
   *   RUNNING → GENERATED → VERIFIED → DISPLAYED → COMMITTED
   */
  async _executeTaskPipeline(task) {
    this.session.currentTaskId = task.id;

    // 1. RUNNING (skip if already RUNNING from retry)
    if (task.status !== TASK_STATUS.RUNNING) {
      this.session.transitionTask(task.id, TASK_STATUS.RUNNING);
    }
    this.onTaskStart(task);

    // 2. GENERATE
    try {
      const artifact = await this._generate(task);
      task.artifact = artifact;
      this.session.setArtifact(task.id, artifact);
      this.session.transitionTask(task.id, TASK_STATUS.GENERATED);
    } catch (error) {
      await this._handleFailure(task, error, 'GENERATE');
      return;
    }

    // 3. VERIFY
    try {
      const verification = await this._verify(task);
      if (!verification.valid) {
        throw new Error(`Verification failed: ${verification.reason}`);
      }
      this.session.transitionTask(task.id, TASK_STATUS.VERIFIED);
    } catch (error) {
      await this._handleFailure(task, error, 'VERIFY');
      return;
    }

    // 4. DISPLAY
    try {
      await this._display(task);
      this.session.transitionTask(task.id, TASK_STATUS.DISPLAYED);
    } catch (error) {
      await this._handleFailure(task, error, 'DISPLAY');
      return;
    }

    // 5. COMMIT
    try {
      await this._commit(task);
      this.session.transitionTask(task.id, TASK_STATUS.COMMITTED);
      this.onTaskComplete(task, task.artifact, false);
    } catch (error) {
      await this._handleFailure(task, error, 'COMMIT');
      return;
    }
  }

  /**
   * Generate artifact for a task
   */
  async _generate(task) {
    // Use task's domain if available, otherwise fall back to session domain
    const taskDomain = task.domain || this.session.domain;
    const domainService = this.domainServices.get(taskDomain);
    if (!domainService) {
      throw new Error(`No domain service registered for: ${taskDomain}`);
    }

    if (typeof domainService.generate !== 'function') {
      throw new Error(`Domain service for ${taskDomain} has no generate() method`);
    }

    const context = {
      session: this.session,
      task,
      adapters: Object.fromEntries(this.adapters),
    };

    return await domainService.generate(task, context);
  }

  /**
   * Verify artifact
   */
  async _verify(task) {
    const taskDomain = task.domain || this.session.domain;
    const domainService = this.domainServices.get(taskDomain);
    if (!domainService) {
      return { valid: true, reason: 'No domain service; auto-verified' };
    }

    if (typeof domainService.verify !== 'function') {
      return { valid: true, reason: 'No verify() method; auto-verified' };
    }

    const context = {
      session: this.session,
      task,
      adapters: Object.fromEntries(this.adapters),
    };

    return await domainService.verify(task.artifact, context);
  }

  /**
   * Display artifact to canvas with streaming animation
   */
  async _display(task) {
    if (!task.artifact) return;

    // Use task's domain if available, otherwise fall back to session domain
    const artifactDomain = task.domain || this.session.domain;

    const streamRecord = this.artifactStream.append({
      taskId: task.id,
      type: task.artifact.type || 'TEXT',
      content: task.artifact.content || task.artifact,
      domain: artifactDomain,
      metadata: task.artifact.metadata || {},
    });

    // Stream artifact with flying animation
    await this.canvas.streamArtifact(streamRecord, {
      delay: 50,
      charSpeed: 3,
    });

    this.onArtifactReady(streamRecord);

    const domainService = this.domainServices.get(artifactDomain);
    if (domainService && typeof domainService.display === 'function') {
      const context = {
        session: this.session,
        task,
        canvas: this.canvas,
        artifactStream: this.artifactStream,
      };
      await domainService.display(task.artifact, context);
    }
  }

  /**
   * Commit artifact (persist)
   */
  async _commit(task) {
    const taskDomain = task.domain || this.session.domain;

    this.session.appendArtifact({
      taskId: task.id,
      type: task.artifact?.type || 'TEXT',
      content: task.artifact?.content || task.artifact,
      domain: taskDomain,
    });

    const domainService = this.domainServices.get(taskDomain);
    if (domainService && typeof domainService.commit === 'function') {
      const context = {
        session: this.session,
        task,
        adapters: Object.fromEntries(this.adapters),
      };
      await domainService.commit(task.artifact, context);
    }
  }

  /**
   * Handle task failure with retry logic
   */
  async _handleFailure(task, error, phase) {
    task.retries++;
    this.session.setError(task.id, { phase, message: error.message, retries: task.retries });

    if (task.retries <= task.maxRetries) {
      this.onTaskFailed(task, error, true);
      this.session.transitionTask(task.id, TASK_STATUS.FAILED);
      this.session.transitionTask(task.id, TASK_STATUS.RUNNING);
    } else {
      this.onTaskFailed(task, error, false);
      this.session.transitionTask(task.id, TASK_STATUS.FAILED);
      this.session.transitionTask(task.id, TASK_STATUS.FAILED_TERMINAL);
    }
  }

  /**
   * Pause execution
   */
  pause() {
    this._pauseRequested = true;
  }

  /**
   * Interrupt execution
   */
  interrupt() {
    this._interrupted = true;
  }

  /**
   * Get snapshot for persistence/resume
   */
  getSnapshot() {
    return {
      session: this.session.getSnapshot(),
      artifactStream: this.artifactStream.getSnapshot(),
      canvas: this.canvas.getSnapshot(),
    };
  }

  /**
   * Build result object
   */
  _buildResult(durationMs) {
    return {
      sessionId: this.session.id,
      status: this.session.status,
      domain: this.session.domain,
      objective: this.session.objective,
      totalTasks: this.session.tasks.length,
      completedTasks: this.session.tasks.filter(t => t.status === TASK_STATUS.COMMITTED).length,
      failedTasks: this.session.tasks.filter(t => t.status === TASK_STATUS.FAILED_TERMINAL).length,
      tasks: this.session.tasks.map(t => ({
        id: t.id,
        type: t.type,
        status: t.status,
        generated: t.generated,
        verified: t.verified,
        displayed: t.displayed,
        committed: t.committed,
        retries: t.retries,
        error: t.error,
      })),
      artifacts: this.session.artifacts,
      artifactCount: this.artifactStream.count,
      durationMs,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { WorkExecutor };
export default WorkExecutor;
