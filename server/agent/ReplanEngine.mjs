/**
 * ReplanEngine.mjs
 * Adaptive failure-aware replanning engine for UltimateAI Agent.
 * Analyzes step failure evidence and generates alternative execution strategies.
 */

export class ReplanEngine {
  constructor(proxyUrl = 'http://localhost:20128/v1', apiKey = 'sk-25619842026f00d') {
    this.proxyUrl = proxyUrl;
    this.apiKey = apiKey;
  }

  /**
   * Generates an adaptive replan based on failure evidence
   * @param {Object} params - { originalGoal, failedStep, observedFailure, executionHistory, attempt }
   * @returns {Promise<Object>} replanStrategy - { newSteps, strategyAdjustment, explanation }
   */
  async generateReplan({ originalGoal, failedStep, observedFailure, executionHistory = [], attempt = 1 }) {
    // 1. LLM-Powered Adaptive Replanning
    try {
      const prompt = `You are the Adaptive Replanner for UltimateAI Agent.
Original Goal: "${originalGoal}"
Failed Step: ${JSON.stringify(failedStep)}
Failure Evidence: ${JSON.stringify(observedFailure)}
Attempt: ${attempt}

Generate a revised execution strategy in STRICT JSON format:
{
  "strategyAdjustment": "FALLBACK_TOOL" | "RETRY_WITH_RELAXED_CONSTRAINTS" | "ALTERNATIVE_SPECIALIST" | "DEGRADE_GRACEFULLY",
  "explanation": "Why this alternative approach will succeed",
  "replacementSteps": [
    {
      "id": "R1",
      "action": "ACTION_NAME",
      "tool": "tool.name",
      "specialistModel": "gemini-3.5-flash",
      "params": {},
      "dependsOn": [],
      "successCriteria": "criteria"
    }
  ]
}`;

      const response = await fetch(`${this.proxyUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
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
          return JSON.parse(content);
        }
      }
    } catch {}

    // 2. Rule-Based Self-Healing Fallback
    const fallbackTool = failedStep?.tool === 'intel.multilayer_search'
      ? 'intel.surface_search'
      : failedStep?.tool === 'media.video_resolver'
      ? 'intel.multilayer_search'
      : 'local_synthesizer';

    return {
      strategyAdjustment: 'FALLBACK_TOOL',
      explanation: `Switching from ${failedStep?.tool} to ${fallbackTool} after error: ${observedFailure?.error || 'timeout'}.`,
      replacementSteps: [
        {
          id: `R-${Date.now()}`,
          action: `RETRY_${failedStep?.action || 'TASK'}`,
          tool: fallbackTool,
          specialistModel: 'gemini-3.5-flash',
          params: failedStep?.params || { query: originalGoal },
          dependsOn: [],
          successCriteria: 'fallback_completed'
        }
      ]
    };
  }
}

export const replanEngineInstance = new ReplanEngine();
export default replanEngineInstance;
