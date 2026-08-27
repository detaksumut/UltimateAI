/**
 * AgentPlanner.mjs
 * Generates formal DAG Execution Graphs with explicit dependencies and evidence criteria.
 */

import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';

export class AgentPlanner {
  /**
   * Constructs an execution graph with explicit dependencies and contracts
   * @param {string} goal - High-level user goal
   * @param {Object} context - Previous conversational history & memory
   * @returns {Object} plan - { goalId, goal, graph, steps, evidenceContract }
   */
  static planGoal(goal, context = {}) {
    const raw = goal || '';
    const p = raw.toLowerCase();
    const goalId = `goal-${Date.now()}`;

    const graph = [];

    // 1. APPLICATION & RESEARCH DASHBOARD SYNTHESIS GOAL
    if (p.includes('aplikasi') || p.includes('buat') || p.includes('kalkulator') || p.includes('prototype') || p.includes('app') || p.includes('dashboard')) {
      graph.push({
        id: 'S1',
        action: 'ARCHITECTURAL_BLUEPRINT',
        tool: 'spec.blueprint_architect',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { concept: raw },
        dependsOn: [],
        successCriteria: 'blueprint_schema_validated',
        evidenceContract: 'structural_spec'
      });
      graph.push({
        id: 'S2',
        action: 'CODE_SYNTHESIS',
        tool: 'code.synthesizer',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.CODE_ENGINEERING[0],
        params: { framework: 'React' },
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
        goal: raw,
        category: 'APP_SYNTHESIS',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'CODE', minSteps: 3 }
      };
    }

    // 2. LIVE NEWS / BREAKING EVENT GOAL
    if (p.includes('berita') || p.includes('demo') || p.includes('dpr') || p.includes('politik') || p.includes('terkini') || p.includes('hari ini')) {
      graph.push({
        id: 'S1',
        action: 'HARVEST_LIVE_NEWS',
        tool: 'intel.multilayer_search',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: raw, layer: 'SURFACE_WEB' },
        dependsOn: [],
        successCriteria: 'sources_available',
        evidenceContract: 'verified_news_nodes'
      });
      graph.push({
        id: 'S2',
        action: 'RESOLVE_TOP_MEDIA_STREAM',
        tool: 'media.video_resolver',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: raw },
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
        goal: raw,
        category: 'LIVE_NEWS',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'MEDIA_STREAM', minSteps: 3 }
      };
    }

    // 3. STRUCTURED DATA & ANALYTICS GOAL
    if (p.includes('data') || p.includes('tabel') || p.includes('grafik') || p.includes('statistik') || p.includes('metrik')) {
      graph.push({
        id: 'S1',
        action: 'EXTRACT_METRIC_DATASET',
        tool: 'intel.multilayer_search',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: raw },
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
        goal: raw,
        category: 'DATA_ANALYTICS',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'DATA_MATRIX', minSteps: 2 }
      };
    }

    // 4. GENERAL RESEARCH & MULTI-LAYER KNOWLEDGE
    graph.push({
      id: 'S1',
      action: 'DEEP_KNOWLEDGE_SEARCH',
      tool: 'intel.multilayer_search',
      specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
      params: { query: raw },
      dependsOn: [],
      successCriteria: 'knowledge_nodes_retrieved',
      evidenceContract: 'synthesized_brief'
    });

    return {
      goalId,
      goal: raw,
      category: 'KNOWLEDGE_SYNTHESIS',
      steps: graph,
      evidenceContract: { requiredArtifactType: 'RESEARCH_BRIEF', minSteps: 1 }
    };
  }
}

export default AgentPlanner;
