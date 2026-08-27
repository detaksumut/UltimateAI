/**
 * ReplanEngine.mjs
 * Adaptive failure-aware replanning engine for UltimateAI Agent.
 * Analyzes step failure evidence and generates structured replacement DAG plans.
 * Strictly adheres to Zero Secret Exposure.
 */

import { config } from '../config/env.mjs';

export class ReplanEngine {
  constructor(proxyUrl = null, apiKey = null) {
    this.proxyUrl = proxyUrl || process.env.ROUTER_PROXY_URL || 'http://localhost:20128/v1';
    this.apiKey = apiKey || process.env.ROUTER_API_KEY || config.keys.gemini || '';
  }

  /**
   * Generates an adaptive replacement DAG plan based on failure evidence
   * @param {Object} params - { originalGoal, failedStep, observedFailure, executionHistory, attempt }
   * @returns {Promise<Object>} replanResult - { replacementPlan, strategyAdjustment, explanation }
   */
  async generateReplan({ originalGoal, failedStep, observedFailure, executionHistory = [], attempt = 1 }) {
    const goalId = `replan-${Date.now()}`;
    const rawGoal = originalGoal || '';

    // 1. LLM-Powered Adaptive Replanning
    try {
      const prompt = `You are the Adaptive Replanner for UltimateAI Agent.
Original Goal: "${rawGoal}"
Failed Step: ${JSON.stringify(failedStep)}
Failure Evidence: ${JSON.stringify(observedFailure)}
Attempt: ${attempt}

Generate a revised execution strategy in STRICT JSON format:
{
  "strategyAdjustment": "FALLBACK_TOOL" | "RETRY_WITH_RELAXED_CONSTRAINTS" | "ALTERNATIVE_SPECIALIST" | "DEGRADE_GRACEFULLY",
  "explanation": "Why this alternative approach will succeed",
  "steps": [
    {
      "id": "R1",
      "action": "ACTION_NAME",
      "tool": "tool.name",
      "specialistModel": "gemini-3.5-flash",
      "params": {},
      "dependsOn": [],
      "successCriteria": "criteria",
      "evidenceContract": "contract"
    }
  ]
}`;

      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.proxyUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gemini-3.5-flash',
          messages: [
            { role: 'system', content: 'You are an adaptive self-healing agent replanner.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(3500)
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.steps && parsed.steps.length > 0) {
            return {
              strategyAdjustment: parsed.strategyAdjustment || 'ADAPTIVE_REPLAN',
              explanation: parsed.explanation || 'Constructed alternative DAG plan based on failure evidence.',
              replacementPlan: {
                goalId,
                goal: rawGoal,
                category: 'ADAPTIVE_REPLAN',
                steps: parsed.steps,
                evidenceContract: { requiredArtifactType: 'ADAPTIVE_EXECUTION', minSteps: parsed.steps.length }
              }
            };
          }
        }
      }
    } catch {}

    // 2. Rule-Based Self-Healing Fallback Plan
    const fallbackTool = failedStep?.tool === 'intel.multilayer_search'
      ? 'intel.surface_search'
      : failedStep?.tool === 'media.video_resolver'
      ? 'intel.multilayer_search'
      : 'local_synthesizer';

    const fallbackSteps = [
      {
        id: 'R1',
        action: `RETRY_${failedStep?.action || 'TASK'}`,
        tool: fallbackTool,
        specialistModel: 'gemini-3.5-flash',
        params: failedStep?.params || { query: rawGoal },
        dependsOn: [],
        successCriteria: 'fallback_completed',
        evidenceContract: 'fallback_result'
      }
    ];

    return {
      strategyAdjustment: 'FALLBACK_TOOL',
      explanation: `Switching from ${failedStep?.tool} to ${fallbackTool} after error: ${observedFailure?.reason || 'execution error'}.`,
      replacementPlan: {
        goalId,
        goal: rawGoal,
        category: 'FALLBACK_REPLAN',
        steps: fallbackSteps,
        evidenceContract: { requiredArtifactType: 'FALLBACK_RESULT', minSteps: 1 }
      }
    };
  }
}

export const replanEngineInstance = new ReplanEngine();
export default replanEngineInstance;
