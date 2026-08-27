/**
 * AgentPlanner.mjs
 * True Semantic DAG Execution Graph Planner.
 * Uses SemanticIntentEngine interpretation as the Single Source of Truth for planning.
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
      toolsNeeded: ['intel.multilayer_search']
    };

    const goalId = `goal-${Date.now()}`;
    const intent = semantic.intent || 'RESEARCH_QUESTION';
    const graph = [];

    // 1. APPLICATION & PROTOTYPE SYNTHESIS INTENT
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

    // 2. LIVE NEWS / BREAKING EVENT INTENT
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

    // 3. MULTIMEDIA / MUSIC DISPATCH INTENT
    if (intent === 'MEDIA_PLAYBACK') {
      graph.push({
        id: 'S1',
        action: 'RESOLVE_AUDIO_TRACK',
        tool: 'media.video_resolver',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: semantic.goal || raw },
        dependsOn: [],
        successCriteria: 'video_id_resolved',
        evidenceContract: 'verified_track'
      });
      graph.push({
        id: 'S2',
        action: 'DISPATCH_MEDIA_PLAYER',
        tool: 'ui.render_media_hud',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { targetMode: 'MEDIA' },
        dependsOn: ['S1'],
        successCriteria: 'media_player_rendered',
        evidenceContract: 'playback_active'
      });

      return {
        goalId,
        goal: semantic.goal || raw,
        category: 'MULTIMEDIA',
        steps: graph,
        evidenceContract: { requiredArtifactType: 'MEDIA_PLAYER', minSteps: 2 }
      };
    }

    // 4. STRUCTURED DATA & ANALYTICS INTENT
    if (intent === 'DATA_ANALYTICS') {
      graph.push({
        id: 'S1',
        action: 'EXTRACT_METRIC_DATASET',
        tool: 'intel.multilayer_search',
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

    // 5. DEFAULT RESEARCH & DEEP KNOWLEDGE INTENT
    graph.push({
      id: 'S1',
      action: 'DEEP_KNOWLEDGE_SEARCH',
      tool: 'intel.multilayer_search',
      specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
      params: { query: semantic.goal || raw, entities: semantic.entities },
      dependsOn: [],
      successCriteria: 'knowledge_nodes_retrieved',
      evidenceContract: 'synthesized_brief'
    });

    return {
      goalId,
      goal: semantic.goal || raw,
      category: 'KNOWLEDGE_SYNTHESIS',
      steps: graph,
      evidenceContract: { requiredArtifactType: 'RESEARCH_BRIEF', minSteps: 1 }
    };
  }
}

export default AgentPlanner;
