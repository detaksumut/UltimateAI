/**
 * test_complete_system.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 8 — Complete System Integration Test Suite
 *
 * Tests all domains working together:
 *   - All 7 domain services registered
 *   - IntelligenceOrchestrator routing
 *   - WorkExecutor execution
 *   - ArtifactStream + ConversationCanvas
 *   - Full pipeline: User → Intelligence → Domain → Artifact
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { WorkSession, TASK_STATUS } from '../src/services/work/WorkSession.js';
import { WorkExecutor } from '../src/services/work/WorkExecutor.js';
import { ArtifactStream } from '../src/services/work/ArtifactStream.js';
import { ConversationCanvas } from '../src/services/work/ConversationCanvas.js';
import { IntelligenceOrchestrator } from '../src/services/work/IntelligenceOrchestrator.js';
import { DomainRouter } from '../src/services/work/DomainRouter.js';
import { TaskPlanner } from '../src/services/work/TaskPlanner.js';

import { ResearchService } from '../src/services/work/domains/ResearchService.js';
import { DocumentService } from '../src/services/work/domains/DocumentService.js';
import { ContentService } from '../src/services/work/domains/ContentService.js';
import { PPTService } from '../src/services/work/domains/PPTService.js';
import { DataService } from '../src/services/work/domains/DataService.js';
import { AutomationService } from '../src/services/work/domains/AutomationService.js';
import { VoiceService } from '../src/services/work/domains/VoiceService.js';

// ═══════════════════════════════════════════════════════════════════════
// MOCK LLM CLIENT
// ═══════════════════════════════════════════════════════════════════════

class MockLLMClient {
  constructor() {
    this.callCount = 0;
  }

  async sendChat({ messages, model, temperature, stream }) {
    this.callCount++;
    return JSON.stringify({
      tasks: [
        { id: 'T1', type: 'STEP1', description: 'Step 1', domain: 'TEST' },
      ],
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: All Domain Services Registration
// ═══════════════════════════════════════════════════════════════════════

describe('All Domain Services Registration', () => {
  it('should register all 7 domain services', () => {
    const router = new DomainRouter();

    const researchService = new ResearchService();
    const documentService = new DocumentService();
    const contentService = new ContentService();
    const pptService = new PPTService();
    const dataService = new DataService();
    const automationService = new AutomationService();
    const voiceService = new VoiceService();

    router.register('RESEARCH', researchService);
    router.register('DOCUMENT', documentService);
    router.register('CONTENT', contentService);
    router.register('CREATIVE', pptService);
    router.register('DATA', dataService);
    router.register('AUTOMATION', automationService);
    router.register('VOICE', voiceService);

    assert.ok(router.hasDomain('RESEARCH'));
    assert.ok(router.hasDomain('DOCUMENT'));
    assert.ok(router.hasDomain('CONTENT'));
    assert.ok(router.hasDomain('CREATIVE'));
    assert.ok(router.hasDomain('DATA'));
    assert.ok(router.hasDomain('AUTOMATION'));
    assert.ok(router.hasDomain('VOICE'));
  });

  it('should have all domain services as instances', () => {
    const router = new DomainRouter();

    router.register('RESEARCH', new ResearchService());
    router.register('DOCUMENT', new DocumentService());
    router.register('CONTENT', new ContentService());
    router.register('CREATIVE', new PPTService());
    router.register('DATA', new DataService());
    router.register('AUTOMATION', new AutomationService());
    router.register('VOICE', new VoiceService());

    assert.ok(router.getDomain('RESEARCH') instanceof ResearchService);
    assert.ok(router.getDomain('DOCUMENT') instanceof DocumentService);
    assert.ok(router.getDomain('CONTENT') instanceof ContentService);
    assert.ok(router.getDomain('CREATIVE') instanceof PPTService);
    assert.ok(router.getDomain('DATA') instanceof DataService);
    assert.ok(router.getDomain('AUTOMATION') instanceof AutomationService);
    assert.ok(router.getDomain('VOICE') instanceof VoiceService);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: IntelligenceOrchestrator with All Domains
// ═══════════════════════════════════════════════════════════════════════

describe('IntelligenceOrchestrator with All Domains', () => {
  it('should route to RESEARCH domain', async () => {
    const router = new DomainRouter();
    router.register('RESEARCH', new ResearchService());
    router.register('DOCUMENT', new DocumentService());
    router.register('CONTENT', new ContentService());
    router.register('CREATIVE', new PPTService());
    router.register('DATA', new DataService());
    router.register('AUTOMATION', new AutomationService());
    router.register('VOICE', new VoiceService());

    const llm = new MockLLMClient();
    const taskPlanner = new TaskPlanner({ llmClient: llm });
    const orchestrator = new IntelligenceOrchestrator({ domainRouter: router, taskPlanner, llmClient: llm });

    const result = await orchestrator.orchestrate('Analisis tren AI terkini');

    assert.equal(result.domain, 'RESEARCH');
  });

  it('should route to DOCUMENT domain', async () => {
    const router = new DomainRouter();
    router.register('RESEARCH', new ResearchService());
    router.register('DOCUMENT', new DocumentService());
    router.register('CONTENT', new ContentService());
    router.register('CREATIVE', new PPTService());
    router.register('DATA', new DataService());
    router.register('AUTOMATION', new AutomationService());
    router.register('VOICE', new VoiceService());

    const llm = new MockLLMClient();
    const taskPlanner = new TaskPlanner({ llmClient: llm });
    const orchestrator = new IntelligenceOrchestrator({ domainRouter: router, taskPlanner, llmClient: llm });

    const result = await orchestrator.orchestrate('Buat laporan tahunan');

    assert.equal(result.domain, 'DOCUMENT');
  });

  it('should route to CONTENT domain', async () => {
    const router = new DomainRouter();
    router.register('RESEARCH', new ResearchService());
    router.register('DOCUMENT', new DocumentService());
    router.register('CONTENT', new ContentService());
    router.register('CREATIVE', new PPTService());
    router.register('DATA', new DataService());
    router.register('AUTOMATION', new AutomationService());
    router.register('VOICE', new VoiceService());

    const llm = new MockLLMClient();
    const taskPlanner = new TaskPlanner({ llmClient: llm });
    const orchestrator = new IntelligenceOrchestrator({ domainRouter: router, taskPlanner, llmClient: llm });

    const result = await orchestrator.orchestrate('Tulis artikel blog tentang teknologi');

    assert.equal(result.domain, 'CONTENT');
  });

  it('should route to DATA domain', async () => {
    const router = new DomainRouter();
    router.register('RESEARCH', new ResearchService());
    router.register('DOCUMENT', new DocumentService());
    router.register('CONTENT', new ContentService());
    router.register('CREATIVE', new PPTService());
    router.register('DATA', new DataService());
    router.register('AUTOMATION', new AutomationService());
    router.register('VOICE', new VoiceService());

    const llm = new MockLLMClient();
    const taskPlanner = new TaskPlanner({ llmClient: llm });
    const orchestrator = new IntelligenceOrchestrator({ domainRouter: router, taskPlanner, llmClient: llm });

    const result = await orchestrator.orchestrate('Buat grafik data penjualan Q1');

    assert.equal(result.domain, 'DATA');
  });

  it('should route to AUTOMATION domain', async () => {
    const router = new DomainRouter();
    router.register('RESEARCH', new ResearchService());
    router.register('DOCUMENT', new DocumentService());
    router.register('CONTENT', new ContentService());
    router.register('CREATIVE', new PPTService());
    router.register('DATA', new DataService());
    router.register('AUTOMATION', new AutomationService());
    router.register('VOICE', new VoiceService());

    const llm = new MockLLMClient();
    const taskPlanner = new TaskPlanner({ llmClient: llm });
    const orchestrator = new IntelligenceOrchestrator({ domainRouter: router, taskPlanner, llmClient: llm });

    const result = await orchestrator.orchestrate('Buat workflow otomasi backup server');

    assert.equal(result.domain, 'AUTOMATION');
  });

  it('should route to VOICE domain', async () => {
    const router = new DomainRouter();
    router.register('RESEARCH', new ResearchService());
    router.register('DOCUMENT', new DocumentService());
    router.register('CONTENT', new ContentService());
    router.register('CREATIVE', new PPTService());
    router.register('DATA', new DataService());
    router.register('AUTOMATION', new AutomationService());
    router.register('VOICE', new VoiceService());

    const llm = new MockLLMClient();
    const taskPlanner = new TaskPlanner({ llmClient: llm });
    const orchestrator = new IntelligenceOrchestrator({ domainRouter: router, taskPlanner, llmClient: llm });

    // Voice domain doesn't have keywords in DomainRouter, so it falls back to first available
    // In real usage, the context.domain would be set explicitly
    const result = await orchestrator.orchestrate('Transkripsi audio meeting', { domain: 'VOICE' });

    assert.equal(result.domain, 'VOICE');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Full Pipeline Integration
// ═══════════════════════════════════════════════════════════════════════

describe('Full Pipeline Integration', () => {
  it('should execute RESEARCH pipeline end-to-end', async () => {
    const session = new WorkSession({ domain: 'RESEARCH', objective: 'AI Trends 2024' });
    session.addTask({ id: 'T1', type: 'SEARCH', description: 'Search web' });
    session.addTask({ id: 'T2', type: 'ANALYZE', description: 'Analyze sources', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'SYNTHESIZE', description: 'Synthesize findings', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });

    const service = new ResearchService({ llmClient: null });
    executor.registerDomain('RESEARCH', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
    assert.equal(session.artifacts.length, 3);
  });

  it('should execute DOCUMENT pipeline end-to-end', async () => {
    const session = new WorkSession({ domain: 'DOCUMENT', objective: 'Annual Report' });
    session.addTask({ id: 'T1', type: 'PARSE', description: 'Parse input', input: 'Report content' });
    session.addTask({ id: 'T2', type: 'PROCESS', description: 'Process', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'OUTPUT', description: 'Output', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });

    const service = new DocumentService({ llmClient: null });
    executor.registerDomain('DOCUMENT', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });

  it('should execute DATA pipeline end-to-end', async () => {
    const session = new WorkSession({ domain: 'DATA', objective: 'Sales Analysis' });
    session.addTask({ id: 'T1', type: 'COLLECT', description: 'Collect data' });
    session.addTask({ id: 'T2', type: 'TRANSFORM', description: 'Transform', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'VISUALIZE', description: 'Visualize', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });

    const service = new DataService({ llmClient: null });
    executor.registerDomain('DATA', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });

  it('should execute AUTOMATION pipeline end-to-end', async () => {
    const session = new WorkSession({ domain: 'AUTOMATION', objective: 'Database Backup' });
    session.addTask({ id: 'T1', type: 'MAP', description: 'Map workflow' });
    session.addTask({ id: 'T2', type: 'BUILD', description: 'Build script', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'TEST', description: 'Test', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });

    const service = new AutomationService({ llmClient: null });
    executor.registerDomain('AUTOMATION', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });

  it('should execute VOICE pipeline end-to-end', async () => {
    const session = new WorkSession({ domain: 'VOICE', objective: 'Voice Command' });
    session.addTask({ id: 'T1', type: 'STT', description: 'Transcribe', input: 'Audio data' });
    session.addTask({ id: 'T2', type: 'PARSE', description: 'Parse', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'TTS', description: 'TTS', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });

    const service = new VoiceService({ llmClient: null });
    executor.registerDomain('VOICE', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Cross-Domain Artifact Handling
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Domain Artifact Handling', () => {
  it('should handle artifacts from multiple domains', async () => {
    const artifactStream = new ArtifactStream('session-123');

    // Research artifacts
    artifactStream.append({
      id: 'art-1', taskId: 'T1', domain: 'RESEARCH', type: 'JSON',
      content: '{"sources": []}', metadata: {},
    });

    // Document artifacts
    artifactStream.append({
      id: 'art-2', taskId: 'T2', domain: 'DOCUMENT', type: 'MARKDOWN',
      content: '## Report', metadata: {},
    });

    // Data artifacts
    artifactStream.append({
      id: 'art-3', taskId: 'T3', domain: 'DATA', type: 'SVG_VECTOR',
      content: '<svg></svg>', metadata: {},
    });

    assert.equal(artifactStream.artifacts.length, 3);
    assert.equal(artifactStream.getByTaskId('T1').domain, 'RESEARCH');
    assert.equal(artifactStream.getByTaskId('T2').domain, 'DOCUMENT');
    assert.equal(artifactStream.getByTaskId('T3').domain, 'DATA');
  });

  it('should track canvas artifacts from all domains', async () => {
    const canvas = new ConversationCanvas('session-123');

    canvas.appendArtifact({
      id: 'art-1', taskId: 'T1', type: 'TEXT', content: 'Research complete', domain: 'RESEARCH', metadata: {},
    });
    canvas.appendArtifact({
      id: 'art-2', taskId: 'T2', type: 'MARKDOWN', content: 'Document ready', domain: 'DOCUMENT', metadata: {},
    });
    canvas.appendArtifact({
      id: 'art-3', taskId: 'T3', type: 'SVG_VECTOR', content: '<svg></svg>', domain: 'DATA', metadata: {},
    });

    const all = canvas.getAll();
    assert.equal(all.length, 3);
    assert.equal(all[0].domain, 'RESEARCH');
    assert.equal(all[1].domain, 'DOCUMENT');
    assert.equal(all[2].domain, 'DATA');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: WorkSession Lifecycle
// ═══════════════════════════════════════════════════════════════════════

describe('WorkSession Lifecycle', () => {
  it('should complete full lifecycle', async () => {
    const session = new WorkSession({ domain: 'TEST', objective: 'Test lifecycle' });

    // Add tasks
    session.addTask({ id: 'T1', type: 'STEP1', description: 'First step' });
    session.addTask({ id: 'T2', type: 'STEP2', description: 'Second step', dependencies: ['T1'] });

    // Verify initial state
    assert.equal(session.tasks.length, 2);

    // Execute
    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });

    // Mock domain
    executor.registerDomain('TEST', {
      generate: async () => ({ type: 'TEXT', content: 'Done' }),
      verify: async () => ({ valid: true }),
      display: async () => {},
      commit: async () => {},
    });

    const result = await executor.execute();

    // Verify final state
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Index Exports
// ═══════════════════════════════════════════════════════════════════════

describe('Index Exports', () => {
  it('should export all domain services from index', async () => {
    const work = await import('../src/services/work/index.js');

    assert.ok(work.ResearchService);
    assert.ok(work.DocumentService);
    assert.ok(work.ContentService);
    assert.ok(work.PPTService);
    assert.ok(work.DataService);
    assert.ok(work.AutomationService);
    assert.ok(work.VoiceService);
  });

  it('should export all factory functions', async () => {
    const work = await import('../src/services/work/index.js');

    assert.equal(typeof work.createResearchService, 'function');
    assert.equal(typeof work.createDocumentService, 'function');
    assert.equal(typeof work.createContentService, 'function');
    assert.equal(typeof work.createPPTService, 'function');
    assert.equal(typeof work.createDataService, 'function');
    assert.equal(typeof work.createAutomationService, 'function');
    assert.equal(typeof work.createVoiceService, 'function');
  });
});
