/**
 * test_intelligence_orchestrator.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 1 — Intelligence Orchestrator Test Suite
 *
 * Tests:
 *   IntelligenceOrchestrator: orchestrate, classifyDomain, DAG validation
 *   DomainRouter: route, routeAll, keyword classification
 *   TaskPlanner: plan with template, plan with LLM, fallback
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { IntelligenceOrchestrator } from '../src/services/work/IntelligenceOrchestrator.js';
import { DomainRouter, DOMAIN_KEYWORDS } from '../src/services/work/DomainRouter.js';
import { TaskPlanner, DOMAIN_TASK_TEMPLATES } from '../src/services/work/TaskPlanner.js';
import { createOrchestrator } from '../src/services/work/index.js';

// ═══════════════════════════════════════════════════════════════════════
// MOCK LLM CLIENT
// ═══════════════════════════════════════════════════════════════════════

class MockLLMClient {
  constructor(response = null) {
    this.callCount = 0;
    this.lastMessages = null;
    this.response = response;
    this.shouldFail = false;
  }

  async sendChat({ messages, model, temperature, stream }) {
    this.callCount++;
    this.lastMessages = messages;

    if (this.shouldFail) {
      throw new Error('LLM unavailable');
    }

    if (this.response) {
      return this.response;
    }

    return JSON.stringify({
      tasks: [
        { id: 'T1', type: 'SEARCH', description: 'Search web', dependencies: [] },
        { id: 'T2', type: 'ANALYZE', description: 'Analyze results', dependencies: ['T1'] },
      ],
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: TaskPlanner
// ═══════════════════════════════════════════════════════════════════════

describe('TaskPlanner', () => {
  it('should use template when no LLM client', async () => {
    const planner = new TaskPlanner();
    const result = await planner.plan('Test goal', 'RESEARCH');

    assert.equal(result.domain, 'RESEARCH');
    assert.ok(result.tasks.length > 0);
    assert.equal(result.tasks[0].type, 'SEARCH');
  });

  it('should use LLM when client available', async () => {
    const llm = new MockLLMClient();
    const planner = new TaskPlanner({ llmClient: llm });
    const result = await planner.plan('Test goal', 'RESEARCH');

    assert.equal(llm.callCount, 1);
    assert.equal(result.tasks.length, 2);
    assert.equal(result.tasks[0].type, 'SEARCH');
    assert.equal(result.tasks[1].dependencies[0], 'T1');
  });

  it('should fallback to template when LLM fails', async () => {
    const llm = new MockLLMClient();
    llm.shouldFail = true;
    const planner = new TaskPlanner({ llmClient: llm });
    const result = await planner.plan('Test goal', 'CONTENT');

    assert.equal(llm.callCount, 1);
    assert.equal(result.tasks[0].type, 'OUTLINE');
  });

  it('should handle malformed LLM response gracefully', async () => {
    const llm = new MockLLMClient('not json at all');
    const planner = new TaskPlanner({ llmClient: llm });
    const result = await planner.plan('Test goal', 'DATA');

    assert.equal(result.tasks[0].type, 'COLLECT');
  });

  it('should have templates for all domains', () => {
    const domains = ['RESEARCH', 'DOCUMENT', 'CONTENT', 'DATA', 'CREATIVE', 'DESIGN', 'AUTOMATION', 'GENERAL'];
    for (const domain of domains) {
      assert.ok(DOMAIN_TASK_TEMPLATES[domain], `Missing template for ${domain}`);
      assert.ok(DOMAIN_TASK_TEMPLATES[domain].length > 0, `Empty template for ${domain}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: DomainRouter
// ═══════════════════════════════════════════════════════════════════════

describe('DomainRouter', () => {
  it('should register and retrieve domains', () => {
    const router = new DomainRouter();
    router.register('TEST', { generate: () => {} });

    assert.ok(router.hasDomain('TEST'));
    assert.ok(!router.hasDomain('MISSING'));
    assert.equal(router.getRegisteredDomains().length, 1);
  });

  it('should route by task domain hint', () => {
    const router = new DomainRouter();
    router.register('RESEARCH', {});
    router.register('CONTENT', {});

    const domain = router.route({ id: 'T1', domain: 'RESEARCH' }, 'goal', 'CONTENT');
    assert.equal(domain, 'RESEARCH');
  });

  it('should route by session domain', () => {
    const router = new DomainRouter();
    router.register('CONTENT', {});

    const domain = router.route({ id: 'T1' }, 'goal', 'CONTENT');
    assert.equal(domain, 'CONTENT');
  });

  it('should route by task type', () => {
    const router = new DomainRouter();
    router.register('RESEARCH', {});
    router.register('CONTENT', {});

    const domain = router.route({ id: 'T1', type: 'SEARCH' }, 'goal', null);
    assert.equal(domain, 'RESEARCH');
  });

  it('should route by keyword in description', () => {
    const router = new DomainRouter();
    router.register('RESEARCH', {});

    const domain = router.route({ id: 'T1', description: 'telusuri informasi AI' }, 'goal', null);
    assert.equal(domain, 'RESEARCH');
  });

  it('should route by keyword in objective', () => {
    const router = new DomainRouter();
    router.register('CONTENT', {});

    const domain = router.route({ id: 'T1' }, 'tulis artikel tentang AI', null);
    assert.equal(domain, 'CONTENT');
  });

  it('should fallback to GENERAL', () => {
    const router = new DomainRouter();
    router.register('GENERAL', {});

    const domain = router.route({ id: 'T1' }, 'random goal', null);
    assert.equal(domain, 'GENERAL');
  });

  it('should route all tasks', () => {
    const router = new DomainRouter();
    router.register('RESEARCH', {});
    router.register('CONTENT', {});

    const tasks = [
      { id: 'T1', type: 'SEARCH' },
      { id: 'T2', type: 'WRITE' },
    ];

    const routing = router.routeAll(tasks, 'goal', null);
    assert.equal(routing.T1, 'RESEARCH');
    assert.equal(routing.T2, 'CONTENT');
  });

  it('should have keywords for all domains', () => {
    const domains = ['RESEARCH', 'DOCUMENT', 'CONTENT', 'DATA', 'CREATIVE', 'DESIGN', 'AUTOMATION'];
    for (const domain of domains) {
      assert.ok(DOMAIN_KEYWORDS[domain], `Missing keywords for ${domain}`);
      assert.ok(DOMAIN_KEYWORDS[domain].length > 0, `Empty keywords for ${domain}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: IntelligenceOrchestrator
// ═══════════════════════════════════════════════════════════════════════

describe('IntelligenceOrchestrator', () => {
  it('should orchestrate a goal', async () => {
    const orch = createOrchestrator();
    const result = await orch.orchestrate('Telusuri tren AI 2026');

    assert.ok(result.domain);
    assert.ok(result.tasks.length > 0);
    assert.ok(result.routing);
    assert.equal(result.objective, 'Telusuri tren AI 2026');
  });

  it('should classify domain from goal keywords', () => {
    const orch = createOrchestrator();

    assert.equal(orch.classifyDomain('riset tentang AI'), 'RESEARCH');
    assert.equal(orch.classifyDomain('tulis artikel'), 'CONTENT');
    assert.equal(orch.classifyDomain('buat grafik data'), 'DATA');
    assert.equal(orch.classifyDomain('otomasi workflow'), 'AUTOMATION');
    assert.equal(orch.classifyDomain('desain rumah'), 'DESIGN');
    assert.equal(orch.classifyDomain('gambar ilustrasi'), 'CREATIVE');
    assert.equal(orch.classifyDomain('convert ke PDF'), 'DOCUMENT');
  });

  it('should classify domain from intent', () => {
    const orch = createOrchestrator();

    assert.equal(orch.classifyDomain('goal', { intent: 'RESEARCH' }), 'RESEARCH');
    assert.equal(orch.classifyDomain('goal', { intent: 'CONTENT_CREATION' }), 'CONTENT');
    assert.equal(orch.classifyDomain('goal', { intent: 'ARCHITECTURAL_DESIGN' }), 'DESIGN');
  });

  it('should use explicit domain from context', () => {
    const orch = createOrchestrator();
    orch.registerDomain('CUSTOM', {});

    const domain = orch.classifyDomain('goal', { domain: 'CUSTOM' });
    assert.equal(domain, 'CUSTOM');
  });

  it('should validate DAG - no cycles', async () => {
    const orch = createOrchestrator();

    // This should not throw
    await orch.orchestrate('Simple goal');
  });

  it('should detect circular dependencies', () => {
    const orch = createOrchestrator();
    const tasks = [
      { id: 'T1', type: 'A', dependencies: ['T2'] },
      { id: 'T2', type: 'B', dependencies: ['T1'] },
    ];

    assert.throws(() => orch._validateDAG(tasks), /Circular dependency/);
  });

  it('should detect unknown task dependency', () => {
    const orch = createOrchestrator();
    const tasks = [
      { id: 'T1', type: 'A', dependencies: ['T99'] },
    ];

    assert.throws(() => orch._validateDAG(tasks), /unknown task/);
  });

  it('should return registered domains', () => {
    const orch = createOrchestrator();
    orch.registerDomain('DOMAIN_A', {});
    orch.registerDomain('DOMAIN_B', {});

    const domains = orch.getAvailableDomains();
    assert.ok(domains.includes('DOMAIN_A'));
    assert.ok(domains.includes('DOMAIN_B'));
  });

  it('should use LLM for domain detection and planning when available', async () => {
    const llm = new MockLLMClient();
    const orch = createOrchestrator({ llmClient: llm });
    const result = await orch.orchestrate('Test with LLM');

    assert.equal(llm.callCount, 2);
    assert.equal(result.tasks.length, 2);
  });

  it('should fallback to template when LLM fails', async () => {
    const llm = new MockLLMClient();
    llm.shouldFail = true;
    const orch = createOrchestrator({ llmClient: llm });
    const result = await orch.orchestrate('Test fallback');

    assert.ok(result.tasks.length > 0);
    assert.ok(result.tasks[0].type);
  });

  it('should build valid routing for all tasks', async () => {
    const orch = createOrchestrator();
    orch.registerDomain('RESEARCH', {});
    orch.registerDomain('CONTENT', {});

    const result = await orch.orchestrate('riset dan tulis artikel AI');

    for (const task of result.tasks) {
      const domain = result.routing[task.id];
      assert.ok(domain, `No routing for ${task.id}`);
      assert.ok(orch.domainRouter.hasDomain(domain), `Unknown domain ${domain} for ${task.id}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with WorkSession
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: Orchestrator → WorkSession', () => {
  it('should create WorkSession from orchestration result', async () => {
    const { WorkSession } = await import('../src/services/work/WorkSession.js');
    const orch = createOrchestrator();
    const orchestration = await orch.orchestrate('Test goal');

    const session = WorkSession.create(orchestration);
    assert.equal(session.domain, orchestration.domain);
    assert.equal(session.objective, orchestration.objective);
    assert.equal(session.tasks.length, orchestration.tasks.length);
  });

  it('should preserve dependency structure', async () => {
    const { WorkSession } = await import('../src/services/work/WorkSession.js');
    const orch = createOrchestrator();
    const orchestration = await orch.orchestrate('Test goal');

    const session = WorkSession.create(orchestration);

    for (const task of orchestration.tasks) {
      const sessionTask = session.getTask(task.id);
      assert.ok(sessionTask, `Task ${task.id} not found in session`);
      assert.deepEqual(sessionTask.dependencies, task.dependencies);
    }
  });
});
