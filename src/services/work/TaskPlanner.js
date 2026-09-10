/**
 * TaskPlanner.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — LLM-Powered Task Planner
 *
 * Uses LLM to break down objectives into executable task DAGs.
 * Input: objective + domain
 * Output: ordered tasks with dependency graph
 *
 * Fallback: if LLM unavailable, returns predefined task templates per domain
 * ═══════════════════════════════════════════════════════════════════════
 */

const DOMAIN_TASK_TEMPLATES = {
  RESEARCH: [
    { id: 'T1', type: 'SEARCH', description: 'Search and gather information', dependencies: [] },
    { id: 'T2', type: 'ANALYZE', description: 'Analyze gathered data', dependencies: ['T1'] },
    { id: 'T3', type: 'SYNTHESIZE', description: 'Synthesize findings into response', dependencies: ['T2'] },
  ],
  DOCUMENT: [
    { id: 'T1', type: 'PARSE', description: 'Parse input document', dependencies: [] },
    { id: 'T2', type: 'PROCESS', description: 'Process document content', dependencies: ['T1'] },
    { id: 'T3', type: 'OUTPUT', description: 'Generate output document', dependencies: ['T2'] },
  ],
  CONTENT: [
    { id: 'T1', type: 'OUTLINE', description: 'Create content outline', dependencies: [] },
    { id: 'T2', type: 'DRAFT', description: 'Draft content', dependencies: ['T1'] },
    { id: 'T3', type: 'REFINE', description: 'Refine and finalize', dependencies: ['T2'] },
  ],
  DATA: [
    { id: 'T1', type: 'COLLECT', description: 'Collect data sources', dependencies: [] },
    { id: 'T2', type: 'TRANSFORM', description: 'Transform and clean data', dependencies: ['T1'] },
    { id: 'T3', type: 'VISUALIZE', description: 'Create visualizations', dependencies: ['T2'] },
  ],
  CREATIVE: [
    { id: 'T1', type: 'CONCEPTUALIZE', description: 'Generate creative concepts', dependencies: [] },
    { id: 'T2', type: 'CREATE', description: 'Create creative assets', dependencies: ['T1'] },
    { id: 'T3', type: 'REVIEW', description: 'Review and polish', dependencies: ['T2'] },
  ],
  DESIGN: [
    { id: 'T1', type: 'ANALYZE', description: 'Analyze design requirements', dependencies: [] },
    { id: 'T2', type: 'GENERATE', description: 'Generate design output', dependencies: ['T1'] },
    { id: 'T3', type: 'VALIDATE', description: 'Validate design', dependencies: ['T2'] },
  ],
  AUTOMATION: [
    { id: 'T1', type: 'MAP', description: 'Map automation workflow', dependencies: [] },
    { id: 'T2', type: 'BUILD', description: 'Build automation steps', dependencies: ['T1'] },
    { id: 'T3', type: 'TEST', description: 'Test automation', dependencies: ['T2'] },
  ],
  GENERAL: [
    { id: 'T1', type: 'ANALYZE', description: 'Analyze objective', dependencies: [] },
    { id: 'T2', type: 'EXECUTE', description: 'Execute core work', dependencies: ['T1'] },
    { id: 'T3', type: 'SUMMARIZE', description: 'Summarize results', dependencies: ['T2'] },
  ],
};

class TaskPlanner {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.model = options.model || 'qwen3:8b';
    this.temperature = options.temperature || 0.3;
  }

  /**
   * Plan tasks for an objective
   * Returns: { domain, objective, tasks: [{ id, type, description, dependencies }] }
   */
  async plan(goal, domain) {
    if (this.llmClient) {
      try {
        return await this._planWithLLM(goal, domain);
      } catch (err) {
        console.warn(`[TaskPlanner] LLM planning failed, using template: ${err.message}`);
      }
    }

    return this._planWithTemplate(goal, domain);
  }

  /**
   * Use LLM to plan task breakdown
   */
  async _planWithLLM(goal, domain) {
    const systemPrompt = `You are a task planner. Break down the user's objective into executable tasks.
Return ONLY valid JSON, no markdown.
Format: { "tasks": [{ "id": "T1", "type": "string", "description": "string", "dependencies": ["T0"] }] }
Rules:
- First task (T1) has empty dependencies []
- Each subsequent task depends on at most 2 previous tasks
- Use descriptive type names like: SEARCH, ANALYZE, DRAFT, CREATE, VALIDATE
- Keep descriptions concise (under 50 words)
- Aim for 2-5 tasks total`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Domain: ${domain}\nObjective: ${goal}\n\nPlan the tasks:` },
    ];

    const response = await this.llmClient.sendChat({
      messages,
      model: this.model,
      temperature: this.temperature,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';
    return this._parseLLMResponse(text, goal, domain);
  }

  /**
   * Parse LLM response into task list
   */
  _parseLLMResponse(text, goal, domain) {
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const tasks = parsed.tasks.map((t, i) => ({
          id: t.id || `T${i + 1}`,
          type: t.type || 'EXECUTE',
          description: t.description || `Task ${i + 1}`,
          dependencies: t.dependencies || [],
        }));

        return { domain, objective: goal, tasks };
      }
    } catch (e) {
      console.warn(`[TaskPlanner] Failed to parse LLM response: ${e.message}`);
    }

    return this._planWithTemplate(goal, domain);
  }

  /**
   * Use predefined template for task planning
   */
  _planWithTemplate(goal, domain) {
    const template = DOMAIN_TASK_TEMPLATES[domain] || DOMAIN_TASK_TEMPLATES.GENERAL;
    const tasks = template.map(t => ({
      ...t,
      description: `${t.description} for: ${goal}`,
    }));

    return { domain, objective: goal, tasks };
  }
}

export { TaskPlanner, DOMAIN_TASK_TEMPLATES };
export default TaskPlanner;
