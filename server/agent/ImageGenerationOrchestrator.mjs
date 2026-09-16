/**
 * ImageGenerationOrchestrator.mjs
 * SPEC — GEMINI → HERMES VISUAL FALLBACK v1.0
 * 
 * Orchestrates cloud image generation via Gemini and local design compilation
 * via Hermes 3:8B when Gemini experiences quota exhaustion (HTTP 429).
 * 
 * Invariants:
 * - ZERO executable path to Pollinations.
 * - Non-quota errors (400, 401, 403, 404, 500) fail truthfully without fallback.
 * - Preserves identical requestId across entire pipeline.
 */

import { geminiImageAdapterInstance } from './adapters/GeminiImageAdapter.mjs';
import { hermesVisualFallbackInstance } from './fallback/HermesVisualFallback.mjs';
import { visualActivityLoggerInstance } from './fallback/VisualActivityLogger.mjs';

export const IMAGE_PROVIDER_POLICY = Object.freeze({
  PRIMARY: 'GEMINI',
  PRESENTATION_FALLBACK: [
    'HERMES_3_8B',
    'LOCAL_RENDERER'
  ],
  HOUSE_FALLBACK: [
    'HERMES_3_8B',
    'LOCAL_RENDERER'
  ],
  FORBIDDEN: [
    'POLLINATIONS'
  ]
});

export function assertImageProviderAllowed(provider) {
  if (!provider) return;
  const str = String(provider).toUpperCase();
  if (str.includes('POLLINATIONS') || str.includes('POLLINATIONS.AI')) {
    const err = new Error('POLLINATIONS_FORBIDDEN: Pollinations is strictly forbidden in JIN runtime.');
    err.code = 'POLLINATIONS_FORBIDDEN';
    throw err;
  }
}

export function isGeminiQuotaFailure(error) {
  if (!error) return false;
  const status = error.status ?? error.statusCode ?? error.code;
  const code = String(error.code || error.reasonCode || '').toUpperCase();
  const message = String(error.message || error.error || '').toLowerCase();

  return (
    status === 429 ||
    status === '429' ||
    code.includes('QUOTA') ||
    code.includes('RESOURCE_EXHAUSTED') ||
    message.includes('quota exceeded') ||
    message.includes('resource exhausted') ||
    message.includes('rate limit') ||
    message.includes('429')
  );
}

export class ImageGenerationOrchestrator {
  constructor({
    geminiImageAdapter = geminiImageAdapterInstance,
    hermesVisualFallback = hermesVisualFallbackInstance,
    activityLogger = visualActivityLoggerInstance
  } = {}) {
    this.gemini = geminiImageAdapter;
    this.hermes = hermesVisualFallback;
    this.activity = activityLogger;
  }

  _resolveDomain(request) {
    if (request.domain === 'PRESENTATION' || request.domain === 'HOUSE_DESIGN') {
      return request.domain;
    }
    const intent = String(request.intent || '').toUpperCase();
    if (intent === 'SLIDE_STUDIO' || intent === 'PRESENTATION') {
      return 'PRESENTATION';
    }
    if (intent === 'HOUSE_DESIGN' || intent === 'ARCHITECTURAL_DESIGN') {
      return 'HOUSE_DESIGN';
    }

    const prompt = String(request.prompt || '').toLowerCase();
    if (/\b(?:slide|presentasi|presentation|infografis|deck)\b/i.test(prompt)) {
      return 'PRESENTATION';
    }
    if (/\b(?:rumah|hunian|arsitektur|bangunan|house|villa|denah|fasad)\b/i.test(prompt)) {
      return 'HOUSE_DESIGN';
    }

    return null;
  }

  async _triggerFallback(request, quotaCause) {
    const requestId = request.requestId || `req-${Date.now()}`;
    const statusVal = quotaCause?.status ?? quotaCause?.statusCode ?? 429;
    const domain = this._resolveDomain(request);

    // Section 12 Trace: [10:40:04] FALLBACK: Gemini quota → Hermes 3:8B
    this.activity.emitActivity({
      requestId,
      level: 'ACTION',
      phase: 'FALLBACK',
      action: 'Gemini quota',
      component: 'ImageGenerationOrchestrator',
      status: 'Hermes 3:8B',
      message: 'Gemini quota/rate limit; switching to Hermes visual design pipeline',
      data: {
        provider: 'GEMINI',
        status: statusVal,
        fallback: 'HERMES_3_8B'
      }
    });

    if (!domain) {
      // If not presentation or house, Hermes fallback contracts are kept clean per Section 2
      const err = new Error(`FALLBACK_DOMAIN_UNSUPPORTED: Hermes fallback is strictly bounded to PRESENTATION and HOUSE_DESIGN.`);
      err.code = 'FALLBACK_DOMAIN_UNSUPPORTED';
      throw err;
    }

    return this.hermes.generateVisual({
      ...request,
      requestId,
      domain,
      context: {
        ...(request.context || {}),
        fallbackReason: 'HTTP_429_QUOTA',
        primaryProvider: 'GEMINI'
      }
    });
  }

  async generateImage(request = {}) {
    const requestId = request.requestId || `req-${Date.now()}`;
    assertImageProviderAllowed(request.provider);
    assertImageProviderAllowed(request.fallbackProvider);
    assertImageProviderAllowed(request.url);

    // Trace: [10:40:01] IMAGE_GENERATION: Gemini primary → RUNNING
    this.activity.emitActivity({
      requestId,
      level: 'ACTION',
      phase: 'IMAGE_GENERATION',
      action: 'Gemini primary',
      component: 'ImageGenerationOrchestrator',
      status: 'RUNNING'
    });

    try {
      const result = await this.gemini.generateImage(request);

      if (result && result.success) {
        // Trace: Gemini primary → SUCCESS
        this.activity.emitActivity({
          requestId,
          level: 'ACTION',
          phase: 'IMAGE_GENERATION',
          action: 'Gemini primary',
          component: 'ImageGenerationOrchestrator',
          status: 'SUCCESS'
        });

        return {
          ...result,
          provider: 'GEMINI',
          fallbackUsed: false
        };
      }

      // Check if the returned object represents a quota failure
      if (isGeminiQuotaFailure(result)) {
        // Trace: Gemini → HTTP 429
        this.activity.emitActivity({
          requestId,
          level: 'WARN',
          phase: 'IMAGE_GENERATION',
          action: 'Gemini',
          component: 'ImageGenerationOrchestrator',
          status: `HTTP ${result.status || 429}`
        });

        return await this._triggerFallback(request, result);
      }

      // Non-quota error -> fail cleanly
      this.activity.emitActivity({
        requestId,
        level: 'ERROR',
        phase: 'IMAGE_GENERATION',
        action: 'Gemini primary',
        component: 'ImageGenerationOrchestrator',
        status: 'FAILED',
        message: result?.error || 'IMAGE_GENERATION_FAILED'
      });

      const err = new Error(result?.error || 'IMAGE_GENERATION_FAILED');
      err.status = result?.status || 400;
      err.code = result?.reasonCode || 'IMAGE_GENERATION_FAILED';
      throw err;
    } catch (error) {
      if (isGeminiQuotaFailure(error)) {
        this.activity.emitActivity({
          requestId,
          level: 'WARN',
          phase: 'IMAGE_GENERATION',
          action: 'Gemini',
          component: 'ImageGenerationOrchestrator',
          status: `HTTP ${error.status || 429}`
        });

        return await this._triggerFallback(request, error);
      }

      this.activity.emitActivity({
        requestId,
        level: 'ERROR',
        phase: 'IMAGE_GENERATION',
        action: 'Gemini primary',
        component: 'ImageGenerationOrchestrator',
        status: 'FAILED',
        message: error.message
      });

      throw error;
    }
  }
}

export const imageGenerationOrchestratorInstance = new ImageGenerationOrchestrator();
export default imageGenerationOrchestratorInstance;
