/**
 * RoutingOptimizer.mjs
 * Dynamic Local Routing Optimization & Performance Learning Engine for UltimateAI.
 * 
 * Scores and selects candidate local models based on:
 *  - Task complexity (0.0 - 1.0)
 *  - Reasoning depth required
 *  - Latency fit
 *  - Tool compatibility
 *  - Historical performance telemetry
 */

import fs from 'fs';
import path from 'path';

export const CANDIDATE_ENGINES = [
  { id: 'qwen3:8b', maxReasoning: 0.92, avgLatencyMs: 600, toolSupport: 0.95, costTier: 'ZERO_LOCAL', default: true }
];

export class RoutingOptimizer {
  constructor(telemetryPath = null) {
    this.telemetryPath = telemetryPath || path.resolve(process.cwd(), 'server', 'data', 'routing_performance_history.json');
    this.performanceHistory = new Map();
    this._loadHistory();
  }

  _loadHistory() {
    try {
      if (fs.existsSync(this.telemetryPath)) {
        const raw = fs.readFileSync(this.telemetryPath, 'utf-8');
        const data = JSON.parse(raw);
        for (const [engine, stats] of Object.entries(data)) {
          this.performanceHistory.set(engine, stats);
        }
      }
    } catch (_) {}
  }

  _saveHistory() {
    try {
      const dir = path.dirname(this.telemetryPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const obj = {};
      for (const [engine, stats] of this.performanceHistory.entries()) {
        obj[engine] = stats;
      }
      fs.writeFileSync(this.telemetryPath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (_) {}
  }

  optimizeRoute({
    taskCategory = 'RESEARCH_QUESTION',
    complexity = 0.5,
    requiresCodeExecution = false,
    requiresMultimodal = false,
    requiresLowLatency = false,
    availablePools = ['LOCAL_OLLAMA']
  } = {}) {
    const scoredEngines = CANDIDATE_ENGINES.map(engine => {
      let score = 50.0;

      const reasoningDelta = Math.abs(engine.maxReasoning - complexity);
      score += (1.0 - reasoningDelta) * 30.0;

      if (engine.default) {
        score += 10.0;
      }

      if (requiresLowLatency) {
        score += (1000 - engine.avgLatencyMs) / 50.0;
      }

      const history = this.performanceHistory.get(engine.id);
      if (history && history.totalTasks > 0) {
        const successRate = history.successes / history.totalTasks;
        score += (successRate - 0.5) * 20.0;
      }

      return {
        engine: engine.id,
        score: Math.max(0, score),
        avgLatencyMs: engine.avgLatencyMs,
        toolSupport: engine.toolSupport
      };
    });

    scoredEngines.sort((a, b) => b.score - a.score);
    const selectedEngine = scoredEngines[0] || { engine: 'qwen3:8b', score: 90 };
    const selectedPool = 'LOCAL_OLLAMA';

    return {
      selectedEngine: selectedEngine.engine,
      engineScore: selectedEngine.score,
      selectedPool,
      candidateRanking: scoredEngines,
      selectionRationale: `Selected ${selectedEngine.engine} (Score: ${selectedEngine.score.toFixed(1)}) for category ${taskCategory} on ${selectedPool}`
    };
  }

  recordTaskOutcome({ engine, taskCategory = 'GENERAL', latencyMs = 500, success = true, verified = true }) {
    if (!engine) return;

    const current = this.performanceHistory.get(engine) || {
      totalTasks: 0,
      successes: 0,
      failures: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 500,
      verifiedCount: 0
    };

    current.totalTasks++;
    if (success) current.successes++;
    else current.failures++;

    if (verified) current.verifiedCount++;

    current.totalLatencyMs += latencyMs;
    current.avgLatencyMs = Math.round(current.totalLatencyMs / current.totalTasks);

    this.performanceHistory.set(engine, current);
    this._saveHistory();

    return current;
  }

  getPerformanceStats() {
    const stats = {};
    for (const [engine, data] of this.performanceHistory.entries()) {
      stats[engine] = {
        ...data,
        successRate: data.totalTasks > 0 ? (data.successes / data.totalTasks).toFixed(2) : '1.00'
      };
    }
    return stats;
  }
}

export const routingOptimizerInstance = new RoutingOptimizer();
export default routingOptimizerInstance;
