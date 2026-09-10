/**
 * test_professional_work_execution_core.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 0 — Professional Work Execution Core Test Suite
 *
 * Tests 17 scenarios covering:
 *   WorkSession creation, task dependency DAG, MAX_CONCURRENT=1,
 *   ONE TASK execution, VERIFY/DISPLAY/COMMIT gates, NEXT blocked
 *   before COMMIT, retry, failure isolation, artifact append,
 *   same canvas, ordering, interruption snapshot, resume,
 *   completed-not-rerun, final COMPLETED invariant
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { WorkSession, TASK_STATUS, SESSION_STATUS, INVARIANTS } from '../src/services/work/WorkSession.js';
import { WorkExecutor } from '../src/services/work/WorkExecutor.js';
import { ArtifactStream } from '../src/services/work/ArtifactStream.js';
import { ConversationCanvas } from '../src/services/work/ConversationCanvas.js';
import { createWorkSession } from '../src/services/work/index.js';

// ═══════════════════════════════════════════════════════════════════════
// MOCK DOMAIN SERVICE
// ═══════════════════════════════════════════════════════════════════════

class MockDomainService {
  constructor(options = {}) {
    this.generateCount = 0;
    this.verifyCount = 0;
    this.displayCount = 0;
    this.commitCount = 0;
    this.failOnTask = options.failOnTask || null;
    this.failPhase = options.failPhase || 'GENERATE';
    this.artifactPrefix = options.artifactPrefix || 'Artifact';
  }

  async generate(task, context) {
    this.generateCount++;
    if (this.failOnTask === task.id && this.failPhase === 'GENERATE') {
      throw new Error(`Mock generate failure for ${task.id}`);
    }
    return {
      type: 'TEXT',
      content: `${this.artifactPrefix} for ${task.id}`,
      metadata: { taskId: task.id },
    };
  }

  async verify(artifact, context) {
    this.verifyCount++;
    if (artifact.metadata?.taskId === this.failOnTask && this.failPhase === 'VERIFY') {
      return { valid: false, reason: `Mock verify failure` };
    }
    return { valid: true };
  }

  async display(artifact, context) {
    this.displayCount++;
    if (artifact.metadata?.taskId === this.failOnTask && this.failPhase === 'DISPLAY') {
      throw new Error(`Mock display failure`);
    }
  }

  async commit(artifact, context) {
    this.commitCount++;
    if (artifact.metadata?.taskId === this.failOnTask && this.failPhase === 'COMMIT') {
      throw new Error(`Mock commit failure`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 1: WorkSession creation
// ═══════════════════════════════════════════════════════════════════════

describe('WorkSession Creation', () => {
  it('should create a session with defaults', () => {
    const session = new WorkSession();
    assert.ok(session.id.startsWith('WS-'));
    assert.equal(session.domain, 'UNKNOWN');
    assert.equal(session.status, SESSION_STATUS.PLANNING);
    assert.deepEqual(session.tasks, []);
    assert.deepEqual(session.artifacts, []);
  });

  it('should create a session from orchestration', () => {
    const orchestration = {
      domain: 'RESEARCH',
      objective: 'Research AI trends',
      tasks: [
        { id: 'T1', type: 'SEARCH', description: 'Search web' },
        { id: 'T2', type: 'ANALYZE', description: 'Analyze results', dependencies: ['T1'] },
      ],
    };
    const session = WorkSession.create(orchestration);
    assert.equal(session.domain, 'RESEARCH');
    assert.equal(session.tasks.length, 2);
    assert.equal(session.tasks[0].status, TASK_STATUS.QUEUED);
    assert.equal(session.tasks[1].status, TASK_STATUS.BLOCKED);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 2: Task dependency DAG
// ═══════════════════════════════════════════════════════════════════════

describe('Task Dependency DAG', () => {
  it('should resolve blocked tasks when dependencies are met', () => {
    const session = new WorkSession({ domain: 'TEST' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'C', dependencies: ['T1', 'T2'] });

    assert.equal(session.tasks[0].status, TASK_STATUS.QUEUED);
    assert.equal(session.tasks[1].status, TASK_STATUS.BLOCKED);
    assert.equal(session.tasks[2].status, TASK_STATUS.BLOCKED);

    session.transitionTask('T1', TASK_STATUS.RUNNING);
    session.transitionTask('T1', TASK_STATUS.GENERATED);
    session.transitionTask('T1', TASK_STATUS.VERIFIED);
    session.transitionTask('T1', TASK_STATUS.DISPLAYED);
    session.transitionTask('T1', TASK_STATUS.COMMITTED);

    assert.equal(session.tasks[1].status, TASK_STATUS.QUEUED);
    assert.equal(session.tasks[2].status, TASK_STATUS.BLOCKED);

    session.transitionTask('T2', TASK_STATUS.RUNNING);
    session.transitionTask('T2', TASK_STATUS.GENERATED);
    session.transitionTask('T2', TASK_STATUS.VERIFIED);
    session.transitionTask('T2', TASK_STATUS.DISPLAYED);
    session.transitionTask('T2', TASK_STATUS.COMMITTED);

    assert.equal(session.tasks[2].status, TASK_STATUS.QUEUED);
  });

  it('should handle diamond dependency pattern', () => {
    const session = new WorkSession({ domain: 'TEST' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'C', dependencies: ['T1'] });
    session.addTask({ id: 'T4', type: 'D', dependencies: ['T2', 'T3'] });

    assert.equal(session.tasks[0].status, TASK_STATUS.QUEUED);
    assert.equal(session.tasks[1].status, TASK_STATUS.BLOCKED);
    assert.equal(session.tasks[2].status, TASK_STATUS.BLOCKED);
    assert.equal(session.tasks[3].status, TASK_STATUS.BLOCKED);

    // Complete T1
    for (const s of [TASK_STATUS.RUNNING, TASK_STATUS.GENERATED, TASK_STATUS.VERIFIED, TASK_STATUS.DISPLAYED, TASK_STATUS.COMMITTED]) {
      session.transitionTask('T1', s);
    }

    assert.equal(session.tasks[1].status, TASK_STATUS.QUEUED);
    assert.equal(session.tasks[2].status, TASK_STATUS.QUEUED);
    assert.equal(session.tasks[3].status, TASK_STATUS.BLOCKED);

    // Complete T2
    for (const s of [TASK_STATUS.RUNNING, TASK_STATUS.GENERATED, TASK_STATUS.VERIFIED, TASK_STATUS.DISPLAYED, TASK_STATUS.COMMITTED]) {
      session.transitionTask('T2', s);
    }

    assert.equal(session.tasks[3].status, TASK_STATUS.BLOCKED);

    // Complete T3
    for (const s of [TASK_STATUS.RUNNING, TASK_STATUS.GENERATED, TASK_STATUS.VERIFIED, TASK_STATUS.DISPLAYED, TASK_STATUS.COMMITTED]) {
      session.transitionTask('T3', s);
    }

    assert.equal(session.tasks[3].status, TASK_STATUS.QUEUED);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 3: MAX_CONCURRENT_WORK_TASKS = 1
// ═══════════════════════════════════════════════════════════════════════

describe('MAX_CONCURRENT_WORK_TASKS = 1', () => {
  it('should enforce MAX_CONCURRENT = 1 via invariant', () => {
    assert.equal(INVARIANTS.MAX_CONCURRENT_WORK_TASKS, 1);
  });

  it('should only allow one task to start at a time', () => {
    const session = new WorkSession({ domain: 'TEST' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B' });

    session.currentTaskId = 'T1';
    session.transitionTask('T1', TASK_STATUS.RUNNING);

    // T2 should be QUEUED but NEXT_TASK_ALLOWED should return false
    assert.equal(INVARIANTS.NEXT_TASK_ALLOWED(session), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 4: ONE TASK execution
// ═══════════════════════════════════════════════════════════════════════

describe('ONE TASK Execution', () => {
  it('should execute a single task through full pipeline', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A', description: 'Test task' });

    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', new MockDomainService());

    const result = await executor.execute();

    assert.equal(result.status, SESSION_STATUS.COMPLETED);
    assert.equal(result.completedTasks, 1);
    assert.equal(session.tasks[0].status, TASK_STATUS.COMMITTED);
    assert.ok(INVARIANTS.IS_COMPLETED(session.tasks[0]));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 5: VERIFY gate
// ═══════════════════════════════════════════════════════════════════════

describe('VERIFY Gate', () => {
  it('should fail task when verification fails', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B', dependencies: ['T1'] });

    const mock = new MockDomainService({ failOnTask: 'T1', failPhase: 'VERIFY' });
    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', mock);

    const result = await executor.execute();

    assert.equal(result.status, SESSION_STATUS.FAILED);
    assert.equal(session.tasks[0].status, TASK_STATUS.FAILED_TERMINAL);
    assert.equal(session.tasks[1].status, TASK_STATUS.BLOCKED);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 6: DISPLAY gate
// ═══════════════════════════════════════════════════════════════════════

describe('DISPLAY Gate', () => {
  it('should fail task when display fails', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });

    const mock = new MockDomainService({ failOnTask: 'T1', failPhase: 'DISPLAY' });
    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', mock);

    const result = await executor.execute();

    assert.equal(result.status, SESSION_STATUS.FAILED);
    assert.equal(session.tasks[0].status, TASK_STATUS.FAILED_TERMINAL);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 7: COMMIT gate
// ═══════════════════════════════════════════════════════════════════════

describe('COMMIT Gate', () => {
  it('should fail task when commit fails', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });

    const mock = new MockDomainService({ failOnTask: 'T1', failPhase: 'COMMIT' });
    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', mock);

    const result = await executor.execute();

    assert.equal(result.status, SESSION_STATUS.FAILED);
    assert.equal(session.tasks[0].status, TASK_STATUS.FAILED_TERMINAL);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 8: NEXT blocked before COMMIT
// ═══════════════════════════════════════════════════════════════════════

describe('NEXT Blocked Before COMMIT', () => {
  it('should not start next task until current is COMMITTED', () => {
    const session = new WorkSession({ domain: 'TEST' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B' });

    session.currentTaskId = 'T1';

    // T1 is RUNNING - next should be blocked
    session.transitionTask('T1', TASK_STATUS.RUNNING);
    assert.equal(INVARIANTS.NEXT_TASK_ALLOWED(session), false);

    // T1 is GENERATED - still blocked
    session.transitionTask('T1', TASK_STATUS.GENERATED);
    assert.equal(INVARIANTS.NEXT_TASK_ALLOWED(session), false);

    // T1 is VERIFIED - still blocked
    session.transitionTask('T1', TASK_STATUS.VERIFIED);
    assert.equal(INVARIANTS.NEXT_TASK_ALLOWED(session), false);

    // T1 is DISPLAYED - still blocked
    session.transitionTask('T1', TASK_STATUS.DISPLAYED);
    assert.equal(INVARIANTS.NEXT_TASK_ALLOWED(session), false);

    // T1 is COMMITTED - next allowed
    session.transitionTask('T1', TASK_STATUS.COMMITTED);
    assert.equal(INVARIANTS.NEXT_TASK_ALLOWED(session), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 9: Retry on transient failure
// ═══════════════════════════════════════════════════════════════════════

describe('Retry on Transient Failure', () => {
  it('should retry task up to maxRetries then fail terminal', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A', maxRetries: 2 });

    const mock = new MockDomainService({ failOnTask: 'T1', failPhase: 'GENERATE' });
    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', mock);

    const result = await executor.execute();

    assert.equal(session.tasks[0].retries, 3);
    assert.equal(session.tasks[0].status, TASK_STATUS.FAILED_TERMINAL);
    assert.equal(mock.generateCount, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 10: Failure isolation
// ═══════════════════════════════════════════════════════════════════════

describe('Failure Isolation', () => {
  it('should not affect other tasks when one fails', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B', dependencies: ['T1'] });

    const mock = new MockDomainService({ failOnTask: 'T1', failPhase: 'GENERATE' });
    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', mock);

    const result = await executor.execute();

    assert.equal(session.tasks[0].status, TASK_STATUS.FAILED_TERMINAL);
    assert.equal(session.tasks[1].status, TASK_STATUS.BLOCKED);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 11: Artifact append
// ═══════════════════════════════════════════════════════════════════════

describe('Artifact Append', () => {
  it('should append artifacts to stream and canvas', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B' });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('MOCK', new MockDomainService());

    await executor.execute();

    assert.equal(artifactStream.count, 2);
    assert.equal(canvas.count, 2);
    assert.equal(session.artifacts.length, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 12: Same canvas for all domains
// ═══════════════════════════════════════════════════════════════════════

describe('Same Canvas for All Domains', () => {
  it('should use the same canvas across multiple executions', () => {
    const canvas = new ConversationCanvas('conv-1');

    const session1 = new WorkSession({ domain: 'MOCK' });
    session1.addTask({ id: 'T1', type: 'A' });

    const session2 = new WorkSession({ domain: 'MOCK' });
    session2.addTask({ id: 'T2', type: 'B' });

    const exec1 = new WorkExecutor(session1, { canvas });
    const exec2 = new WorkExecutor(session2, { canvas });

    assert.equal(exec1.canvas, exec2.canvas);
    assert.equal(exec1.canvas.conversationId, 'conv-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 13: Ordering
// ═══════════════════════════════════════════════════════════════════════

describe('Ordering', () => {
  it('should maintain artifact order', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B' });
    session.addTask({ id: 'T3', type: 'C' });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('MOCK', new MockDomainService());

    await executor.execute();

    const artifacts = canvas.getAll();
    assert.equal(artifacts[0].order, 1);
    assert.equal(artifacts[1].order, 2);
    assert.equal(artifacts[2].order, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 14: Interruption snapshot
// ═══════════════════════════════════════════════════════════════════════

describe('Interruption Snapshot', () => {
  it('should capture snapshot on interruption', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B' });

    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', new MockDomainService());

    // Start execution in background
    const execPromise = executor.execute();

    // Wait a bit then interrupt
    await new Promise(r => setTimeout(r, 50));
    executor.interrupt();

    const result = await execPromise;
    const snapshot = executor.getSnapshot();

    assert.ok(snapshot.session);
    assert.ok(snapshot.artifactStream);
    assert.ok(snapshot.canvas);
    assert.ok(snapshot.session.tasks.length === 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 15: Resume from snapshot
// ═══════════════════════════════════════════════════════════════════════

describe('Resume from Snapshot', () => {
  it('should restore session from snapshot', () => {
    const original = new WorkSession({ domain: 'TEST', objective: 'Test resume' });
    original.addTask({ id: 'T1', type: 'A' });
    original.addTask({ id: 'T2', type: 'B', dependencies: ['T1'] });
    original.transitionTask('T1', TASK_STATUS.RUNNING);
    original.transitionTask('T1', TASK_STATUS.GENERATED);

    const snapshot = original.getSnapshot();
    const restored = WorkSession.fromSnapshot(snapshot);

    assert.equal(restored.id, original.id);
    assert.equal(restored.domain, 'TEST');
    assert.equal(restored.tasks.length, 2);
    assert.equal(restored.tasks[0].status, TASK_STATUS.GENERATED);
    assert.equal(restored.tasks[1].status, TASK_STATUS.BLOCKED);
    assert.equal(restored.dag['T2'][0], 'T1');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 16: Completed not re-run
// ═══════════════════════════════════════════════════════════════════════

describe('Completed Not Re-run', () => {
  it('should not re-run completed tasks', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });

    const mock = new MockDomainService();
    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', mock);

    await executor.execute();

    assert.equal(mock.generateCount, 1);

    // Try to execute again - T1 is already COMMITTED
    const executor2 = new WorkExecutor(session);
    executor2.registerDomain('MOCK', mock);
    await executor2.execute();

    assert.equal(mock.generateCount, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 17: Final COMPLETED invariant
// ═══════════════════════════════════════════════════════════════════════

describe('Final COMPLETED Invariant', () => {
  it('should only mark COMPLETED when all 4 flags are true', async () => {
    const session = new WorkSession({ domain: 'MOCK' });
    session.addTask({ id: 'T1', type: 'A' });
    session.addTask({ id: 'T2', type: 'B' });

    const executor = new WorkExecutor(session);
    executor.registerDomain('MOCK', new MockDomainService());

    const result = await executor.execute();

    assert.equal(result.status, SESSION_STATUS.COMPLETED);
    for (const task of session.tasks) {
      assert.ok(task.generated, `${task.id} generated`);
      assert.ok(task.verified, `${task.id} verified`);
      assert.ok(task.displayed, `${task.id} displayed`);
      assert.ok(task.committed, `${task.id} committed`);
      assert.ok(INVARIANTS.IS_COMPLETED(task), `${task.id} IS_COMPLETED`);
    }
  });

  it('should verify COMPLETED = generated && verified && displayed && committed', () => {
    const task = {
      generated: true,
      verified: true,
      displayed: true,
      committed: true,
      status: TASK_STATUS.COMMITTED,
    };
    assert.ok(INVARIANTS.IS_COMPLETED(task));

    task.generated = false;
    assert.ok(!INVARIANTS.IS_COMPLETED(task));

    task.generated = true;
    task.verified = false;
    assert.ok(!INVARIANTS.IS_COMPLETED(task));

    task.verified = true;
    task.displayed = false;
    assert.ok(!INVARIANTS.IS_COMPLETED(task));

    task.displayed = true;
    task.committed = false;
    assert.ok(!INVARIANTS.IS_COMPLETED(task));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BONUS: ArtifactStream tests
// ═══════════════════════════════════════════════════════════════════════

describe('ArtifactStream', () => {
  it('should append and retrieve artifacts', () => {
    const stream = new ArtifactStream('session-1');
    const art1 = stream.append({ type: 'TEXT', content: 'Hello' });
    const art2 = stream.append({ type: 'SVG_VECTOR', content: '<svg/>' });

    assert.equal(stream.count, 2);
    assert.equal(stream.getById(art1.id).content, 'Hello');
    assert.equal(stream.getLatest().content, '<svg/>');
  });

  it('should update artifact by taskId', () => {
    const stream = new ArtifactStream('session-1');
    stream.append({ taskId: 'T1', type: 'TEXT', content: 'Original' });

    const updated = stream.updateByTaskId('T1', { content: 'Updated' });
    assert.equal(updated.content, 'Updated');
  });

  it('should filter by type', () => {
    const stream = new ArtifactStream('session-1');
    stream.append({ type: 'TEXT', content: 'a' });
    stream.append({ type: 'SVG_VECTOR', content: 'b' });
    stream.append({ type: 'TEXT', content: 'c' });

    assert.equal(stream.getByType('TEXT').length, 2);
    assert.equal(stream.getByType('SVG_VECTOR').length, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BONUS: ConversationCanvas tests
// ═══════════════════════════════════════════════════════════════════════

describe('ConversationCanvas', () => {
  it('should append artifacts with correct order', () => {
    const canvas = new ConversationCanvas('conv-1');
    const a1 = canvas.appendArtifact({ id: 'A1', type: 'TEXT', content: 'a' });
    const a2 = canvas.appendArtifact({ id: 'A2', type: 'TEXT', content: 'b' });

    assert.equal(a1.order, 1);
    assert.equal(a2.order, 2);
    assert.equal(canvas.count, 2);
  });

  it('should update artifact content', () => {
    const canvas = new ConversationCanvas('conv-1');
    canvas.appendArtifact({ id: 'A1', type: 'TEXT', content: 'Original' });

    const updated = canvas.updateArtifact('A1', 'Updated');
    assert.equal(updated.content, 'Updated');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BONUS: index.js exports
// ═══════════════════════════════════════════════════════════════════════

describe('Index Exports', () => {
  it('should export createWorkSession factory', () => {
    assert.equal(typeof createWorkSession, 'function');
  });

  it('should create a fully-wired work session', () => {
    const { session, executor, artifactStream, canvas } = createWorkSession({
      domain: 'MOCK',
      objective: 'Test',
      tasks: [{ id: 'T1', type: 'A' }],
    });

    assert.ok(session);
    assert.ok(executor);
    assert.ok(artifactStream);
    assert.ok(canvas);
    assert.equal(session.domain, 'MOCK');
    assert.equal(session.tasks.length, 1);
  });
});
