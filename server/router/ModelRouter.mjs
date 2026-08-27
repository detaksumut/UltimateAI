/**
 * ModelRouter.mjs
 * Dynamic Intent-to-Model Routing Engine for UltimateAI 9Router.
 */

export const ROUTE_TYPES = {
  FAST_CHAT: 'FAST_CHAT',
  DEEP_REASONING: 'DEEP_REASONING',
  CODE_GENERATION: 'CODE_GENERATION',
  DATA_ANALYSIS: 'DATA_ANALYSIS',
  GLOBAL_SEARCH: 'GLOBAL_SEARCH',
  LONG_DOCUMENT: 'LONG_DOCUMENT'
};

export class ModelRouter {
  static routeByIntent(intent, query = '', context = {}) {
    const q = (query || '').toLowerCase();

    if (intent === 'CODE_GENERATION' || q.includes('buatkan aplikasi') || q.includes('code') || q.includes('prototype')) {
      return {
        strategy: ROUTE_TYPES.CODE_GENERATION,
        recommendedModel: 'claude-3-5-sonnet',
        temperature: 0.2,
        reason: 'Optimal code synthesis and UI component generation'
      };
    }

    if (intent === 'DATA_ANALYSIS' || q.includes('analisis') || q.includes('risiko') || q.includes('anomali')) {
      return {
        strategy: ROUTE_TYPES.DEEP_REASONING,
        recommendedModel: 'deepseek-r1',
        temperature: 0.1,
        reason: 'Deep multi-step analytical reasoning and mathematical verification'
      };
    }

    if (intent === 'GLOBAL_SEARCH' || q.includes('cari') || q.includes('search') || q.includes('tren')) {
      return {
        strategy: ROUTE_TYPES.GLOBAL_SEARCH,
        recommendedModel: 'gemini-2.0-flash',
        temperature: 0.4,
        reason: 'High-speed retrieval and multi-source ground truth synthesis'
      };
    }

    if (context.hasLongDocument || (context.docChars && context.docChars > 4000)) {
      return {
        strategy: ROUTE_TYPES.LONG_DOCUMENT,
        recommendedModel: 'gemini-2.0-pro-exp',
        temperature: 0.2,
        reason: 'Long-context document ingestion and comprehension'
      };
    }

    // Default fast conversation
    return {
      strategy: ROUTE_TYPES.FAST_CHAT,
      recommendedModel: 'gemini-2.0-flash',
      temperature: 0.7,
      reason: 'Ultra-low latency conversational interaction'
    };
  }
}

export default ModelRouter;
