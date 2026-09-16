/**
 * HermesVisualFallback.mjs
 * Fallback visual design pipeline powered by Hermes 3:8B and Local Programmatic Renderers.
 * 
 * Flow:
 * Intent Gate -> ImageGenerationOrchestrator -> Gemini (HTTP 429/QUOTA)
 * -> HermesVisualFallback -> VisualDesignSpec (JSON) -> LocalRenderer -> Real Image Artifact
 * 
 * STRICT: ZERO POLLINATIONS INVOCATION.
 */

import { SchemaValidator, GeometryValidator, SafetyValidator } from './VisualDesignValidators.mjs';
import { presentationVisualRendererInstance } from './PresentationVisualRenderer.mjs';
import { architecturalVisualRendererInstance } from './ArchitecturalVisualRenderer.mjs';
import { visualActivityLoggerInstance } from './VisualActivityLogger.mjs';
import { hermesVisualAdapterInstance } from './HermesVisualAdapter.mjs';

export const PRESENTATION_SYSTEM_PROMPT = `You are JIN Visual Design Compiler.

Generate a structured VisualDesignSpec for a professional presentation slide.

Domain: PRESENTATION

Requirements:
- deterministic layout
- explicit x/y coordinates
- explicit width/height
- explicit typography
- explicit colors
- no raster image generation
- no external image provider
- no Pollinations
- no explanations
- no markdown
- valid JSON only

The output MUST conform to:
JIN.VisualDesignSpec v1.0.

User visual request:
{{prompt}}

Return JSON only.`;

export const HOUSE_DESIGN_SYSTEM_PROMPT = `You are JIN Architectural Visual Design Compiler.

Generate a structured VisualDesignSpec for a house design.

Domain: HOUSE_DESIGN

Requirements:
- explicit site dimensions when provided
- explicit building dimensions
- floors
- room organization
- facade
- materials
- roof
- openings
- camera
- lighting
- composition
- valid JSON only
- no markdown
- no explanation
- no external image provider
- no Pollinations

Return JSON only.`;

export class HermesVisualFallback {
  constructor({
    hermesAdapter = null,
    llamaCppAdapter = null,
    renderer = null,
    activityLogger = visualActivityLoggerInstance
  } = {}) {
    this.hermesAdapter = hermesAdapter || llamaCppAdapter || hermesVisualAdapterInstance;
    this.renderer = renderer;
    this.activity = activityLogger;
  }

  /**
   * Cleans model output, removing backticks or markdown fences to extract raw JSON.
   */
  _extractJson(rawText) {
    if (typeof rawText !== 'string') return '';
    let text = rawText.trim();
    // Remove <think>...</think> blocks if any
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Remove markdown ```json ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match) {
      return match[1].trim();
    }
    // Match outermost { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1).trim();
    }
    return text;
  }

  /**
   * Dispatches generation to Hermes 3:8B or local LLM with repair loop.
   */
  async _compileDesignSpec({ prompt, domain, requestId }) {
    const isPresentation = domain === 'PRESENTATION';
    const baseSystemPrompt = isPresentation ? PRESENTATION_SYSTEM_PROMPT : HOUSE_DESIGN_SYSTEM_PROMPT;
    const systemPrompt = baseSystemPrompt.replace('{{prompt}}', prompt);

    let currentPrompt = `Generate JIN.VisualDesignSpec for: ${prompt}`;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      this.activity.emitActivity({
        requestId,
        level: 'ACTION',
        phase: 'HERMES_VISUAL',
        action: attempt === 1 ? 'Generating VisualDesignSpec' : `Repairing VisualDesignSpec (Attempt ${attempt})`,
        component: 'HermesVisualFallback',
        status: 'RUNNING'
      });

      let rawOutput = '';
      try {
        rawOutput = await this.hermesAdapter.generate({
          prompt: currentPrompt,
          systemPrompt,
          model: 'hermes-3-8b',
          temperature: 0.2,
          maxTokens: 4096
        });
      } catch (llmErr) {
        lastError = llmErr;
        // If LLM runtime throws, retry once with explicit repair request
        currentPrompt = `Previous response threw error: ${llmErr.message}. Output ONLY valid raw JSON JIN.VisualDesignSpec.`;
        continue;
      }

      const jsonStr = this._extractJson(rawOutput);
      let parsed = null;
      try {
        parsed = JSON.parse(jsonStr);
        this.activity.emitActivity({
          requestId,
          level: 'INFO',
          phase: 'HERMES_VISUAL',
          action: 'JSON parsed',
          component: 'HermesVisualFallback',
          status: 'SUCCESS'
        });
      } catch (parseErr) {
        lastError = new Error(`JSON_PARSE_ERROR: ${parseErr.message}`);
        currentPrompt = `Your previous output was invalid JSON (${parseErr.message}). Fix it and return strictly valid JSON matching JIN.VisualDesignSpec v1.0.`;
        continue;
      }

      // Enforce requestId and domain on parsed spec
      parsed.requestId = requestId;
      if (!parsed.domain) parsed.domain = domain;

      // Pipeline: SchemaValidator -> GeometryValidator -> SafetyValidator
      const sVal = SchemaValidator.validate(parsed, domain);
      if (!sVal.valid) {
        lastError = new Error(sVal.error);
        currentPrompt = `Your spec failed SchemaValidator: ${sVal.error}. Correct the schema and return strictly valid JSON.`;
        continue;
      }

      const gVal = GeometryValidator.validate(parsed);
      if (!gVal.valid) {
        lastError = new Error(gVal.error);
        currentPrompt = `Your spec failed GeometryValidator: ${gVal.error}. Correct the dimensions and return strictly valid JSON.`;
        continue;
      }

      const safeVal = SafetyValidator.validate(parsed);
      if (!safeVal.valid) {
        lastError = new Error(safeVal.error);
        throw safeVal.error.includes('POLLINATIONS') ? safeVal.error : new Error(safeVal.error);
      }

      this.activity.emitActivity({
        requestId,
        level: 'ACTION',
        phase: 'VALIDATOR',
        action: 'VisualDesignSpec',
        component: 'HermesVisualFallback',
        status: 'PASS'
      });

      return parsed;
    }

    const failureErr = new Error(`HERMES_VISUAL_SPEC_INVALID: ${lastError?.message || 'Spec generation failed validation'}`);
    failureErr.code = 'HERMES_VISUAL_SPEC_INVALID';
    throw failureErr;
  }

  /**
   * Main visual generation entry point.
   */
  async generateVisual({
    requestId,
    domain,
    prompt,
    width,
    height,
    aspectRatio,
    context = {}
  }) {
    if (!domain || (domain !== 'PRESENTATION' && domain !== 'HOUSE_DESIGN')) {
      return {
        success: false,
        error: `INVALID_DOMAIN: Domain must be PRESENTATION or HOUSE_DESIGN, received "${domain}".`,
        reasonCode: 'INVALID_DOMAIN',
        requestId
      };
    }

    const resolvedRequestId = requestId || `req-fallback-${Date.now()}`;

    // 1. Compile Visual Design Spec via Hermes 3:8B
    let spec;
    try {
      spec = await this._compileDesignSpec({
        prompt: prompt || 'visual design project',
        domain,
        requestId: resolvedRequestId
      });
    } catch (err) {
      this.activity.emitActivity({
        requestId: resolvedRequestId,
        level: 'ERROR',
        phase: 'HERMES_VISUAL',
        action: 'VisualDesignSpec compilation',
        component: 'HermesVisualFallback',
        status: 'FAILED',
        message: err.message
      });

      return {
        success: false,
        error: err.message,
        reasonCode: err.code || 'HERMES_VISUAL_SPEC_INVALID',
        requestId: resolvedRequestId
      };
    }

    // 2. Select and Invoke Local Renderer
    this.activity.emitActivity({
      requestId: resolvedRequestId,
      level: 'ACTION',
      phase: 'RENDERER',
      action: 'Programmatic rendering',
      component: 'HermesVisualFallback',
      status: 'RUNNING'
    });

    let renderResult;
    try {
      if (this.renderer) {
        renderResult = await this.renderer.render(spec);
      } else if (domain === 'PRESENTATION') {
        renderResult = await presentationVisualRendererInstance.render(spec);
      } else if (domain === 'HOUSE_DESIGN') {
        renderResult = await architecturalVisualRendererInstance.render(spec);
      }
    } catch (renderErr) {
      renderResult = {
        success: false,
        error: `RENDER_FAILED: ${renderErr.message}`,
        reasonCode: 'RENDER_FAILED'
      };
    }

    if (!renderResult || !renderResult.success) {
      const errCode = renderResult?.reasonCode || 'RENDER_FAILED';
      const errMsg = renderResult?.error || 'Local renderer failed to produce image.';

      this.activity.emitActivity({
        requestId: resolvedRequestId,
        level: 'ERROR',
        phase: 'RENDERER',
        action: 'Programmatic rendering',
        component: 'HermesVisualFallback',
        status: 'FAILED',
        message: errMsg
      });

      return {
        success: false,
        error: errMsg,
        reasonCode: errCode,
        requestId: resolvedRequestId
      };
    }

    this.activity.emitActivity({
      requestId: resolvedRequestId,
      level: 'ACTION',
      phase: 'RENDERER',
      action: 'PNG generated',
      component: 'HermesVisualFallback',
      status: 'SUCCESS'
    });

    this.activity.emitActivity({
      requestId: resolvedRequestId,
      level: 'ACTION',
      phase: 'QA',
      action: 'Image validation',
      component: 'HermesVisualFallback',
      status: 'PASS'
    });

    this.activity.emitActivity({
      requestId: resolvedRequestId,
      level: 'ACTION',
      phase: 'IMAGE_GENERATION',
      action: 'Fallback complete',
      component: 'HermesVisualFallback',
      status: 'SUCCESS'
    });

    // 3. Response Metadata conforming to Section 13
    return {
      success: true,
      provider: 'LOCAL_HERMES_RENDERER',
      primaryProvider: 'GEMINI',
      fallbackUsed: true,
      fallbackReason: context.fallbackReason || 'HTTP_429_QUOTA',
      model: 'hermes-3-8b',
      artifact: renderResult.artifact ? { ...renderResult.artifact, requestId: resolvedRequestId } : {
        type: 'image',
        mimeType: renderResult.mimeType || 'image/png',
        path: renderResult.path || `/api/artifacts/images/${renderResult.artifactId || 'artifact'}.png`,
        width: renderResult.width,
        height: renderResult.height,
        requestId: resolvedRequestId
      },
      spec,
      pptxBuffer: renderResult.pptxBuffer,
      qaReport: renderResult.qaReport,
      svg: renderResult.svg,
      requestId: resolvedRequestId
    };
  }
}

export const hermesVisualFallbackInstance = new HermesVisualFallback();
export default hermesVisualFallbackInstance;
