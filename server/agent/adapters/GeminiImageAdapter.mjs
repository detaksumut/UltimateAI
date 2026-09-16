/**
 * GeminiImageAdapter.mjs
 * Dedicated Gemini Image Generation Adapter for UltimateAI / JIN Runtime.
 *
 * Requirements:
 * - Direct Gemini API integration reusing key rotation from GeminiProvider
 * - Never expose API keys in logs or frontend responses
 * - Preserve requestId throughout the pipeline
 * - Return actual generated image bytes, MIME type, model name, provider name ('GEMINI')
 * - Propagate real errors as IMAGE_GENERATION_FAILED (no dummy/fake images)
 * - Strict Invariant: assertNoPollinationsImageProvider() prevents Pollinations execution
 * - Output conforms to ImageOutputSizePolicy (< 1 MB ceiling)
 */

import fs from 'fs';
import path from 'path';
import { geminiProviderInstance } from '../../providers/GeminiProvider.mjs';
import { imageOutputSizePolicyInstance, MAX_IMAGE_BYTES } from '../ImageOutputSizePolicy.mjs';

/**
 * STEP 7: Explicit Invariant Guard
 * Throws immediately if Pollinations is requested or referenced.
 */
export function assertNoPollinationsImageProvider(providerOrUrl = null) {
  if (!providerOrUrl) return;
  const str = String(providerOrUrl).toLowerCase();
  if (str.includes('pollinations') || str.includes('pollinations.ai')) {
    const error = new Error('[POLLINATIONS_HARD_GATE] Pollinations image provider is strictly disabled and forbidden in JIN runtime.');
    error.code = 'POLLINATIONS_FORBIDDEN';
    throw error;
  }
}

export class GeminiImageAdapter {
  constructor() {
    this.name = 'GeminiImageAdapter';
    this.providerName = 'GEMINI';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Helper to mask any sensitive API key patterns in log strings or errors.
   */
  _maskSecrets(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/AQ\.[a-zA-Z0-9_-]{50,}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/key=[^&\s]+/g, 'key=[REDACTED_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/g, 'Bearer [REDACTED_TOKEN]');
  }

  /**
   * Classifies an HTTP status code into a structured failure category.
   * Returns one of: 'QUOTA', 'AUTH', 'PERMISSION', 'INVALID_REQUEST', 'NOT_FOUND', 'SERVER_ERROR', 'UNKNOWN'
   */
  _classifyHttpError(status) {
    if (status === 429) return 'QUOTA';
    if (status === 401) return 'AUTH';
    if (status === 403) return 'PERMISSION';
    if (status === 400) return 'INVALID_REQUEST';
    if (status === 404) return 'NOT_FOUND';
    if (status >= 500 && status < 600) return 'SERVER_ERROR';
    return 'UNKNOWN';
  }

  /**
   * Builds the aggregated pool diagnosis after all Gemini keys have been attempted.
   * Uses structured classification instead of relying on lastError (which overwrites prior signals).
   */
  _buildPoolDiagnosis(poolStats, model, requestId) {
    const { attempts, quotaFailures, permissionFailures, authFailures, invalidRequestFailures, notFoundFailures, serverErrorFailures, otherFailures } = poolStats;

    // Determine the dominant failure category
    const dominatedByQuota = quotaFailures > 0;
    const dominatedByPermission = !dominatedByQuota && permissionFailures > 0 && authFailures === 0 && quotaFailures === 0;
    const dominatedByAuth = !dominatedByQuota && authFailures > 0 && permissionFailures === 0 && quotaFailures === 0;
    const dominatedByInvalidRequest = !dominatedByQuota && !dominatedByPermission && !dominatedByAuth && invalidRequestFailures > 0;
    const dominatedByNotFound = !dominatedByQuota && !dominatedByPermission && !dominatedByAuth && !dominatedByInvalidRequest && notFoundFailures > 0;
    const dominatedByServerError = !dominatedByQuota && !dominatedByPermission && !dominatedByAuth && !dominatedByInvalidRequest && !dominatedByNotFound && serverErrorFailures > 0;

    let status, code, fallbackEligible;

    if (dominatedByQuota) {
      status = 429;
      code = 'GEMINI_QUOTA_EXHAUSTED';
      fallbackEligible = true;
    } else if (dominatedByAuth) {
      status = 401;
      code = 'GEMINI_AUTH_FAILURE';
      fallbackEligible = false;
    } else if (dominatedByPermission) {
      status = 403;
      code = 'GEMINI_PERMISSION_FAILURE';
      fallbackEligible = false;
    } else if (dominatedByInvalidRequest) {
      status = 400;
      code = 'GEMINI_INVALID_REQUEST';
      fallbackEligible = false;
    } else if (dominatedByNotFound) {
      status = 404;
      code = 'GEMINI_MODEL_NOT_FOUND';
      fallbackEligible = false;
    } else if (dominatedByServerError) {
      status = 500;
      code = 'GEMINI_SERVER_ERROR';
      fallbackEligible = false;
    } else {
      status = 500;
      code = 'GEMINI_ERROR';
      fallbackEligible = false;
    }

    return {
      success: false,
      status,
      code,
      fallbackEligible,
      attempts,
      quotaFailures,
      permissionFailures,
      authFailures,
      invalidRequestFailures: invalidRequestFailures || 0,
      notFoundFailures: notFoundFailures || 0,
      serverErrorFailures: serverErrorFailures || 0,
      otherFailures: otherFailures || 0,
      provider: this.providerName,
      model,
      requestId
    };
  }

  /**
   * Resolves the configured Gemini image model.
   * Enforces STEP 5: If not configured, throws GEMINI_IMAGE_MODEL_NOT_CONFIGURED.
   */
  resolveImageModel() {
    const configuredModel = process.env.GEMINI_IMAGE_MODEL;
    if (!configuredModel || typeof configuredModel !== 'string' || !configuredModel.trim()) {
      const error = new Error('GEMINI_IMAGE_MODEL_NOT_CONFIGURED: No image-capable Gemini model configured in .env (e.g. GEMINI_IMAGE_MODEL=gemini-2.5-flash-image).');
      error.code = 'GEMINI_IMAGE_MODEL_NOT_CONFIGURED';
      throw error;
    }
    return configuredModel.trim();
  }

  /**
   * STEP 3 & STEP 6: Main generateImage implementation.
   *
   * @param {Object} params
   * @param {string} params.prompt
   * @param {number} [params.width]
   * @param {number} [params.height]
   * @param {string} [params.aspectRatio]
   * @param {string} [params.requestId]
   * @param {string} [params.negativePrompt]
   * @param {AbortSignal} [params.signal]
   * @param {Function} [params.fetchFn]
   * @returns {Promise<{ success: boolean, buffer?: Buffer, bytes?: Buffer, width: number, height: number, mimeType: string, model: string, provider: string, requestId: string, sizeBytes?: number, error?: string, reasonCode?: string }>}
   */
  async generateImage(params = {}) {
    const {
      prompt = '',
      width: reqWidth,
      height: reqHeight,
      aspectRatio = '16:9',
      requestId = `req-${Date.now()}`,
      negativePrompt = '',
      signal = null,
      fetchFn = globalThis.fetch
    } = params;

    // STEP 7: Assert no Pollinations anywhere in parameters
    assertNoPollinationsImageProvider(params.provider);
    assertNoPollinationsImageProvider(params.fallbackProvider);
    assertNoPollinationsImageProvider(params.url);

    // STEP 5: Model resolution
    const model = this.resolveImageModel();

    // STEP 6: Diagnostic RUNNING log
    console.log(`[ImageGeneration]\nProvider: GEMINI\nModel: ${model}\nRequestId: ${requestId}\nStatus: RUNNING`);

    const t0 = Date.now();
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      return {
        success: false,
        error: 'IMAGE_GENERATION_FAILED: Prompt is empty',
        reasonCode: 'IMAGE_GENERATION_FAILED',
        provider: this.providerName,
        model,
        requestId
      };
    }

    // Resolve API keys via GeminiProvider's key pool
    const allKeys = geminiProviderInstance._getAllApiKeys();
    if (allKeys.length === 0) {
      const errorMsg = 'IMAGE_GENERATION_FAILED: GEMINI_UNCONFIGURED - No valid Gemini API key found in environment.';
      console.error(`[ImageGeneration] ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        reasonCode: 'IMAGE_GENERATION_FAILED',
        provider: this.providerName,
        model,
        requestId
      };
    }

    const fullPrompt = negativePrompt ? `${cleanPrompt}. Avoid: ${negativePrompt}` : cleanPrompt;
    const aspectHint = aspectRatio ? ` (${aspectRatio} aspect ratio)` : '';
    const modelPath = model.startsWith('models/') ? model : `models/${model}`;
    const isImagenPredict = /imagen/i.test(model);

    const poolStats = {
      attempts: 0,
      quotaFailures: 0,
      permissionFailures: 0,
      authFailures: 0,
      invalidRequestFailures: 0,
      notFoundFailures: 0,
      serverErrorFailures: 0,
      otherFailures: 0
    };

    for (let i = 0; i < allKeys.length; i++) {
      const { key, idx } = geminiProviderInstance._resolveApiKey(allKeys);
      poolStats.attempts++;

      try {
        let url, requestBody;
        if (isImagenPredict) {
          url = `${this.baseUrl}/${modelPath}:predict?key=${encodeURIComponent(key)}`;
          requestBody = {
            instances: [{ prompt: fullPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
              outputMimeType: 'image/jpeg'
            }
          };
        } else {
          url = `${this.baseUrl}/${modelPath}:generateContent?key=${encodeURIComponent(key)}`;
          requestBody = {
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `Generate an image based on this description${aspectHint}: ${fullPrompt}` }
                ]
              }
            ],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT']
            }
          };
        }

        const response = await fetchFn(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: signal || AbortSignal.timeout(90000)
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const safeErrText = this._maskSecrets(errText.slice(0, 180));
          const err = new Error(`HTTP ${response.status} key#${idx + 1}: ${safeErrText}`);
          err.status = response.status;
          throw err;
        }

        const data = await response.json();
        let base64Data = null;
        let mimeType = 'image/jpeg';

        if (isImagenPredict) {
          base64Data = data.predictions?.[0]?.bytesBase64Encoded || data.predictions?.[0]?.inlineData?.data;
          mimeType = data.predictions?.[0]?.mimeType || 'image/jpeg';
        } else {
          const imagePart = data.output?.find(part => part.inlineData?.data)
            || data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data);
          if (imagePart) {
            base64Data = imagePart.inlineData.data;
            mimeType = imagePart.inlineData.mimeType || 'image/png';
          }
        }

        if (!base64Data || typeof base64Data !== 'string') {
          throw new Error(`Empty image data returned from Gemini for key#${idx + 1}`);
        }

        const rawBuffer = Buffer.from(base64Data, 'base64');
        if (rawBuffer.length === 0) {
          throw new Error(`Decoded image buffer is empty`);
        }

        // Pass through ImageOutputSizePolicy (< 1 MB)
        const policyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(rawBuffer);
        if (!policyResult.success || !policyResult.buffer || policyResult.buffer.length >= MAX_IMAGE_BYTES) {
          throw new Error(`Output failed size policy: ${policyResult.error || 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED'}`);
        }

        const finalBuffer = policyResult.buffer;
        const finalWidth = policyResult.width || reqWidth || (aspectRatio === '9:16' ? 512 : 912);
        const finalHeight = policyResult.height || reqHeight || (aspectRatio === '9:16' ? 912 : 512);
        const finalMime = policyResult.mimeType || mimeType;
        const durationMs = Date.now() - t0;

        // STEP 6: Diagnostic SUCCESS log
        console.log(
          `[ImageGeneration]\n` +
          `Provider: GEMINI\n` +
          `Status: SUCCESS\n` +
          `Model: ${model}\n` +
          `RequestId: ${requestId}\n` +
          `DurationMs: ${durationMs}\n` +
          `Width: ${finalWidth}\n` +
          `Height: ${finalHeight}\n` +
          `MimeType: ${finalMime}\n` +
          `OutputBytes: ${finalBuffer.length}`
        );

        return {
          success: true,
          buffer: finalBuffer,
          bytes: finalBuffer,
          width: finalWidth,
          height: finalHeight,
          mimeType: finalMime,
          model,
          provider: this.providerName,
          requestId,
          sizeBytes: finalBuffer.length,
          durationMs
        };
      } catch (err) {
        const safeMsg = this._maskSecrets(err.message);
        console.warn(`[ImageGeneration] Gemini attempt failed for key#${idx + 1}: ${safeMsg}`);
        geminiProviderInstance._markKeyCooldown(idx, 60000, err.message);

        // Structured classification: count each failure by category
        const status = err.status ?? err.statusCode ?? null;
        const category = this._classifyHttpError(status);
        switch (category) {
          case 'QUOTA': poolStats.quotaFailures++; break;
          case 'AUTH': poolStats.authFailures++; break;
          case 'PERMISSION': poolStats.permissionFailures++; break;
          case 'INVALID_REQUEST': poolStats.invalidRequestFailures++; break;
          case 'NOT_FOUND': poolStats.notFoundFailures++; break;
          case 'SERVER_ERROR': poolStats.serverErrorFailures++; break;
          default: poolStats.otherFailures++; break;
        }
      }
    }

    // All keys exhausted: build aggregated pool diagnosis (NOT lastError)
    const diagnosis = this._buildPoolDiagnosis(poolStats, model, requestId);
    const safeError = this._maskSecrets(`All ${poolStats.attempts} Gemini API keys exhausted`);
    console.error(
      `[ImageGeneration] Provider: GEMINI | RequestId: ${requestId} | ` +
      `FAILED: ${diagnosis.code} | attempts=${poolStats.attempts} ` +
      `quota=${poolStats.quotaFailures} perm=${poolStats.permissionFailures} ` +
      `auth=${poolStats.authFailures} other=${poolStats.otherFailures}`
    );

    return {
      success: false,
      error: `IMAGE_GENERATION_FAILED: ${safeError}`,
      reasonCode: diagnosis.code,
      status: diagnosis.status,
      code: diagnosis.code,
      fallbackEligible: diagnosis.fallbackEligible,
      attempts: poolStats.attempts,
      quotaFailures: poolStats.quotaFailures,
      permissionFailures: poolStats.permissionFailures,
      authFailures: poolStats.authFailures,
      provider: this.providerName,
      model,
      requestId
    };
  }
}

export const geminiImageAdapterInstance = new GeminiImageAdapter();
export default geminiImageAdapterInstance;
