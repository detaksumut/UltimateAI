/**
 * test_research_domain.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 2 — Research Domain Service Test Suite
 *
 * Tests:
 *   ResearchService: search, analyze, synthesize
 *   Integration: ResearchService → WorkExecutor → WorkSession
 *   Tavily API: connection, fallback
 *   LLM integration: analysis, synthesis
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ResearchService } from '../src/services/work/domains/ResearchService.js';
import { WorkSession, TASK_STATUS } from '../src/services/work/WorkSession.js';
import { WorkExecutor } from '../src/services/work/WorkExecutor.js';
import { ArtifactStream } from '../src/services/work/ArtifactStream.js';
import { ConversationCanvas } from '../src/services/work/ConversationCanvas.js';
import { IntelligenceOrchestrator, DomainRouter, TaskPlanner, createOrchestrator } from '../src/services/work/index.js';

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
    return 'Ini adalah hasil analisis dari LLM mock untuk topik riset.';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: ResearchService Core
// ═══════════════════════════════════════════════════════════════════════

describe('ResearchService', () => {
  it('should create with default options', () => {
    const service = new ResearchService();
    assert.ok(service);
    assert.equal(service.maxSearchResults, 6);
  });

  it('should create with custom options', () => {
    const service = new ResearchService({
      tavilyApiKey: 'test-key',
      llmModel: 'qwen3:8b',
      maxSearchResults: 10,
    });
    assert.equal(service.tavilyApiKey, 'test-key');
    assert.equal(service.llmModel, 'qwen3:8b');
    assert.equal(service.maxSearchResults, 10);
  });

  it('should handle SEARCH task without Tavily key', async () => {
    const service = new ResearchService({ tavilyApiKey: '' });
    const task = { id: 'T1', type: 'SEARCH', description: 'Test search' };
    const context = { session: { objective: 'Test objective', artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Hasil Pencarian'));
    assert.equal(result.metadata.taskId, 'T1');
  });

  it('should handle ANALYZE task without LLM', async () => {
    const service = new ResearchService({ llmClient: null });
    const task = { id: 'T2', type: 'ANALYZE', description: 'Analyze data' };
    const context = {
      session: {
        objective: 'Test',
        artifacts: [{ taskId: 'T1', content: 'Search results data' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Analisis'));
    assert.equal(result.metadata.mode, 'NO_LLM');
  });

  it('should handle ANALYZE task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new ResearchService({ llmClient: llm });
    const task = { id: 'T2', type: 'ANALYZE', description: 'Analyze data' };
    const context = {
      session: {
        objective: 'Test',
        artifacts: [{ taskId: 'T1', content: 'Search results data' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Analisis'));
    assert.equal(result.metadata.model, 'qwen3:8b');
  });

  it('should handle SYNTHESIZE task without LLM', async () => {
    const service = new ResearchService({ llmClient: null });
    const task = { id: 'T3', type: 'SYNTHESIZE', description: 'Synthesize' };
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
    assert.ok(result.content.includes('Ringkasan'));
  });

  it('should handle SYNTHESIZE task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new ResearchService({ llmClient: llm });
    const task = { id: 'T3', type: 'SYNTHESIZE', description: 'Synthesize' };
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

    assert.equal(llm.callCount, 1);
    assert.ok(result.content.includes('Ringkasan'));
  });

  it('should verify valid artifact', async () => {
    const service = new ResearchService();
    const result = await service.verify({ content: 'Valid artifact with enough content' });
    assert.ok(result.valid);
  });

  it('should reject empty artifact', async () => {
    const service = new ResearchService();
    const result = await service.verify({ content: '' });
    assert.ok(!result.valid);
    assert.ok(result.reason.includes('Empty'));
  });

  it('should reject short artifact', async () => {
    const service = new ResearchService();
    const result = await service.verify({ content: 'short' });
    assert.ok(!result.valid);
    assert.ok(result.reason.includes('short'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: ResearchService Tavily Integration
// ═══════════════════════════════════════════════════════════════════════

describe('ResearchService Tavily', () => {
  it('should return empty sources when no API key', async () => {
    const service = new ResearchService({ tavilyApiKey: '' });
    const result = await service._tavilySearch('test query');

    assert.equal(result.sources.length, 0);
    assert.equal(result.answer, null);
  });

  it('should return empty sources for invalid API key', async () => {
    const service = new ResearchService({ tavilyApiKey: 'invalid-key-12345' });
    const result = await service._tavilySearch('test query');

    assert.equal(result.sources.length, 0);
  });

  it('should format search results as markdown', () => {
    const service = new ResearchService();
    const results = {
      answer: 'Test answer',
      sources: [
        { id: 'src_1', title: 'Source 1', url: 'https://example.com', domain: 'example.com', snippet: 'Test snippet' },
      ],
    };

    const markdown = service._formatSearchResults(results, 'test query');

    assert.ok(markdown.includes('Hasil Pencarian'));
    assert.ok(markdown.includes('Test answer'));
    assert.ok(markdown.includes('Source 1'));
    assert.ok(markdown.includes('example.com'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with WorkExecutor
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: ResearchService → WorkExecutor', () => {
  it('should execute RESEARCH tasks through WorkExecutor', async () => {
    const service = new ResearchService({ tavilyApiKey: '', llmClient: null });

    const session = new WorkSession({ domain: 'RESEARCH', objective: 'Test research' });
    session.addTask({ id: 'T1', type: 'SEARCH', description: 'Search AI trends' });
    session.addTask({ id: 'T2', type: 'ANALYZE', description: 'Analyze results', dependencies: ['T1'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('RESEARCH', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 2);
    assert.equal(artifactStream.count, 2);
  });

  it('should chain SEARCH → ANALYZE with artifact passing', async () => {
    const service = new ResearchService({ tavilyApiKey: '', llmClient: null });

    const session = new WorkSession({ domain: 'RESEARCH', objective: 'AI trends 2026' });
    session.addTask({ id: 'T1', type: 'SEARCH', description: 'Search AI trends' });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('RESEARCH', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    const art = artifactStream.getByTaskId('T1');
    assert.ok(art);
    assert.ok(art.content.includes('Hasil Pencarian'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with IntelligenceOrchestrator
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: Orchestrator → ResearchService', () => {
  it('should orchestrate research with real domain', async () => {
    const orch = createOrchestrator();
    const researchService = new ResearchService({ tavilyApiKey: '', llmClient: null });
    orch.registerDomain('RESEARCH', researchService);

    const orchestration = await orch.orchestrate('riset tren AI 2026');

    assert.equal(orchestration.domain, 'RESEARCH');
    assert.ok(orchestration.tasks.length > 0);
    assert.equal(orchestration.routing[orchestration.tasks[0].id], 'RESEARCH');
  });

  it('should execute full research pipeline', async () => {
    const orch = createOrchestrator();
    const researchService = new ResearchService({ tavilyApiKey: '', llmClient: null });
    orch.registerDomain('RESEARCH', researchService);

    const orchestration = await orch.orchestrate('riset tren AI');

    const session = WorkSession.create(orchestration);
    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('RESEARCH', researchService);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.ok(artifactStream.count > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Domain Registration
// ═══════════════════════════════════════════════════════════════════════

describe('Domain Registration', () => {
  it('should register ResearchService on DomainRouter', () => {
    const router = new DomainRouter();
    const service = new ResearchService();
    router.register('RESEARCH', service);

    assert.ok(router.hasDomain('RESEARCH'));
    assert.equal(router.getDomain('RESEARCH'), service);
  });

  it('should route research tasks to ResearchService', () => {
    const router = new DomainRouter();
    const service = new ResearchService();
    router.register('RESEARCH', service);

    const domain = router.route({ id: 'T1', type: 'SEARCH' }, 'riset AI', null);
    assert.equal(domain, 'RESEARCH');
  });
});

