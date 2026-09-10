/**
 * test_data_domain.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * FASE 5 — Data Domain Service Test Suite
 *
 * Tests:
 *   DataService: collect, transform, visualize
 *   SVG Chart Generation: bar, line, pie
 *   Integration: DataService → WorkExecutor → WorkSession
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DataService } from '../src/services/work/domains/DataService.js';
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
    return '{"dataPoints":[{"label":"A","value":10},{"label":"B","value":20}]}';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST: DataService Core
// ═══════════════════════════════════════════════════════════════════════

describe('DataService', () => {
  it('should create with default options', () => {
    const service = new DataService();
    assert.ok(service);
    assert.equal(service.chartWidth, 600);
  });

  it('should create with custom options', () => {
    const service = new DataService({ chartWidth: 800, chartHeight: 500 });
    assert.equal(service.chartWidth, 800);
    assert.equal(service.chartHeight, 500);
  });

  it('should handle COLLECT task without LLM', async () => {
    const service = new DataService({ llmClient: null });
    const task = { id: 'T1', type: 'COLLECT', description: 'Collect AI data' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'JSON');
    const data = JSON.parse(result.content);
    assert.ok(data.dataPoints.length > 0);
    assert.equal(result.metadata.phase, 'COLLECT');
  });

  it('should handle COLLECT task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new DataService({ llmClient: llm });
    const task = { id: 'T1', type: 'COLLECT', description: 'Collect data' };
    const context = { session: { artifacts: [] } };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.metadata.model, 'qwen3:8b');
  });

  it('should handle TRANSFORM task without LLM', async () => {
    const service = new DataService({ llmClient: null });
    const task = { id: 'T2', type: 'TRANSFORM', description: 'Transform' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '{"dataPoints":[{"label":"A","value":10}]}' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'JSON');
    assert.equal(result.metadata.phase, 'TRANSFORM');
  });

  it('should handle TRANSFORM task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new DataService({ llmClient: llm });
    const task = { id: 'T2', type: 'TRANSFORM', description: 'Transform' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: 'Raw data' }],
        tasks: [{ id: 'T1' }, { id: 'T2' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
  });

  it('should handle VISUALIZE task without LLM', async () => {
    const service = new DataService({ llmClient: null });
    const task = { id: 'T3', type: 'VISUALIZE', description: 'Create bar chart' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '{"dataPoints":[{"label":"A","value":10},{"label":"B","value":20}]}' }],
        tasks: [{ id: 'T1' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(result.type, 'SVG_VECTOR');
    assert.ok(result.content.includes('<svg'));
    assert.equal(result.metadata.chartType, 'bar');
  });

  it('should handle VISUALIZE task with LLM', async () => {
    const llm = new MockLLMClient();
    const service = new DataService({ llmClient: llm });
    const task = { id: 'T3', type: 'VISUALIZE', description: 'Create chart' };
    const context = {
      session: {
        artifacts: [{ taskId: 'T1', content: '{"dataPoints":[]}' }],
        tasks: [{ id: 'T1' }, { id: 'T3' }],
      },
    };

    const result = await service.generate(task, context);

    assert.equal(llm.callCount, 1);
    assert.equal(result.type, 'SVG_VECTOR');
  });

  it('should verify valid artifact', async () => {
    const service = new DataService();
    const result = await service.verify({ content: 'Valid content' });
    assert.ok(result.valid);
  });

  it('should reject empty artifact', async () => {
    const service = new DataService();
    const result = await service.verify({ content: '' });
    assert.ok(!result.valid);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: SVG Chart Generation
// ═══════════════════════════════════════════════════════════════════════

describe('SVG Chart Generation', () => {
  it('should generate bar chart', () => {
    const service = new DataService();
    const data = { dataPoints: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }] };

    const svg = service._barChart(data.dataPoints, 'Test');

    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('<rect'));
    assert.ok(svg.includes('Test'));
    assert.ok(svg.includes('</svg>'));
  });

  it('should generate line chart', () => {
    const service = new DataService();
    const data = { dataPoints: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }] };

    const svg = service._lineChart(data.dataPoints, 'Line Test');

    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('<path'));
    assert.ok(svg.includes('<circle'));
  });

  it('should generate pie chart', () => {
    const service = new DataService();
    const data = { dataPoints: [{ label: 'A', value: 30 }, { label: 'B', value: 70 }] };

    const svg = service._pieChart(data.dataPoints, 'Pie Test');

    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('<path'));
    assert.ok(svg.includes('30%'));
    assert.ok(svg.includes('70%'));
  });

  it('should handle empty data', () => {
    const service = new DataService();
    const svg = service._emptyChart();

    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('Tidak ada data'));
  });

  it('should detect chart type from task description', () => {
    const service = new DataService();

    assert.equal(service._detectChartType({ description: 'create pie chart' }, {}), 'pie');
    assert.equal(service._detectChartType({ description: 'line graph' }, {}), 'line');
    assert.equal(service._detectChartType({ description: 'bar chart' }, {}), 'bar');
    assert.equal(service._detectChartType({ description: 'grafik' }, {}), 'bar');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Integration with WorkExecutor
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: DataService → WorkExecutor', () => {
  it('should execute DATA tasks through WorkExecutor', async () => {
    const service = new DataService({ llmClient: null });

    const session = new WorkSession({ domain: 'DATA', objective: 'Analyze sales data' });
    session.addTask({ id: 'T1', type: 'COLLECT', description: 'Collect data' });
    session.addTask({ id: 'T2', type: 'TRANSFORM', description: 'Transform', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'VISUALIZE', description: 'Visualize bar chart', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('DATA', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.completedTasks, 3);
  });

  it('should chain COLLECT → TRANSFORM → VISUALIZE', async () => {
    const service = new DataService({ llmClient: null });

    const session = new WorkSession({ domain: 'DATA', objective: 'Sales analysis' });
    session.addTask({ id: 'T1', type: 'COLLECT', description: 'Collect sales' });
    session.addTask({ id: 'T2', type: 'TRANSFORM', description: 'Clean', dependencies: ['T1'] });
    session.addTask({ id: 'T3', type: 'VISUALIZE', description: 'Pie chart', dependencies: ['T2'] });

    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id);
    const executor = new WorkExecutor(session, { artifactStream, canvas });
    executor.registerDomain('DATA', service);

    const result = await executor.execute();

    assert.equal(result.status, 'COMPLETED');
    const vizArtifact = artifactStream.getByTaskId('T3');
    assert.equal(vizArtifact.type, 'SVG_VECTOR');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST: Domain Registration
// ═══════════════════════════════════════════════════════════════════════

describe('Domain Registration', () => {
  it('should register DataService on DomainRouter', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new DataService();
    router.register('DATA', service);

    assert.ok(router.hasDomain('DATA'));
    assert.equal(router.getDomain('DATA'), service);
  });

  it('should route data tasks to DataService', async () => {
    const { DomainRouter } = await import('../src/services/work/DomainRouter.js');
    const router = new DomainRouter();
    const service = new DataService();
    router.register('DATA', service);

    const domain = router.route({ id: 'T1', type: 'COLLECT' }, 'analisis data', null);
    assert.equal(domain, 'DATA');
  });
});

