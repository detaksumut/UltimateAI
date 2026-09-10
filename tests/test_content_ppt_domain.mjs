/**
 * test_content_ppt_domain.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 4 — Content + PPT Domain Service Test Suite
 *
 * Tests:
 *   ContentService: outline, draft, refine
 *   PPTService: outline, build (fallback), review
 *   Integration: Services → WorkExecutor → WorkSession
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ContentService } from '../src/services/work/domains/ContentService.js';
import { PPTService } from '../src/services/work/domains/PPTService.js';
import { WorkSession, TASK_STATUS } from '../src/services/work/WorkSession.js';
import { WorkExecutor } from '../src/services/work/WorkExecutor.js';
import { ArtifactStream } from '../src/services/work/ArtifactStream.js';
import { ConversationCanvas } from '../src/services/work/ConversationCanvas.js';

// ═══════════════════════════════════════════════════════════════════════
// MOCK LLM CLIENT
// ═══════════════════════════════════════════════════════════════════════

class MockLLMClient {
  constructor() {
    this.callCount = 0;
  }

  async sendChat({ messages, model, temperature, stream }) {
    this.callCount++;
    return 'Hasil konten dari LLM mock untuk presentasi dan artikel.';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: ContentService
// ═══════════════════════════════════════════════════════════════════════

describe('ContentService', () => {
  it('should create with default options', () => {
    const service = new ContentService();
    assert.ok(service);
    assert.equal(service.tone, 'professional');
  });

  it('should create with custom options', () => {
    const service = new ContentService({ tone: 'casual', llmModel: 'qwen3:8b' });
    assert.equal(service.tone, 'casual');
    assert.equal(service.llmModel, 'qwen3:8b');
  });

  it('should handle OUTLINE task without LLM', async () => {
    const service = new ContentService({ llmClient: null });
    const task = { id: 'T1', type: 'OUTLINE', description: 'AI trends' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Outline'));
    assert.equal(result.metadata.phase, 'OUTLINE');
  });

  it('should handle OUTLINE task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new ContentService({ llmClient: llm });
    const task = { id: 'T1', type: 'OUTLINE', description: 'AI trends' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.metadata.model, 'qwen3:8b');
  });

  it('should handle DRAFT task without LLM', async () => {
    const service = new ContentService({ llmClient: null });
    const task = { id: 'T2', type: 'DRAFT', description: 'Write article' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '# Outline\n- Point 1\n- Point 2', metadata: { phase: 'OUTLINE' } }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.equal(result.metadata.phase, 'DRAFT');
  });

  it('should handle DRAFT task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new ContentService({ llmClient: llm });
    const task = { id: 'T2', type: 'DRAFT', description: 'Write article' };
    const context = { session: { artifacts: [], tasks: [{ id: 'T2' }] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should handle REFINE task without LLM', async () => {
    const service = new ContentService({ llmClient: null });
    const task = { id: 'T3', type: 'REFINE', description: 'Polish article' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T2', content: 'Draft content\n\n\n\nWith extra lines' }],
        tasks: [{ id: 'T2' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.equal(result.metadata.phase, 'REFINE');
    assert.ok(!result.content.includes('\n\n\n\n'));
  });

  it('should handle REFINE task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new ContentService({ llmClient: llm });
    const task = { id: 'T3', type: 'REFINE', description: 'Polish' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T2', content: 'Draft' }],
        tasks: [{ id: 'T2' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should verify valid artifact', async () => {
    const service = new ContentService();
    const result = await service.verify({ content: 'Valid content with enough length for verification' });
    assert.ok(result.valid);
  });

  it('should reject short artifact', async () => {
    const service = new ContentService();
    const result = await service.verify({ content: 'short' });
    assert.ok(!result.valid);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: PPTService
// ═══════════════════════════════════════════════════════════════════════

describe('PPTService', () => {
  it('should create with default options', () => {
    const service = new PPTService();
    assert.ok(service);
  });

  it('should detect pptxgenjs availability', () => {
    const service = new PPTService();
    // In test environment, pptxgenjs may or may not be installed
    assert.equal(typeof service.hasPptxGen, 'boolean');
  });

  it('should handle OUTLINE task without LLM', async () => {
    const service = new PPTService({ llmClient: null });
    const task = { id: 'T1', type: 'OUTLINE', description: 'AI presentation' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Slide'));
    assert.equal(result.metadata.phase, 'OUTLINE');
  });

  it('should handle OUTLINE task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new PPTService({ llmClient: llm });
    const task = { id: 'T1', type: 'OUTLINE', description: 'AI presentation' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.metadata.model, 'qwen3:8b');
  });

  it('should handle BUILD task with fallback', async () => {
    const service = new PPTService({ llmClient: null });
    const task = { id: 'T2', type: 'BUILD', description: 'Build PPT' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '# Title\n## Slide 1\n- Point 1\n- Point 2\n## Slide 2\n- Point 3', metadata: { phase: 'OUTLINE' } }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'PPT_SLIDES');
    assert.ok(result.content.includes('svg'));
    assert.equal(result.metadata.phase, 'BUILD');
    assert.ok(result.metadata.slideCount > 0);
  });

  it('should handle REVIEW task without LLM', async () => {
    const service = new PPTService({ llmClient: null });
    const task = { id: 'T3', type: 'REVIEW', description: 'Review PPT' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T2', content: 'Built slides content' }],
        tasks: [{ id: 'T2' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Review'));
  });

  it('should handle REVIEW task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new PPTService({ llmClient: llm });
    const task = { id: 'T3', type: 'REVIEW', description: 'Review PPT' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T2', content: 'Slides' }],
        tasks: [{ id: 'T2' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should verify valid artifact', async () => {
    const service = new PPTService();
    const result = await service.verify({ content: 'Valid PPT content' });
    assert.ok(result.valid);
  });

  it('should reject empty artifact', async () => {
    const service = new PPTService();
    const result = await service.verify({ content: '' });
    assert.ok(!result.valid);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with WorkExecutor
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: ContentService → WorkExecutor', () => {
  it('should execute CONTENT tasks through WorkExecutor', async () => {
    const service = new ContentService({ llmClient: null });

    const session = new WorkSession({ domain: 'CONTENT', objective: 'Write article' });
    session.addTask({ id: 'T1', type: 'OUTLINE', description: 'Outline' });
    session.addTask({ id: 'T2', type: 'DRAFT', description: 'Draft', dependencies: ['T1'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('CONTENT', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 2);
  });

  it('should chain OUTLINE → DRAFT → REFINE', async () => {
    const service = new ContentService({ llmClient: null });

    const session = new WorkSession({ domain: 'CONTENT', objective: 'Write article' });
    session.addTask({ id: 'T1', type: 'OUTLINE', description: 'Outline' });
    session.addTask({ id: 'T2', type: 'DRAFT', description: 'Draft', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'REFINE', description: 'Refine', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('CONTENT', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });
});

describe('Integration: PPTService → WorkExecutor', () => {
  it('should execute PPT tasks through WorkExecutor', async () => {
    const service = new PPTService({ llmClient: null });

    const session = new WorkSession({ domain: 'CREATIVE', objective: 'Create presentation' });
    session.addTask({ id: 'T1', type: 'OUTLINE', description: 'Outline PPT' });
    session.addTask({ id: 'T2', type: 'BUILD', description: 'Build', dependencies: ['T1'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('CREATIVE', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Domain Registration
// ═══════════════════════════════════════════════════════════════════════

describe('Domain Registration', () => {
  it('should register ContentService on DomainRouter', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new ContentService();
    router.register('CONTENT', service);

    assert.ok(router.hasDomain('CONTENT'));
    assert.equal(router.getDomain('CONTENT'), service);
  });

  it('should register PPTService on DomainRouter', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new PPTService();
    router.register('CREATIVE', service);

    assert.ok(router.hasDomain('CREATIVE'));
    assert.equal(router.getDomain('CREATIVE'), service);
  });
});

