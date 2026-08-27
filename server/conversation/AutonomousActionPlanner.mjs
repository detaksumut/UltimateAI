/**
 * AutonomousActionPlanner.mjs
 * Generates autonomous execution plans and cognitive orchestration decisions without user prompt buttons.
 */

import { LiveConversationAnalyzer } from './LiveConversationAnalyzer.mjs';
import { toolRegistryInstance } from '../tools/ToolRegistry.mjs';

export class AutonomousActionPlanner {
  /**
   * Evaluates analysis result and constructs an execution plan
   * @param {Object} analysis - Output from LiveConversationAnalyzer
   * @returns {Object} plan - { actionType, tool, params, uiTargetMode, directVoiceResponse }
   */
  static planAction(analysis) {
    const { intent, topic, entities } = analysis;

    switch (intent) {
      case 'LIVE_NEWS_RETRIEVAL':
        return {
          actionType: 'ORCHESTRATE_TOOL',
          tool: 'intel.multilayer_search',
          params: { query: `berita ${topic} hari ini` },
          uiTargetMode: 'MEDIA',
          mediaStreamType: 'NEWS_LIVE',
          voiceResponse: `Saya telah merayapi siaran dan liputan berita terkait ${topic} dari YouTube dan media nasional. Siaran langsung berita telah siap dipantau di panel kanan.`
        };

      case 'MEDIA_PLAYBACK':
        return {
          actionType: 'ORCHESTRATE_TOOL',
          tool: 'intel.multilayer_search',
          params: { query: entities.track || topic },
          uiTargetMode: 'MEDIA',
          mediaStreamType: 'MUSIC_PLAYBACK',
          voiceResponse: `Siap! Saya telah mencarikan dan memuat video musik ${entities.track || topic} dari YouTube di panel kanan. Musik siap Anda dengarkan.`
        };

      case 'DATA_EXTRACTION':
        return {
          actionType: 'ORCHESTRATE_TOOL',
          tool: 'intel.multilayer_search',
          params: { query: topic },
          uiTargetMode: 'INSIGHTS',
          voiceResponse: `Data statistik dan metrik terstruktur terkait ${topic} telah dianalisis dan disajikan langsung ke panel kanan.`
        };

      case 'APP_PROTOTYPE':
        return {
          actionType: 'ORCHESTRATE_APP_BUILD',
          tool: 'app.generator',
          params: { concept: topic },
          uiTargetMode: 'APP_PREVIEW',
          voiceResponse: `Purwarupa aplikasi untuk ${topic} telah berhasil dirancang dan langsung dimuat ke layar simulator.`
        };

      case 'RESEARCH_SYNTHESIS':
        return {
          actionType: 'ORCHESTRATE_TOOL',
          tool: 'intel.multilayer_search',
          params: { query: topic },
          uiTargetMode: 'SEARCH',
          voiceResponse: `Berdasarkan penelusuran multi-layer jaringan pengetahuan, informasi relevan mengenai ${topic} telah dipetakan secara akurat.`
        };

      case 'GENERAL_DISCUSSION':
      default:
        return {
          actionType: 'CONVERSATIONAL_RESPONSE',
          uiTargetMode: 'CONVERSATION',
          voiceResponse: `Halo! Saya JIN, rekan kecerdasan otonom Anda. Saya selalu menyimak percakapan Anda dan siap mengeksekusi kebutuhan data, berita, musik, maupun purwarupa aplikasi secara langsung.`
        };
    }
  }
}

export default AutonomousActionPlanner;
