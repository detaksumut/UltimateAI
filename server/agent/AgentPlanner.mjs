/**
 * AgentPlanner.mjs
 * True Semantic DAG Execution Graph Planner for JIN AI Agent.
 * Constructs execution plans driven by semantic intent, capability resolution, and evidence contracts.
 */

import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';

export class AgentPlanner {
  /**
   * Constructs an execution graph driven purely by semantic intent & constraints
   * @param {string} goal - High-level user goal
   * @param {Object} context - Semantic decision, entities, constraints, memory
   * @returns {Object} plan - { goalId, goal, category, steps, evidenceContract }
   */
  static planGoal(goal, context = {}) {
    const raw = goal || '';
    const semantic = context.semanticDecision || {
      intent: 'RESEARCH_QUESTION',
      goal: raw,
      entities: [raw],
      toolsNeeded: ['web.search']
    };

    const goalId = `goal-${Date.now()}`;
    const intent = semantic.intent || 'RESEARCH_QUESTION';
    const graph = [];

    // 1. CONVERSATION / CASUAL CHAT (Direct LLM reasoning, no external tools)
    if (intent === 'CASUAL_CHAT' || intent === 'CONVERSATION') {
      graph.push({
        id: 'S1',
        action: 'CONVERSATIONAL_REASONING',
        tool: null,
        specialistModel: 'gemini-3.6-flash-high',
        params: { userUtterance: semantic.goal || raw },
        dependsOn: [],
        successCriteria: 'coherent_response_synthesized',
        evidenceContract: 'natural_dialogue'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'CONVERSATION',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'CONVERSATION', minSteps: 1 }
      };
    }

    // 2. DOCUMENT ANALYSIS (doc.analyze)
    if (intent === 'DOCUMENT_ANALYSIS') {
      graph.push({
        id: 'S1',
        action: 'EXTRACT_DOCUMENT_INTELLIGENCE',
        tool: 'doc.analyze',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: {
          documentText: context.documentText || semantic.documentText || raw,
          query: semantic.query || raw,
          fileName: context.fileName || 'analysis_document.txt',
          maxChunks: 5
        },
        dependsOn: [],
        successCriteria: 'document_chunks_ranked',
        evidenceContract: 'semantic_chunks'
      });

      graph.push({
        id: 'S2',
        action: 'SYNTHESIZE_DOCUMENT_INSIGHTS',
        tool: 'data.matrix_generator',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { targetMode: 'INSIGHTS' },
        dependsOn: ['S1'],
        successCriteria: 'insights_matrix_synthesized',
        evidenceContract: 'data_matrix_artifact'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'DOCUMENT_ANALYSIS',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'DATA_MODEL', minSteps: 2 }
      };
    }

    // 3. WEB SEARCH & INTELLIGENCE (web.search)
    if (intent === 'WEB_SEARCH' || intent === 'RESEARCH_QUESTION') {
      graph.push({
        id: 'S1',
        action: 'EXECUTE_WEB_SEARCH',
        tool: 'web.search',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: semantic.query || semantic.goal || raw, maxResults: 5 },
        dependsOn: [],
        successCriteria: 'sources_retrieved',
        evidenceContract: 'verified_web_sources'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'WEB_SEARCH',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'SEARCH_RESULTS', minSteps: 1 }
      };
    }

    // 4. MEMORY STORE & RETRIEVAL (memory.vault)
    if (intent === 'MEMORY_STORE') {
      graph.push({
        id: 'S1',
        action: 'PERSIST_USER_FACT',
        tool: 'memory.vault',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: {
          action: 'STORE',
          content: semantic.memoryContent || raw,
          key: semantic.memoryKey || 'user_fact',
          tier: 'LONG_TERM'
        },
        dependsOn: [],
        successCriteria: 'memory_persisted',
        evidenceContract: 'memory_record'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'MEMORY_STORE',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'MEMORY_DATA', minSteps: 1 }
      };
    }

    if (intent === 'MEMORY_RETRIEVAL') {
      graph.push({
        id: 'S1',
        action: 'RECALL_USER_MEMORIES',
        tool: 'memory.vault',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: {
          action: 'QUERY',
          query: semantic.query || raw
        },
        dependsOn: [],
        successCriteria: 'memories_recalled',
        evidenceContract: 'memory_matches'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'MEMORY_RETRIEVAL',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'MEMORY_DATA', minSteps: 1 }
      };
    }

    // 5. MULTI-STEP AGENT TASK (Plan ➔ Document ➔ Search ➔ Matrix ➔ Recommendation)
    if (intent === 'MULTI_STEP_TASK' || intent === 'DEEP_ANALYSIS') {
      graph.push({
        id: 'S1',
        action: 'INSPECT_AND_CHUNK_DOCUMENT',
        tool: 'doc.analyze',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: {
          documentText: context.documentText || 'Dokumen Kinerja AI: Retensi +25%, Latensi -40ms, Cost Efisiensi 35%.',
          query: raw,
          fileName: 'operational_report.pdf'
        },
        dependsOn: [],
        successCriteria: 'document_chunks_ready',
        evidenceContract: 'doc_chunks'
      });

      graph.push({
        id: 'S2',
        action: 'EXTERNAL_BENCHMARK_SEARCH',
        tool: 'web.search',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: 'AI benchmark retention industry standards 2026', maxResults: 3 },
        dependsOn: ['S1'],
        successCriteria: 'benchmark_sources_found',
        evidenceContract: 'industry_benchmarks'
      });

      graph.push({
        id: 'S3',
        action: 'SYNTHESIZE_STRATEGIC_MATRIX',
        tool: 'data.matrix_generator',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { targetMode: 'INSIGHTS' },
        dependsOn: ['S2'],
        successCriteria: 'comparative_matrix_ready',
        evidenceContract: 'strategic_matrix'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'MULTI_STEP_TASK',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'DATA_MODEL', minSteps: 3 }
      };
    }

    // 6. APPLICATION & PROTOTYPE SYNTHESIS INTENT
    if (intent === 'APP_SYNTHESIS') {
      graph.push({
        id: 'S1',
        action: 'ARCHITECTURAL_BLUEPRINT',
        tool: 'spec.blueprint_architect',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { concept: semantic.goal || raw, entities: semantic.entities },
        dependsOn: [],
        successCriteria: 'blueprint_schema_validated',
        evidenceContract: 'structural_spec'
      });
      graph.push({
        id: 'S2',
        action: 'CODE_SYNTHESIS',
        tool: 'code.synthesizer',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.CODE_ENGINEERING[0],
        params: { framework: 'React', concept: semantic.goal || raw },
        dependsOn: ['S1'],
        successCriteria: 'code_artifact_generated',
        evidenceContract: 'jsx_code_string'
      });
      graph.push({
        id: 'S3',
        action: 'SANDBOX_VERIFICATION',
        tool: 'ui.render_app_sandbox',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.CODE_ENGINEERING[0],
        params: { targetMode: 'APP_PREVIEW' },
        dependsOn: ['S2'],
        successCriteria: 'no_critical_runtime_error',
        evidenceContract: 'render_ready_flag'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'APP_SYNTHESIS',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'CODE', minSteps: 3 }
      };
    }

    // 7. LIVE NEWS / BREAKING EVENT INTENT
    if (intent === 'LIVE_NEWS') {
      graph.push({
        id: 'S1',
        action: 'HARVEST_LIVE_NEWS',
        tool: 'intel.multilayer_search',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: semantic.goal || raw, layer: 'SURFACE_WEB', entities: semantic.entities },
        dependsOn: [],
        successCriteria: 'sources_available',
        evidenceContract: 'verified_news_nodes'
      });
      graph.push({
        id: 'S2',
        action: 'RESOLVE_TOP_MEDIA_STREAM',
        tool: 'media.video_resolver',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: semantic.goal || raw },
        dependsOn: ['S1'],
        successCriteria: 'video_id_resolved',
        evidenceContract: 'top_ranked_stream'
      });
      graph.push({
        id: 'S3',
        action: 'RENDER_LIVE_HUD',
        tool: 'ui.render_media_hud',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { targetMode: 'MEDIA' },
        dependsOn: ['S2'],
        successCriteria: 'media_rendered_on_hud',
        evidenceContract: 'hud_state_updated'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'LIVE_NEWS',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'MEDIA_STREAM', minSteps: 3 }
      };
    }

    // 8. DEFAULT STRUCTURED DATA & ANALYTICS
    graph.push({
      id: 'S1',
      action: 'EXTRACT_METRIC_DATASET',
      tool: 'web.search',
      specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
      params: { query: semantic.goal || raw },
      dependsOn: [],
      successCriteria: 'raw_data_extracted',
      evidenceContract: 'tabular_dataset'
    });
    graph.push({
      id: 'S2',
      action: 'STRUCTURED_MATRIX_SYNTHESIS',
      tool: 'data.matrix_generator',
      specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
      params: { targetMode: 'INSIGHTS' },
      dependsOn: ['S1'],
      successCriteria: 'data_matrix_validated',
      evidenceContract: 'data_matrix_artifact'
    });

    return {
      goalId,
      goal: semantic.goal || raw,
      category: 'DATA_ANALYTICS',
      steps: graph,
      evidenceContract: { requiredArtifactType: 'DATA_MATRIX', minSteps: 2 }
    };
  }
}

export default AgentPlanner;
