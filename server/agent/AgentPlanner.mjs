/**
 * AgentPlanner.mjs
 * Decomposes natural goals into actionable multi-step execution graphs.
 * Maps sub-tasks to specialist models and tools.
 */

import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';

export class AgentPlanner {
  /**
   * Constructs an execution graph from user goal
   * @param {string} goal - High-level user goal
   * @param {Object} context - Previous conversational history & memory
   * @returns {Object} plan - { goalId, steps, estimatedComplexity }
   */
  static planGoal(goal, context = {}) {
    const raw = goal || '';
    const p = raw.toLowerCase();
    const goalId = `goal-${Date.now()}`;

    const steps = [];

    // 1. LIVE NEWS / BREAKING EVENT GOAL
    if (p.includes('berita') || p.includes('demo') || p.includes('dpr') || p.includes('politik') || p.includes('terkini') || p.includes('hari ini')) {
      steps.push({
        stepId: 1,
        name: 'MULTI_LAYER_NEWS_HARVEST',
        tool: 'intel.multilayer_search',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: raw, layer: 'SURFACE_WEB' },
        description: 'Rayapi sumber berita terkini & video streaming nasional'
      });
      steps.push({
        stepId: 2,
        name: 'AUTONOMOUS_VIDEO_RESOLUTION',
        tool: 'media.video_resolver',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: raw },
        description: 'Seleksi 1 video berita terpercaya & berstatus live'
      });
      steps.push({
        stepId: 3,
        name: 'VERIFY_AND_SYNTHESIZE_HUD',
        tool: 'ui.render_media_hud',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { targetMode: 'MEDIA' },
        description: 'Validasi integritas tautan berita & render ke layar simulator'
      });

      return { goalId, goal: raw, category: 'LIVE_NEWS', steps };
    }

    // 2. MULTIMEDIA / MUSIC DISPATCH GOAL
    if (p.includes('lagu') || p.includes('dj') || p.includes('musik') || p.includes('music') || p.includes('heaven') || p.includes('putar') || p.includes('play')) {
      steps.push({
        stepId: 1,
        name: 'RESOLVE_AUDIO_TRACK',
        tool: 'media.video_resolver',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: raw },
        description: 'Cari & validasi ID streaming audio/video resmi'
      });
      steps.push({
        stepId: 2,
        name: 'DISPATCH_MEDIA_PLAYER',
        tool: 'ui.render_media_hud',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { targetMode: 'MEDIA' },
        description: 'Muat pemutar audio ke tab MEDIA dan aktifkan pemutaran'
      });

      return { goalId, goal: raw, category: 'MULTIMEDIA', steps };
    }

    // 3. APPLICATION & PROTOTYPE GENERATION GOAL
    if (p.includes('aplikasi') || p.includes('buat') || p.includes('kalkulator') || p.includes('prototype') || p.includes('app') || p.includes('dashboard')) {
      steps.push({
        stepId: 1,
        name: 'ARCHITECTURAL_BLUEPRINT',
        tool: 'spec.blueprint_architect',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { concept: raw },
        description: 'Rancang spesifikasi arsitektur & komponen interaktif'
      });
      steps.push({
        stepId: 2,
        name: 'CODE_ENGINEERING_SYNTHESIS',
        tool: 'code.synthesizer',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.CODE_ENGINEERING[0],
        params: { framework: 'React' },
        description: 'Generate kode komponen aplikasi interaktif'
      });
      steps.push({
        stepId: 3,
        name: 'RENDER_SANDBOX_SIMULATOR',
        tool: 'ui.render_app_sandbox',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.CODE_ENGINEERING[0],
        params: { targetMode: 'APP_PREVIEW' },
        description: 'Muat & uji aplikasi langsung di simulator iPhone'
      });

      return { goalId, goal: raw, category: 'APP_SYNTHESIS', steps };
    }

    // 4. STRUCTURED DATA & ANALYTICS GOAL
    if (p.includes('data') || p.includes('tabel') || p.includes('grafik') || p.includes('statistik') || p.includes('metrik')) {
      steps.push({
        stepId: 1,
        name: 'EXTRACT_METRIC_DATASET',
        tool: 'intel.multilayer_search',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
        params: { query: raw },
        description: 'Ekstraksi parameter data & tabel statistik'
      });
      steps.push({
        stepId: 2,
        name: 'STRUCTURED_MATRIX_SYNTHESIS',
        tool: 'data.matrix_generator',
        specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.DEEP_REASONING[0],
        params: { targetMode: 'INSIGHTS' },
        description: 'Sajikan matriks data analitik ke panel simulator'
      });

      return { goalId, goal: raw, category: 'DATA_ANALYTICS', steps };
    }

    // 5. GENERAL RESEARCH & CONVERSATION GOAL
    steps.push({
      stepId: 1,
      name: 'DEEP_KNOWLEDGE_SYNTHESIS',
      tool: 'intel.multilayer_search',
      specialistModel: JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY.FAST_RESEARCH[0],
      params: { query: raw },
      description: 'Penelusuran multi-layer simpul pengetahuan'
    });

    return { goalId, goal: raw, category: 'KNOWLEDGE_SYNTHESIS', steps };
  }
}

export default AgentPlanner;
