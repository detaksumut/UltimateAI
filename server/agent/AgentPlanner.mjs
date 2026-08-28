/**
 * AgentPlanner.mjs
 * Pillar 3: Hierarchical Dynamic DAG Planner for JIN AI Agent.
 * 
 * Flow:
 *  GOAL ➔ OBJECTIVES ➔ SUBGOALS ➔ TASKS ➔ ACTIONS ➔ RESULTS ➔ VERIFICATION ➔ NEXT ACTION
 * 
 * Rules:
 *  - Decomposes high-level goals into sequential/parallel dependency DAGs.
 *  - Integrates Dynamic 9-Engine RoutingOptimizer for specialist model and pool selection.
 *  - Enforces operator constraints (e.g., NO_INTERNET_ACCESS, SAFE_SANDBOX).
 *  - Zero hardcoded task templates.
 */

import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';
import { routingOptimizerInstance } from '../routing/RoutingOptimizer.mjs';

const PLANNER_PROXY_URL = process.env.ROUTER_PROXY_URL || 'http://127.0.0.1:20200/v1';

const AVAILABLE_TOOLS_MANIFEST = [
  { id: 'web.fetch', description: 'Fetch and extract structured text, DOM, links, and metadata from live URLs using isolated browser execution' },
  { id: 'web.search', description: 'Real-time web search for current events, news, and external information' },
  { id: 'sandbox.execute', description: 'Execute safe, isolated computational code, transformations, or calculations in Node.js, Python, or PowerShell' },
  { id: 'threat.feed', description: 'Fetch, normalize, and score structured threat intelligence feeds and cybersecurity indicators' },
  { id: 'doc.analyze', description: 'Analyze and extract insight from user-provided document text' },
  { id: 'data.matrix_generator', description: 'Build structured data matrices, comparisons, and analytics' },
  { id: 'memory.vault', description: 'Store or retrieve user-specified facts and long-term context on Drive F:' },
  { id: 'intel.multilayer_search', description: 'Multi-layer intelligence search across surface and deep web' },
  { id: 'media.video_resolver', description: 'Resolve and play video or audio media content' },
  { id: 'spec.blueprint_architect', description: 'Design software specifications and architecture' },
  { id: 'code.synthesizer', description: 'Generate code artifacts from specifications' },
  { id: 'ui.render_app_sandbox', description: 'Render and preview a UI or application in sandbox' }
];

export class AgentPlanner {
  /**
   * Constructs a hierarchical dynamic execution DAG plan from semantic goal and context.
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

    // Optimize engine & pool routing dynamically
    const route = routingOptimizerInstance.optimizeRoute({
      taskCategory: semantic.intent,
      complexity: semantic.toolsNeeded?.length > 1 ? 0.8 : 0.4,
      requiresCodeExecution: semantic.toolsNeeded?.includes('sandbox.execute')
    });

    // 1. CASUAL CHAT — Always direct LLM response, no tools
    if (semantic.intent === 'CASUAL_CHAT' || semantic.intent === 'CONVERSATION') {
      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'CONVERSATION',
        hierarchicalObjectives: ['Greet user', 'Provide conversational answer'],
        selectedEngine: route.selectedEngine,
        selectedPool: route.selectedPool,
        steps: [{
          id: 'S1',
          subgoal: 'Direct conversational reasoning',
          action: 'CONVERSATIONAL_REASONING',
          tool: null,
          specialistModel: route.selectedEngine,
          pool: route.selectedPool,
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
        hierarchicalObjectives: ['Acknowledge constraint', 'Update active task state'],
        selectedEngine: route.selectedEngine,
        selectedPool: route.selectedPool,
        steps: [{
          id: 'S1',
          subgoal: 'Acknowledge behavioral constraint',
          action: 'ACKNOWLEDGE_CONSTRAINT',
          tool: null,
          specialistModel: route.selectedEngine,
          pool: route.selectedPool,
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
        hierarchicalObjectives: ['Request clarification on missing parameters'],
        selectedEngine: route.selectedEngine,
        selectedPool: route.selectedPool,
        steps: [{
          id: 'S1',
          subgoal: 'Formulate clarifying question',
          action: 'ASK_CLARIFICATION',
          tool: null,
          specialistModel: route.selectedEngine,
          pool: route.selectedPool,
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
      const plan = await AgentPlanner._generateLLMPlan(goalId, raw, semantic, context, route);
      if (plan && plan.steps && plan.steps.length > 0) {
        return plan;
      }
    } catch (err) {
      // Fallback
    }

    // 5. STRUCTURAL FALLBACK PLAN
    return AgentPlanner._structuralFallbackPlan(goalId, raw, semantic, context, route);
  }

  static async _generateLLMPlan(goalId, raw, semantic, context, route) {
    const systemPrompt = `You are the Hierarchical Execution Planner for JIN AI Agent.
Decompose the user's goal into a structured hierarchical plan:
GOAL ➔ OBJECTIVES ➔ SUBGOALS ➔ TASKS ➔ ACTIONS.

RULES:
1. Only include steps that are strictly necessary to achieve the goal.
2. Use ONLY tools from the available tools manifest.
3. Respect all active constraints (e.g., "no internet search", "no code execution").
4. Express dependencies clearly using dependsOn array.
5. If the goal requires calculations or data transformation, include sandbox.execute with runtime (node/python/powershell).

Available tools:
${AVAILABLE_TOOLS_MANIFEST.map(t => `- ${t.id}: ${t.description}`).join('\n')}

Output STRICT valid JSON:
{
  "category": "<category_name>",
  "hierarchicalObjectives": ["<high-level objective 1>", "<high-level objective 2>"],
  "planReason": "<why this plan serves the goal>",
  "steps": [
    {
      "id": "S1",
      "subgoal": "<subgoal description>",
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

Build the minimal hierarchical execution DAG plan.`;

    const response = await fetch(`${PLANNER_PROXY_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: route.selectedEngine || 'gemini-3.6-flash-high',
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

    parsed.steps = parsed.steps.map(step => ({
      ...step,
      specialistModel: step.specialistModel || route.selectedEngine,
      pool: step.pool || route.selectedPool
    }));

    return {
      goalId,
      goal: semantic.goal || raw,
      category: parsed.category || 'DYNAMIC_HIERARCHICAL_TASK',
      hierarchicalObjectives: parsed.hierarchicalObjectives || [raw],
      selectedEngine: route.selectedEngine,
      selectedPool: route.selectedPool,
      planReason: parsed.planReason || '',
      steps: parsed.steps,
      evidenceContract: parsed.evidenceContract || { requiredArtifactType: 'RESULT', minSteps: 1 }
    };
  }

  static _structuralFallbackPlan(goalId, raw, semantic, context, route) {
    const toolsNeeded = semantic.toolsNeeded || ['web.search'];
    const constraints = semantic.constraints || [];
    const defaultModel = route.selectedEngine || 'gemini-3.6-flash-high';
    const selectedPool = route.selectedPool || 'POOL_1';

    const noInternet = constraints.some(c => /jangan.*internet|tidak.*internet|hanya.*dokumen/i.test(c));
    const steps = [];
    let prevId = null;

    for (let i = 0; i < toolsNeeded.length; i++) {
      const tool = toolsNeeded[i];
      if (noInternet && (tool === 'web.search' || tool === 'intel.multilayer_search' || tool === 'web.fetch')) {
        continue;
      }

      const stepId = `S${i + 1}`;
      const step = {
        id: stepId,
        subgoal: `Execute ${tool}`,
        action: `EXECUTE_${tool.toUpperCase().replace(/\./g, '_')}`,
        tool,
        specialistModel: defaultModel,
        pool: selectedPool,
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

    if (steps.length === 0) {
      steps.push({
        id: 'S1',
        subgoal: 'Reason from local memory context',
        action: 'REASON_FROM_CONTEXT',
        tool: null,
        specialistModel: defaultModel,
        pool: selectedPool,
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
      hierarchicalObjectives: [`Process instruction: ${raw}`],
      selectedEngine: defaultModel,
      selectedPool,
      planReason: `Hierarchical structural plan based on semantic decision. Tools: ${toolsNeeded.join(', ')}`,
      steps,
      evidenceContract: {
        requiredArtifactType: 'RESULT',
        minSteps: 1
      }
    };
  }
}

export default AgentPlanner;
