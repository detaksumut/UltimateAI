/**
 * test_voice_domain.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 7 — Voice Domain Service Test Suite
 *
 * Tests:
 *   VoiceService: STT, TTS, PARSE
 *   Voice Command Parsing: keyword matching
 *   Integration: VoiceService → WorkExecutor → WorkSession
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { VoiceService } from '../src/services/work/domains/VoiceService.js';
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
    return 'Halo, saya ingin mencari informasi tentang cuaca hari ini.';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: VoiceService Core
// ═══════════════════════════════════════════════════════════════════════

describe('VoiceService', () => {
  it('should create with default options', () => {
    const service = new VoiceService();
    assert.ok(service);
    assert.equal(service.language, 'id-ID');
  });

  it('should create with custom options', () => {
    const service = new VoiceService({ language: 'en-US', voice: 'female' });
    assert.equal(service.language, 'en-US');
    assert.equal(service.voice, 'female');
  });

  it('should handle STT task without LLM', async () => {
    const service = new VoiceService({ llmClient: null });
    const task = { id: 'T1', type: 'STT', description: 'Transcribe audio', input: 'Audio data here' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'TEXT');
    assert.ok(result.content.includes('Transkripsi'));
    assert.equal(result.metadata.phase, 'STT');
  });

  it('should handle STT task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new VoiceService({ llmClient: llm });
    const task = { id: 'T1', type: 'STT', description: 'Transcribe', input: 'Audio data' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.metadata.model, 'qwen3:8b');
  });

  it('should handle TTS task without LLM', async () => {
    const service = new VoiceService({ llmClient: null });
    const task = { id: 'T2', type: 'TTS', description: 'Synthesize speech', input: 'Halo dunia' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'AUDIO_META');
    assert.ok(result.content.includes('Audio'));
    assert.equal(result.metadata.phase, 'TTS');
  });

  it('should handle TTS task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new VoiceService({ llmClient: llm });
    const task = { id: 'T2', type: 'TTS', description: 'Synthesize', input: 'Hello' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should handle PARSE task without LLM', async () => {
    const service = new VoiceService({ llmClient: null });
    const task = { id: 'T3', type: 'PARSE', description: 'Parse command', input: 'cari informasi cuaca' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'JSON');
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'SEARCH');
    assert.ok(data.entities.length > 0);
    assert.equal(result.metadata.phase, 'PARSE');
  });

  it('should handle PARSE task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new VoiceService({ llmClient: llm });
    const task = { id: 'T3', type: 'PARSE', description: 'Parse', input: 'buka browser' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should verify valid artifact', async () => {
    const service = new VoiceService();
    const result = await service.verify({ content: 'Valid content' });
    assert.ok(result.valid);
  });

  it('should reject empty artifact', async () => {
    const service = new VoiceService();
    const result = await service.verify({ content: '' });
    assert.ok(!result.valid);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Voice Command Parsing
// ═══════════════════════════════════════════════════════════════════════

describe('Voice Command Parsing', () => {
  it('should detect SEARCH intent', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('cari informasi cuaca', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'SEARCH');
  });

  it('should detect OPEN intent', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('buka browser', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'OPEN');
  });

  it('should detect CLOSE intent', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('tutup aplikasi', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'CLOSE');
  });

  it('should detect EXECUTE intent', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('jalankan script', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'EXECUTE');
  });

  it('should detect CREATE intent', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('buat dokumen baru', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'CREATE');
  });

  it('should detect DELETE intent', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('hapus file', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'DELETE');
  });

  it('should detect UPDATE intent', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('update data', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'UPDATE');
  });

  it('should extract entities', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('cari informasi cuaca jakarta', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.ok(data.entities.includes('informasi'));
    assert.ok(data.entities.includes('cuaca'));
    assert.ok(data.entities.includes('jakarta'));
  });

  it('should handle empty transcript', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._parseWithoutLLM('', { id: 'T1' });
    const data = JSON.parse(result.content);
    assert.equal(data.intent, 'UNKNOWN');
    assert.equal(data.confidence, 0.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: TTS Generation
// ═══════════════════════════════════════════════════════════════════════

describe('TTS Generation', () => {
  it('should generate SSML output', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._ttsWithoutLLM('Halo dunia', { id: 'T1' });

    assert.ok(result.content.includes('speak'));
    assert.ok(result.content.includes('prosody'));
    assert.ok(result.content.includes('Halo dunia'));
  });

  it('should include prosody information', () => {
    const service = new VoiceService({ llmClient: null });
    const result = service._ttsWithoutLLM('Test', { id: 'T1' });

    assert.ok(result.content.includes('Tempo'));
    assert.ok(result.content.includes('Nada'));
    assert.ok(result.content.includes('Volume'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with WorkExecutor
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: VoiceService → WorkExecutor', () => {
  it('should execute VOICE tasks through WorkExecutor', async () => {
    const service = new VoiceService({ llmClient: null });

    const session = new WorkSession({ domain: 'VOICE', objective: 'Process voice command' });
    session.addTask({ id: 'T1', type: 'STT', description: 'Transcribe audio', input: 'Audio data' });
    session.addTask({ id: 'T2', type: 'PARSE', description: 'Parse command', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'TTS', description: 'Synthesize response', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('VOICE', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });

  it('should chain STT → PARSE → TTS', async () => {
    const service = new VoiceService({ llmClient: null });

    const session = new WorkSession({ domain: 'VOICE', objective: 'Voice interaction' });
    session.addTask({ id: 'T1', type: 'STT', description: 'Transcribe', input: 'Audio' });
    session.addTask({ id: 'T2', type: 'PARSE', description: 'Parse', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'TTS', description: 'TTS', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('VOICE', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    const parseArtifact = artifactStream.getByTaskId('T2');
    assert.equal(parseArtifact.type, 'JSON');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Domain Registration
// ═══════════════════════════════════════════════════════════════════════

describe('Domain Registration', () => {
  it('should register VoiceService on DomainRouter', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new VoiceService();
    router.register('VOICE', service);

    assert.ok(router.hasDomain('VOICE'));
    assert.equal(router.getDomain('VOICE'), service);
  });

  it('should route voice tasks to VoiceService', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new VoiceService();
    router.register('VOICE', service);

    const domain = router.route({ id: 'T1', type: 'STT' }, 'transkripsi audio', null);
    assert.equal(domain, 'VOICE');
  });
});

