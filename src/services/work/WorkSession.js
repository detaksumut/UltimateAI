/**
 * WorkSession.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Session Data Model
 *
 * Represents a single unit of work with DAG-based task dependencies.
 * Each session tracks: domain, objective, tasks, dependency graph, artifacts.
 *
 * Invariants:
 *   MAX_CONCURRENT_WORK_TASKS = 1
 *   NEXT_TASK_ALLOWED = all dependencies COMMITTED
 *   COMPLETED = generated && verified && displayed && committed
 * ═══════════════════════════════════════════════════════════════════════
 */

const TASK_STATUS = {
  QUEUED: 'QUEUED',
  BLOCKED: 'BLOCKED',
  RUNNING: 'RUNNING',
  GENERATED: 'GENERATED',
  VERIFIED: 'VERIFIED',
  DISPLAYED: 'DISPLAYED',
  COMMITTED: 'COMMITTED',
  FAILED: 'FAILED',
  FAILED_TERMINAL: 'FAILED_TERMINAL',
};

const SESSION_STATUS = {
  PLANNING: 'PLANNING',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PAUSED: 'PAUSED',
};

const INVARIANTS = {
  MAX_CONCURRENT_WORK_TASKS: 1,

  CAN_START: (session, taskId) => {
    const task = session.tasks.find(t => t.id === taskId);
    if (!task) return false;
    if (task.status !== TASK_STATUS.QUEUED) return false;
    const deps = session.dag[taskId] || [];
    return deps.every(depId => {
      const dep = session.tasks.find(t => t.id === depId);
      return dep && dep.status === TASK_STATUS.COMMITTED;
    });
  },

  IS_COMPLETED: (task) => {
    return task.generated === true
      && task.verified === true
      && task.displayed === true
      && task.committed === true
      && task.status === TASK_STATUS.COMMITTED;
  },

  NEXT_TASK_ALLOWED: (session) => {
    if (!session.currentTaskId) return true;
    const current = session.tasks.find(t => t.id === session.currentTaskId);
    if (!current) return true;
    return INVARIANTS.IS_COMPLETED(current) || current.status === TASK_STATUS.FAILED_TERMINAL;
  },
};

let sessionCounter = 0;

class WorkSession {
  constructor(config = {}) {
    this.id = config.id || `WS-${Date.now()}-${++sessionCounter}`;
    this.domain = config.domain || 'UNKNOWN';
    this.objective = config.objective || '';
    this.status = config.status || SESSION_STATUS.PLANNING;
    this.tasks = [];
    this.dag = {};
    this.currentTaskId = null;
    this.artifacts = [];
    this.metadata = config.metadata || {};
    this.createdAt = config.createdAt || new Date().toISOString();
    this.updatedAt = this.createdAt;
  }

  /**
   * Create a WorkSession from an orchestration result
   */
  static create(orchestration) {
    const session = new WorkSession({
      domain: orchestration.domain,
      objective: orchestration.objective,
      metadata: orchestration.metadata || {},
    });

    if (orchestration.tasks && Array.isArray(orchestration.tasks)) {
      for (const taskDef of orchestration.tasks) {
        session.addTask(taskDef);
      }
    }

    return session;
  }

  /**
   * Add a task to the session
   */
  addTask(taskDef) {
    const task = {
      id: taskDef.id || `T${this.tasks.length + 1}`,
      type: taskDef.type || 'GENERIC',
      description: taskDef.description || '',
      domain: taskDef.domain || this.domain, // Use task domain or fall back to session domain
      status: TASK_STATUS.BLOCKED,
      dependencies: taskDef.dependencies || [],
      generated: false,
      verified: false,
      displayed: false,
      committed: false,
      artifact: null,
      error: null,
      retries: 0,
      maxRetries: taskDef.maxRetries || 2,
      metadata: taskDef.metadata || {},
    };

    this.tasks.push(task);
    this.dag[task.id] = task.dependencies;
    this._resolveBlockedStatuses();
    this.updatedAt = new Date().toISOString();
    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId) {
    return this.tasks.find(t => t.id === taskId) || null;
  }

  /**
   * Get all tasks that are ready to execute (QUEUED and all deps COMMITTED)
   */
  getReadyTasks() {
    return this.tasks.filter(t =>
      t.status === TASK_STATUS.QUEUED &&
      (this.dag[t.id] || []).every(depId => {
        const dep = this.tasks.find(d => d.id === depId);
        return dep && dep.status === TASK_STATUS.COMMITTED;
      })
    );
  }

  /**
   * Get next task to execute (first ready task in order)
   */
  getNextTask() {
    if (!INVARIANTS.NEXT_TASK_ALLOWED(this)) return null;
    const ready = this.getReadyTasks();
    return ready.length > 0 ? ready[0] : null;
  }

  /**
   * Get a task that is RUNNING (retry after failure)
   */
  getRetryTask() {
    const running = this.tasks.find(t => t.status === TASK_STATUS.RUNNING);
    return running || null;
  }

  /**
   * Transition task status
   */
  transitionTask(taskId, newStatus) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const validTransitions = {
      [TASK_STATUS.BLOCKED]: [TASK_STATUS.QUEUED],
      [TASK_STATUS.QUEUED]: [TASK_STATUS.RUNNING, TASK_STATUS.FAILED],
      [TASK_STATUS.RUNNING]: [TASK_STATUS.GENERATED, TASK_STATUS.FAILED],
      [TASK_STATUS.GENERATED]: [TASK_STATUS.VERIFIED, TASK_STATUS.FAILED],
      [TASK_STATUS.VERIFIED]: [TASK_STATUS.DISPLAYED, TASK_STATUS.FAILED],
      [TASK_STATUS.DISPLAYED]: [TASK_STATUS.COMMITTED, TASK_STATUS.FAILED],
      [TASK_STATUS.COMMITTED]: [],
      [TASK_STATUS.FAILED]: [TASK_STATUS.RUNNING, TASK_STATUS.FAILED_TERMINAL],
      [TASK_STATUS.FAILED_TERMINAL]: [],
    };

    const allowed = validTransitions[task.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid transition: ${task.status} → ${newStatus} for task ${taskId}`);
    }

    task.status = newStatus;

    if (newStatus === TASK_STATUS.COMMITTED) {
      task.generated = true;
      task.verified = true;
      task.displayed = true;
      task.committed = true;
    }

    if (newStatus === TASK_STATUS.GENERATED) task.generated = true;
    if (newStatus === TASK_STATUS.VERIFIED) task.verified = true;
    if (newStatus === TASK_STATUS.DISPLAYED) task.displayed = true;
    if (newStatus === TASK_STATUS.COMMITTED) task.committed = true;

    if (newStatus === TASK_STATUS.QUEUED) {
      task.generated = false;
      task.verified = false;
      task.displayed = false;
      task.committed = false;
      task.artifact = null;
    }

    this.updatedAt = new Date().toISOString();
    this._resolveBlockedStatuses();
    return task;
  }

  /**
   * Set task artifact
   */
  setArtifact(taskId, artifact) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.artifact = artifact;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Set task error
   */
  setError(taskId, error) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.error = error;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Append artifact to session
   */
  appendArtifact(artifact) {
    this.artifacts.push({
      ...artifact,
      sessionId: this.id,
      timestamp: new Date().toISOString(),
    });
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Check if all tasks are completed
   */
  isAllCompleted() {
    return this.tasks.length > 0 && this.tasks.every(t => INVARIANTS.IS_COMPLETED(t));
  }

  /**
   * Check if session is stuck (no tasks can ever progress)
   */
  isStuck() {
    const remaining = this.tasks.filter(t =>
      t.status !== TASK_STATUS.COMMITTED && t.status !== TASK_STATUS.FAILED_TERMINAL
    );
    if (remaining.length === 0) return !this.isAllCompleted();

    // Session is NOT stuck if any task is QUEUED or RUNNING
    const hasActive = remaining.some(t =>
      t.status === TASK_STATUS.QUEUED || t.status === TASK_STATUS.RUNNING
    );
    if (hasActive) return false;

    // Session is stuck if all remaining tasks are blocked with dead dependencies
    for (const task of remaining) {
      if (task.status === TASK_STATUS.GENERATED || task.status === TASK_STATUS.VERIFIED || task.status === TASK_STATUS.DISPLAYED) {
        return false;
      }
      if (task.status === TASK_STATUS.BLOCKED) {
        const deps = this.dag[task.id] || [];
        if (deps.length === 0) return false; // No deps = can always progress
        const hasLiveDep = deps.some(depId => {
          const dep = this.tasks.find(d => d.id === depId);
          return dep && dep.status !== TASK_STATUS.FAILED_TERMINAL && dep.status !== TASK_STATUS.FAILED;
        });
        if (hasLiveDep) return false;
      }
    }

    return true;
  }

  /**
   * Get snapshot for persistence
   */
  getSnapshot() {
    return {
      id: this.id,
      domain: this.domain,
      objective: this.objective,
      status: this.status,
      tasks: this.tasks.map(t => ({
        id: t.id,
        type: t.type,
        description: t.description,
        status: t.status,
        dependencies: t.dependencies,
        generated: t.generated,
        verified: t.verified,
        displayed: t.displayed,
        committed: t.committed,
        retries: t.retries,
        maxRetries: t.maxRetries,
        error: t.error,
        metadata: t.metadata,
      })),
      dag: { ...this.dag },
      currentTaskId: this.currentTaskId,
      artifacts: [...this.artifacts],
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Restore from snapshot
   */
  static fromSnapshot(snapshot) {
    const session = new WorkSession({
      id: snapshot.id,
      domain: snapshot.domain,
      objective: snapshot.objective,
      status: snapshot.status,
      metadata: snapshot.metadata,
      createdAt: snapshot.createdAt,
    });

    session.tasks = snapshot.tasks.map(t => ({
      ...t,
      artifact: null,
    }));
    session.dag = { ...snapshot.dag };
    session.currentTaskId = snapshot.currentTaskId;
    session.artifacts = [...(snapshot.artifacts || [])];
    session.updatedAt = snapshot.updatedAt;

    return session;
  }

  /**
   * Resolve BLOCKED tasks that now have all dependencies met
   */
  _resolveBlockedStatuses() {
    for (const task of this.tasks) {
      if (task.status === TASK_STATUS.BLOCKED) {
        const deps = this.dag[task.id] || [];
        const allDepsMet = deps.every(depId => {
          const dep = this.tasks.find(d => d.id === depId);
          return dep && dep.status === TASK_STATUS.COMMITTED;
        });
        if (allDepsMet) {
          task.status = TASK_STATUS.QUEUED;
        }
      }
    }
  }
}

export { WorkSession, TASK_STATUS, SESSION_STATUS, INVARIANTS };
export default WorkSession;
