/**
 * test_document_domain.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 3 — Document Domain Service Test Suite
 *
 * Tests:
 *   DocumentService: parse, process, output
 *   Integration: DocumentService → WorkExecutor → WorkSession
 *   Format detection: plain text, markdown, HTML, JSON
 *   LLM integration: processing, output generation
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DocumentService } from '../src/services/work/domains/DocumentService.js';
import { WorkSession, TASK_STATUS } from '../src/services/work/WorkSession.js';
import { WorkExecutor } from '../src/services/work/WorkExecutor.js';
import { ArtifactStream } from '../src/services/work/ArtifactStream.js';
import { ConversationCanvas } from '../src/services/work/ConversationCanvas.js';
import { DomainRouter } from '../src/services/work/DomainRouter.js';

// ═══════════════════════════════════════════════════════════════════════
// MOCK LLM CLIENT
// ═══════════════════════════════════════════════════════════════════════

class MockLLMClient {
  constructor() {
    this.callCount = 0;
    this.lastMessages = null;
  }

  async sendChat({ messages, model, temperature, stream }) {
    this.callCount++;
    this.lastMessages = messages;
    return 'Ini adalah hasil pemrosesan dokumen dari LLM mock.';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: DocumentService Core
// ═══════════════════════════════════════════════════════════════════════

describe('DocumentService', () => {
  it('should create with default options', () => {
    const service = new DocumentService();
    assert.ok(service);
    assert.equal(service.maxContentLength, 50000);
  });

  it('should create with custom options', () => {
    const service = new DocumentService({
      llmModel: 'qwen3:8b',
      maxContentLength: 100000,
    });
    assert.equal(service.llmModel, 'qwen3:8b');
    assert.equal(service.maxContentLength, 100000);
  });

  it('should handle PARSE task with no input', async () => {
    const service = new DocumentService();
    const task = { id: 'T1', type: 'PARSE', description: 'Parse document' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Tidak ada konten'));
    assert.equal(result.metadata.parsed, false);
  });

  it('should handle PARSE task with text input', async () => {
    const service = new DocumentService();
    const task = { id: 'T1', type: 'PARSE', description: 'Parse document', input: 'Hello world\nThis is a test document.' };
    const context = { session: { objective: 'Test', artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Hello world'));
    assert.equal(result.metadata.parsed, true);
    assert.equal(result.metadata.format, 'PLAIN_TEXT');
  });

  it('should detect markdown format', async () => {
    const service = new DocumentService();
    const task = { id: 'T1', type: 'PARSE', input: '# Heading\n\n**Bold text** and [link](url)' };
    const context = { session: { objective: 'Test', artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.metadata.format, 'MARKDOWN');
  });

  it('should detect HTML format', async () => {
    const service = new DocumentService();
    const task = { id: 'T1', type: 'PARSE', input: '<div><p>Hello</p></div>' };
    const context = { session: { objective: 'Test', artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.metadata.format, 'HTML');
  });

  it('should detect JSON format', async () => {
    const service = new DocumentService();
    const task = { id: 'T1', type: 'PARSE', input: '{"key": "value"}' };
    const context = { session: { objective: 'Test', artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.metadata.format, 'JSON');
  });

  it('should handle PROCESS task without LLM', async () => {
    const service = new DocumentService({ llmClient: null });
    const task = { id: 'T2', type: 'PROCESS', description: 'Process doc' };
    const context = {
      session: {
        objective: 'Test',
        artifacts: [{ taskId: 'T1', content: 'Original content\n\n\n\nWith extra spaces' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Dokumen Diproses'));
    assert.equal(result.metadata.mode, 'BASIC');
  });

  it('should handle PROCESS task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new DocumentService({ llmClient: llm });
    const task = { id: 'T2', type: 'PROCESS', description: 'Process doc' };
    const context = {
      session: {
        objective: 'Test',
        artifacts: [{ taskId: 'T1', content: 'Content to process' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.metadata.model, 'qwen3:8b');
  });

  it('should handle OUTPUT task without LLM', async () => {
    const service = new DocumentService({ llmClient: null });
    const task = { id: 'T3', type: 'OUTPUT', description: 'Generate output' };
    const context = {
      session: {
        objective: 'Test',
        artifacts: [
          { taskId: 'T1', content: 'Data 1' },
          { taskId: 'T2', content: 'Data 2' },
        ],
        tasks: [{ id: 'T1' }, { id: 'T2' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Dokumen Output'));
    assert.ok(result.content.includes('Data 1'));
  });

  it('should handle OUTPUT task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new DocumentService({ llmClient: llm });
    const task = { id: 'T3', type: 'OUTPUT', description: 'Generate output' };
    const context = {
      session: {
        objective: 'Test',
        artifacts: [{ taskId: 'T1', content: 'Combined data' }],
        tasks: [{ id: 'T1' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.ok(result.content.includes('LLM mock'));
  });

  it('should verify valid artifact', async () => {
    const service = new DocumentService();
    const result = await service.verify({ content: 'Valid content' });
    assert.ok(result.valid);
  });

  it('should reject empty artifact', async () => {
    const service = new DocumentService();
    const result = await service.verify({ content: '' });
    assert.ok(!result.valid);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Metadata Extraction
// ═══════════════════════════════════════════════════════════════════════

describe('DocumentService Metadata', () => {
  it('should extract word count', async () => {
    const service = new DocumentService();
    const task = { id: 'T1', type: 'PARSE', input: 'one two three four five' };
    const context = { session: { objective: 'Test', artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.metadata.wordCount, 5);
  });

  it('should extract char count', async () => {
    const service = new DocumentService();
    const task = { id: 'T1', type: 'PARSE', input: 'Hello' };
    const context = { session: { objective: 'Test', artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.metadata.charCount, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with WorkExecutor
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: DocumentService → WorkExecutor', () => {
  it('should execute DOCUMENT tasks through WorkExecutor', async () => {
    const service = new DocumentService({ llmClient: null });

    const session = new WorkSession({ domain: 'DOCUMENT', objective: 'Process document' });
    session.addTask({ id: 'T1', type: 'PARSE', description: 'Parse input', input: 'Test document content' });
    session.addTask({ id: 'T2', type: 'PROCESS', description: 'Process', dependencies: ['T1'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('DOCUMENT', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 2);
    assert.equal(artifactStream.count, 2);
  });

  it('should chain PARSE → PROCESS → OUTPUT', async () => {
    const service = new DocumentService({ llmClient: null });

    const session = new WorkSession({ domain: 'DOCUMENT', objective: 'Generate report' });
    session.addTask({ id: 'T1', type: 'PARSE', description: 'Parse', input: 'Raw data' });
    session.addTask({ id: 'T2', type: 'PROCESS', description: 'Process', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'OUTPUT', description: 'Output', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('DOCUMENT', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Domain Registration
// ═══════════════════════════════════════════════════════════════════════

describe('Domain Registration', () => {
  it('should register DocumentService on DomainRouter', () => {
    const router = new DomainRouter();
    const service = new DocumentService();
    router.register('DOCUMENT', service);

    assert.ok(router.hasDomain('DOCUMENT'));
    assert.equal(router.getDomain('DOCUMENT'), service);
  });

  it('should route document tasks to DocumentService', () => {
    const router = new DomainRouter();
    const service = new DocumentService();
    router.register('DOCUMENT', service);

    const domain = router.route({ id: 'T1', type: 'PARSE' }, 'convert document', null);
    assert.equal(domain, 'DOCUMENT');
  });
});

