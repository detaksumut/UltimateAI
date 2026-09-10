/**
 * test_automation_domain.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 6 — Automation Domain Service Test Suite
 *
 * Tests:
 *   AutomationService: map, build, test
 *   Script Generation: JavaScript, Python, Bash
 *   Integration: AutomationService → WorkExecutor → WorkSession
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AutomationService } from '../src/services/work/domains/AutomationService.js';
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
    return '## Workflow: Automated Backup\n\n### Step 1: Connect\n- Connect to database\n\n### Step 2: Export\n- Export data\n\n### Step 3: Compress\n- Compress files';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: AutomationService Core
// ═══════════════════════════════════════════════════════════════════════

describe('AutomationService', () => {
  it('should create with default options', () => {
    const service = new AutomationService();
    assert.ok(service);
    assert.equal(service.scriptLanguage, 'javascript');
  });

  it('should create with custom script language', () => {
    const service = new AutomationService({ scriptLanguage: 'python' });
    assert.equal(service.scriptLanguage, 'python');
  });

  it('should handle MAP task without LLM', async () => {
    const service = new AutomationService({ llmClient: null });
    const task = { id: 'T1', type: 'MAP', description: 'Automate backups' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Workflow'));
    assert.equal(result.metadata.phase, 'MAP');
  });

  it('should handle MAP task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new AutomationService({ llmClient: llm });
    const task = { id: 'T1', type: 'MAP', description: 'Automate backups' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.metadata.model, 'qwen3:8b');
  });

  it('should handle BUILD task without LLM (javascript)', async () => {
    const service = new AutomationService({ llmClient: null, scriptLanguage: 'javascript' });
    const task = { id: 'T2', type: 'BUILD', description: 'Build script' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '## Workflow: Backup\n### Step 1: Connect' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'CODE');
    assert.ok(result.content.includes('async function'));
    assert.equal(result.metadata.language, 'javascript');
  });

  it('should handle BUILD task without LLM (python)', async () => {
    const service = new AutomationService({ llmClient: null, scriptLanguage: 'python' });
    const task = { id: 'T2', type: 'BUILD', description: 'Build script' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '## Workflow: Backup' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'CODE');
    assert.ok(result.content.includes('import asyncio'));
    assert.equal(result.metadata.language, 'python');
  });

  it('should handle BUILD task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new AutomationService({ llmClient: llm });
    const task = { id: 'T2', type: 'BUILD', description: 'Build script' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '## Workflow: Backup' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should handle TEST task without LLM', async () => {
    const service = new AutomationService({ llmClient: null });
    const task = { id: 'T3', type: 'TEST', description: 'Test automation' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T2', content: '// Step 1: Connect\ntry {\n  // code\n} catch (e) {\n  // handle\n}\n// Step 2: Export' }],
        tasks: [{ id: 'T2' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'MARKDOWN');
    assert.ok(result.content.includes('Hasil Test'));
    assert.ok(result.content.includes('✓'));
  });

  it('should handle TEST task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new AutomationService({ llmClient: llm });
    const task = { id: 'T3', type: 'TEST', description: 'Test' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T2', content: 'some script' }],
        tasks: [{ id: 'T2' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should verify valid artifact', async () => {
    const service = new AutomationService();
    const result = await service.verify({ content: 'Valid content' });
    assert.ok(result.valid);
  });

  it('should reject empty artifact', async () => {
    const service = new AutomationService();
    const result = await service.verify({ content: '' });
    assert.ok(!result.valid);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Script Generation
// ═══════════════════════════════════════════════════════════════════════

describe('Script Generation', () => {
  it('should generate JavaScript template', () => {
    const service = new AutomationService({ scriptLanguage: 'javascript' });
    const result = service._buildWithoutLLM(null, { id: 'T1', description: 'Test' });

    assert.ok(result.content.includes('async function'));
    assert.ok(result.content.includes('try'));
    assert.ok(result.content.includes('catch'));
  });

  it('should generate Python template', () => {
    const service = new AutomationService({ scriptLanguage: 'python' });
    const result = service._buildWithoutLLM(null, { id: 'T1', description: 'Test' });

    assert.ok(result.content.includes('import asyncio'));
    assert.ok(result.content.includes('async def'));
    assert.ok(result.content.includes('except'));
  });

  it('should generate Bash template', () => {
    const service = new AutomationService({ scriptLanguage: 'bash' });
    const result = service._buildWithoutLLM(null, { id: 'T1', description: 'Test' });

    assert.ok(result.content.includes('#!/bin/bash'));
    assert.ok(result.content.includes('if'));
    assert.ok(result.content.includes('fi'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Test Validation
// ═══════════════════════════════════════════════════════════════════════

describe('Test Validation', () => {
  it('should detect complete script', () => {
    const service = new AutomationService({ llmClient: null });
    const script = `// Step 1: Connect\ntry {\n  // code\n} catch (e) {}\n// Step 2: Export`;
    const result = service._testWithoutLLM(script, { id: 'T1' });

    assert.ok(result.content.includes('PASS'));
  });

  it('should detect missing error handling', () => {
    const service = new AutomationService({ llmClient: null });
    const script = `// Step 1: Connect\nconst x = 1;\n// Step 2: Export`;
    const result = service._testWithoutLLM(script, { id: 'T1' });

    assert.ok(result.content.includes('PARTIAL'));
  });

  it('should handle empty script', () => {
    const service = new AutomationService({ llmClient: null });
    const result = service._testWithoutLLM(null, { id: 'T1' });

    assert.ok(result.content.includes('✗'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with WorkExecutor
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: AutomationService → WorkExecutor', () => {
  it('should execute AUTOMATION tasks through WorkExecutor', async () => {
    const service = new AutomationService({ llmClient: null });

    const session = new WorkSession({ domain: 'AUTOMATION', objective: 'Automate database backup' });
    session.addTask({ id: 'T1', type: 'MAP', description: 'Map workflow' });
    session.addTask({ id: 'T2', type: 'BUILD', description: 'Build script', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'TEST', description: 'Test automation', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('AUTOMATION', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });

  it('should chain MAP → BUILD → TEST', async () => {
    const service = new AutomationService({ llmClient: null });

    const session = new WorkSession({ domain: 'AUTOMATION', objective: 'Automate deployment' });
    session.addTask({ id: 'T1', type: 'MAP', description: 'Map deployment' });
    session.addTask({ id: 'T2', type: 'BUILD', description: 'Build', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'TEST', description: 'Test', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('AUTOMATION', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    const buildArtifact = artifactStream.getByTaskId('T2');
    assert.equal(buildArtifact.type, 'CODE');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Domain Registration
// ═══════════════════════════════════════════════════════════════════════

describe('Domain Registration', () => {
  it('should register AutomationService on DomainRouter', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new AutomationService();
    router.register('AUTOMATION', service);

    assert.ok(router.hasDomain('AUTOMATION'));
    assert.equal(router.getDomain('AUTOMATION'), service);
  });

  it('should route automation tasks to AutomationService', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new AutomationService();
    router.register('AUTOMATION', service);

    const domain = router.route({ id: 'T1', type: 'MAP' }, 'otomasi workflow', null);
    assert.equal(domain, 'AUTOMATION');
  });
});

