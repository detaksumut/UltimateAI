/**
 * AgentPlanner.mjs
 * Dynamic LLM-driven DAG Planner for JIN AI Agent.
 *
 * ARCHITECTURE RULE:
 * - Hardcoded workflow templates per intent are FORBIDDEN.
 * - The planner reads the semantic goal, available tools, context, and constraints,
 *   then asks the LLM to construct the execution plan as a DAG.
 * - Tool selection emerges from reasoning, not from if/switch blocks.
 * - The only structural fallback is a single-step web.search when LLM is offline.
 */

import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';

const PLANNER_PROXY_URL = process.env.ROUTER_PROXY_URL || 'http://127.0.0.1:20200/v1';

const AVAILABLE_TOOLS_MANIFEST = [
  { id: 'web.fetch', description: 'Fetch and extract structured text, DOM, links, and metadata from live URLs using isolated browser execution' },
  { id: 'web.search', description: 'Real-time web search for current events, news, and external information' },
  { id: 'sandbox.execute', description: 'Execute safe, isolated computational code, transformations, or calculations in a constrained sandbox' },
  { id: 'threat.feed', description: 'Fetch, normalize, and score structured threat intelligence feeds and cybersecurity indicators' },
  { id: 'doc.analyze', description: 'Analyze and extract insight from user-provided document text' },
  { id: 'data.matrix_generator', description: 'Build structured data matrices, comparisons, and analytics' },
  { id: 'memory.vault', description: 'Store or retrieve user-specified facts and long-term context' },
  { id: 'intel.multilayer_search', description: 'Multi-layer intelligence search across surface and deep web' },
  { id: 'media.video_resolver', description: 'Resolve and play video or audio media content' },
  { id: 'spec.blueprint_architect', description: 'Design software specifications and architecture' },
  { id: 'code.synthesizer', description: 'Generate code artifacts from specifications' },
  { id: 'ui.render_app_sandbox', description: 'Render and preview a UI or application in sandbox' }
];

export class AgentPlanner {
  /**
   * Constructs a dynamic execution DAG plan from semantic goal and context.
   * Attempts LLM-generated plan first; uses minimal structural fallback only offline.
   *
   * @param {string} goal - User's raw utterance
   * @param {Object} context - { semanticDecision, documentText, constraints, activeTask, recentTurns, ... }
   * @returns {Object} plan - { goalId, goal, category, steps, evidenceContract }
   */
  static async planGoal(goal, context = {}) {
    const raw = goal || '';
    const semantic = context.semanticDecision || {
      intent: 'RESEARCH_QUESTION',
      goal: raw,
      entities: [],
      toolsNeeded: ['web.search'],
      constraints: [],
      toolReason: 'No semantic decision provided.',
      freshDataRequired: false,
      isCorrecting: false,
      isContinuing: false
    };

    const goalId = `goal-${Date.now()}`;

    // 1. CASUAL CHAT — Always direct LLM response, no tools
    if (semantic.intent === 'CASUAL_CHAT' || semantic.intent === 'CONVERSATION') {
      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'CONVERSATION',
        steps: [{
          id: 'S1',
          action: 'CONVERSATIONAL_REASONING',
          tool: null,
          specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
          params: { userUtterance: semantic.goal || raw },
          dependsOn: [],
          successCriteria: 'coherent_response_synthesized',
          evidenceContract: 'natural_dialogue'
        }],
        evidenceContract: { requiredArtifactType: 'CONVERSATION', minSteps: 1 }
      };
    }

    // 2. CONSTRAINT UPDATE — Acknowledge and update state only
    if (semantic.intent === 'CONSTRAINT_UPDATE') {
      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'CONSTRAINT_UPDATE',
        steps: [{
          id: 'S1',
          action: 'ACKNOWLEDGE_CONSTRAINT',
          tool: null,
          specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
          params: { constraint: raw, constraints: semantic.constraints || [] },
          dependsOn: [],
          successCriteria: 'constraint_acknowledged',
          evidenceContract: 'constraint_record'
        }],
        evidenceContract: { requiredArtifactType: 'CONVERSATION', minSteps: 1 }
      };
    }

    // 3. NEEDSCLARIFICATION — Ask the user for missing information
    if (semantic.needsClarification && semantic.clarificationQuestion) {
      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'CLARIFICATION',
        steps: [{
          id: 'S1',
          action: 'ASK_CLARIFICATION',
          tool: null,
          specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
          params: {
            question: semantic.clarificationQuestion,
            reason: semantic.reason
          },
          dependsOn: [],
          successCriteria: 'clarification_question_delivered',
          evidenceContract: 'clarification_request'
        }],
        evidenceContract: { requiredArtifactType: 'CONVERSATION', minSteps: 1 }
      };
    }

    // 4. LLM-DRIVEN DYNAMIC PLAN GENERATION
    try {
      const plan = await AgentPlanner._generateLLMPlan(goalId, raw, semantic, context);
      if (plan && plan.steps && plan.steps.length > 0) {
        return plan;
      }
    } catch (err) {
      // LLM plan generation failed — fall through to structural fallback
      console.warn('[AgentPlanner] LLM plan generation failed, using structural fallback:', err.message);
    }

    // 5. STRUCTURAL FALLBACK — Minimal offline-safe plan based on semantic decision
    return AgentPlanner._structuralFallbackPlan(goalId, raw, semantic, context);
  }

  /**
   * Asks the LLM to generate the actual execution DAG plan.
   */
  static async _generateLLMPlan(goalId, raw, semantic, context) {
    const systemPrompt = `You are the Execution Planner for JIN AI Agent.
Given the user's goal and semantic analysis, create a minimal, efficient execution plan as a DAG.

RULES:
1. Only include steps that are strictly necessary to achieve the goal.
2. Use ONLY tools from the available tools manifest.
3. Respect all active constraints (e.g., "no internet search", "use document only").
4. Each step must have a clear reason for being included.
5. Steps can depend on previous steps; use dependsOn to express this.
6. If the goal can be answered from conversation context alone, produce zero tool steps.
7. Do NOT add steps just because they "might be useful".

Available tools:
${AVAILABLE_TOOLS_MANIFEST.map(t => `- ${t.id}: ${t.description}`).join('\n')}

Output STRICT valid JSON:
{
  "category": "<category_name>",
  "planReason": "<why this plan serves the goal>",
  "steps": [
    {
      "id": "S1",
      "action": "<ACTION_NAME>",
      "tool": "<tool_id or null>",
      "params": { "<key>": "<value>" },
      "dependsOn": [],
      "successCriteria": "<what makes this step successful>",
      "reason": "<why this step is needed>"
    }
  ],
  "evidenceContract": {
    "requiredArtifactType": "<type>",
    "minSteps": <number>
  }
}`;

    const userMessage = `USER GOAL: "${raw}"

SEMANTIC ANALYSIS:
${JSON.stringify(semantic, null, 2)}

ACTIVE CONSTRAINTS: ${(semantic.constraints || []).join(', ') || 'None'}

DOCUMENT AVAILABLE: ${context.documentText ? 'Yes' : 'No'}

ACTIVE TASK STATE: ${context.activeTask ? JSON.stringify(context.activeTask) : 'None'}

Build the minimal execution DAG plan.`;

    const response = await fetch(`${PLANNER_PROXY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0] || 'gemini-3.6-flash-high',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.05,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) throw new Error(`Planner LLM returned ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const cleaned = content.replace(/^```json\s*|^```\s*|```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error('Planner LLM returned invalid steps');

    // Attach specialist model to each step
    const defaultModel = JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0];
    parsed.steps = parsed.steps.map(step => ({
      ...step,
      specialistModel: step.specialistModel || defaultModel
    }));

    return {
      goalId,
      goal: semantic.goal || raw,
      category: parsed.category || 'DYNAMIC_TASK',
      planReason: parsed.planReason || '',
      steps: parsed.steps,
      evidenceContract: parsed.evidenceContract || { requiredArtifactType: 'RESULT', minSteps: 1 }
    };
  }

  /**
   * Structural fallback: uses the toolsNeeded from semantic decision.
   * Does NOT hardcode tool chains per intent string.
   */
  static _structuralFallbackPlan(goalId, raw, semantic, context) {
    const toolsNeeded = semantic.toolsNeeded || ['web.search'];
    const constraints = semantic.constraints || [];
    const defaultModel = JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0];

    // Respect user constraint: no internet search
    const noInternet = constraints.some(c => /jangan.*internet|tidak.*internet|hanya.*dokumen/i.test(c));

    const steps = [];
    let prevId = null;

    for (let i = 0; i < toolsNeeded.length; i++) {
      const tool = toolsNeeded[i];

      // Skip internet tools if constraint says no internet
      if (noInternet && (tool === 'web.search' || tool === 'intel.multilayer_search')) {
        continue;
      }

      const stepId = `S${i + 1}`;
      const step = {
        id: stepId,
        action: `EXECUTE_${tool.toUpperCase().replace(/\./g, '_')}`,
        tool,
        specialistModel: defaultModel,
        params: {
          query: semantic.goal || raw,
          userUtterance: raw,
          documentText: context.documentText || null
        },
        dependsOn: prevId ? [prevId] : [],
        successCriteria: `${tool}_result_available`,
        evidenceContract: `${tool}_evidence`
      };

      steps.push(step);
      prevId = stepId;
    }

    // If all steps were blocked by constraints, use direct reasoning
    if (steps.length === 0) {
      steps.push({
        id: 'S1',
        action: 'REASON_FROM_CONTEXT',
        tool: null,
        specialistModel: defaultModel,
        params: { userUtterance: raw, constraints, activeTask: context.activeTask },
        dependsOn: [],
        successCriteria: 'contextual_response_generated',
        evidenceContract: 'reasoning_only'
      });
    }

    return {
      goalId,
      goal: semantic.goal || raw,
      category: semantic.intent || 'RESEARCH_QUESTION',
      planReason: `Structural fallback plan based on semantic decision (LLM planner unavailable). Tools: ${toolsNeeded.join(', ')}`,
      steps,
      evidenceContract: {
        requiredArtifactType: 'RESULT',
        minSteps: 1
      }
    };
  }
}

export default AgentPlanner;
