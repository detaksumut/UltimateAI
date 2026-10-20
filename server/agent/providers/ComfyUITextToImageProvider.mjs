/**
 * ComfyUITextToImageProvider.mjs
 * Production-ready text-to-image Adapter for local ComfyUI instance (default port 8188).
 *
 * Implements TRUE text-to-image:
 * 1. Builds a txt2img workflow: EmptyLatentImage → CheckpointLoaderSimple → CLIPTextEncode
 *    (pos/neg) → KSampler → VAEDecode → SaveImage
 * 2. Dispatches via ComfyUI /prompt, gets prompt_id.
 * 3. Monitors execution via /history polling (WebSocket-free, CPU-safe).
 * 4. Retrieves the resulting image bytes via /view endpoint.
 * 5. Returns raw generated image buffer.
 *
 * Mirrors ComfyUIImageEditingProvider.mjs conventions:
 * - steps strictly 8 on CPU
 * - 512x512 canvas default
 * - timeout/polling from env
 */

import { IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_STEPS, IMAGE_DENOISE } from '../ImageOutputConfig.mjs';

export const COMFYUI_TXT2IMG_EXECUTION_TIMEOUT_MS = parseInt(
  process.env.COMFYUI_EXECUTION_TIMEOUT_MS || String(30 * 60 * 1000),
  10
); // 30 minutes CPU-safe default
export const COMFYUI_TXT2IMG_POLLING_INTERVAL_MS = parseInt(
  process.env.COMFYUI_POLLING_INTERVAL_MS || '2000',
  10
); // 2 seconds

export const COMFYUI_TXT2IMG_STEPS = IMAGE_STEPS || 8;
export const COMFYUI_TXT2IMG_WIDTH = IMAGE_WIDTH;
export const COMFYUI_TXT2IMG_HEIGHT = IMAGE_HEIGHT;
export const COMFYUI_TXT2IMG_CFG = parseFloat(process.env.COMFYUI_CFG_SCALE || '7.5');
export const COMFYUI_TXT2IMG_SAMPLER = process.env.COMFYUI_SAMPLER || 'euler';
export const COMFYUI_TXT2IMG_SCHEDULER = process.env.COMFYUI_SCHEDULER || 'karras';

export class ComfyUITextToImageProvider {
  constructor(options = {}) {
    this.name = 'COMFYUI';
    this.baseUrl = options.baseUrl || process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
    this.defaultSteps = 8;
    this.defaultCfg = options.defaultCfg ?? COMFYUI_TXT2IMG_CFG;
    this.defaultSampler = options.defaultSampler || COMFYUI_TXT2IMG_SAMPLER;
    this.defaultScheduler = options.defaultScheduler || COMFYUI_TXT2IMG_SCHEDULER;
    this.maxWidth = options.maxWidth || COMFYUI_TXT2IMG_WIDTH;
    this.maxHeight = options.maxHeight || COMFYUI_TXT2IMG_HEIGHT;
    this.timeoutMs = options.timeoutMs || COMFYUI_TXT2IMG_EXECUTION_TIMEOUT_MS;
    this.pollingIntervalMs = options.pollingIntervalMs || COMFYUI_TXT2IMG_POLLING_INTERVAL_MS;
    this.checkpoint = options.checkpoint || process.env.COMFYUI_MODEL || 'v1-5-pruned-emaonly.safetensors';
  }

  /** Capability probe for text-to-image provider. */
  async capabilityProbe(transport = null) {
    const fetchFn = transport?.fetch || globalThis.fetch;
    try {
      const res = await fetchFn(`${this.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const stats = await res.json().catch(() => ({}));
        return {
          available: true,
          provider: this.name,
          reason: `ComfyUI online on ${this.baseUrl}`,
          textToImage: true,
          imageToImage: false,
          systemStats: stats
        };
      }
    } catch {
      // ComfyUI server is offline
    }
    return {
      available: false,
      provider: this.name,
      reason: `ComfyUI is offline or unreachable at ${this.baseUrl}`,
      textToImage: false,
      imageToImage: false
    };
  }

  /** Build pure txt2img workflow for ComfyUI. STRICT POLICY: steps must strictly equal 8 on CPU. */
  _buildTxt2ImgWorkflow({
    prompt,
    negativePrompt = '',
    seed = 42,
    steps = 8,
    cfg = this.defaultCfg,
    sampler = this.defaultSampler,
    scheduler = this.defaultScheduler,
    width = COMFYUI_TXT2IMG_WIDTH,
    height = COMFYUI_TXT2IMG_HEIGHT
  }) {
    const finalSteps = Number(steps || 8);
    if (finalSteps !== 8) {
      throw new Error(`[COMFYUI_TXT2IMG_WORKFLOW_POLICY_VIOLATION] KSampler steps must strictly be 8, received ${steps}`);
    }
    const workflow = {
      '3': {
        inputs: {
          seed: seed,
          steps: 8,
          cfg: cfg,
          sampler_name: sampler,
          scheduler: scheduler,
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0]
        },
        class_type: 'KSampler'
      },
      '4': {
        inputs: { ckpt_name: this.checkpoint },
        class_type: 'CheckpointLoaderSimple'
      },
      '5': {
        inputs: { width: width, height: height, batch_size: 1 },
        class_type: 'EmptyLatentImage'
      },
      '6': {
        inputs: { text: prompt, clip: ['4', 1] },
        class_type: 'CLIPTextEncode'
      },
      '7': {
        inputs: { text: negativePrompt || 'blurry, low quality, distorted', clip: ['4', 1] },
        class_type: 'CLIPTextEncode'
      },
      '8': {
        inputs: { samples: ['3', 0], vae: ['4', 2] },
        class_type: 'VAEDecode'
      },
      '9': {
        inputs: { filename_prefix: 'JIN_TXT2IMG', images: ['8', 0] },
        class_type: 'SaveImage'
      }
    };
    return workflow;
  }
  /** Execute text-to-image generation on local ComfyUI. */
  async generateTextToImage(params, transport = null) {
    const fetchFn = transport?.fetch || globalThis.fetch;
    const {
      prompt,
      negativePrompt = '',
      aspectRatio = '16:9',
      width = COMFYUI_TXT2IMG_WIDTH,
      height = COMFYUI_TXT2IMG_HEIGHT,
      seed = Math.floor(Math.random() * 2147483647),
      signal,
      requestId = null
    } = params;

    // Strict Workflow Policy Guard: steps must strictly be 8 on CPU
    const requestedSteps = params.steps !== undefined && params.steps !== null ? Number(params.steps) : 8;
    if (requestedSteps !== 8) {
      console.error(`[COMFYUI_TXT2IMG] VIOLATION: requested steps=${requestedSteps} != 8`);
      return {
        success: false,
        error: `[COMFYUI_TXT2IMG_WORKFLOW_POLICY_VIOLATION] steps=8 strictly mandated on CPU (received steps=${requestedSteps}).`,
        reasonCode: 'COMFYUI_TXT2IMG_WORKFLOW_POLICY_VIOLATION'
      };
    }
    const steps = 8;

    const probe = await this.capabilityProbe({ fetchFn });
    if (!probe.available) {
      return {
        success: false,
        error: `[ComfyUI] Provider unavailable: ${probe.reason}`,
        reasonCode: 'PROVIDER_UNAVAILABLE'
      };
    }

    console.log('[COMFYUI_TXT2IMG_EXECUTION]');
    console.log(`steps=${steps}`);
    console.log(`width=${width}`);
    console.log(`height=${height}`);

    const cfg = params.cfg || this.defaultCfg || COMFYUI_TXT2IMG_CFG;
    const sampler = params.sampler || this.defaultSampler || COMFYUI_TXT2IMG_SAMPLER;
    const scheduler = params.scheduler || this.defaultScheduler || COMFYUI_TXT2IMG_SCHEDULER;

    let promptId;
    const workflow = this._buildTxt2ImgWorkflow({
      prompt,
      negativePrompt,
      seed,
      steps,
      cfg,
      sampler,
      scheduler,
      width,
      height
    });

    // Mandatory invariants & assertions
    const ksamplerNode = Object.values(workflow).find((n) => n.class_type === 'KSampler');
    const widthValue = workflow['5']?.inputs?.width;
    const heightValue = workflow['5']?.inputs?.height;
    if (ksamplerNode?.inputs?.steps !== 8 || widthValue !== width || heightValue !== height) {
      console.error(`[COMFYUI_TXT2IMG_WORKFLOW_POLICY_VIOLATION] Assertion failure: steps=${ksamplerNode?.inputs?.steps} (expected 8), width=${widthValue} (expected ${width}), height=${heightValue} (expected ${height})`);
      return {
        success: false,
        error: `[COMFYUI_TXT2IMG_WORKFLOW_POLICY_VIOLATION] Assertion failed: steps === 8 && width === ${width} && height === ${height}`,
        reasonCode: 'COMFYUI_TXT2IMG_WORKFLOW_POLICY_VIOLATION'
      };
    }

    // 1. Dispatch workflow via /prompt
    let promptRes;
    try {
      promptRes = await fetchFn(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: requestId || `jin-${Date.now()}` }),
        signal: signal || AbortSignal.timeout(60000)
      });
    } catch (err) {
      return {
        success: false,
        error: `Failed to dispatch ComfyUI workflow: ${err.message}`,
        reasonCode: 'PROVIDER_EXECUTION_FAILED'
      };
    }

    if (!promptRes.ok) {
      const errText = await promptRes.text().catch(() => '');
      return {
        success: false,
        error: `ComfyUI /prompt rejected (HTTP ${promptRes.status}): ${errText.slice(0, 200)}`,
        reasonCode: 'PROMPT_DISPATCH_FAILED'
      };
    }

    const promptData = await promptRes.json().catch(() => ({}));
    promptId = promptData.prompt_id;
    if (!promptId) {
      return {
        success: false,
        error: 'ComfyUI /prompt returned no prompt_id',
        reasonCode: 'NO_PROMPT_ID'
      };
    }

    console.log(`[COMFYUI_TXT2IMG] promptId=${promptId}`);

    // 2. Poll /history until execution completes
    const startTime = Date.now();
    let outputImageInfo = null;
    let lastStatus = 'RUNNING';
    while (Date.now() - startTime < this.timeoutMs) {
      try {
        const histRes = await fetchFn(`${this.baseUrl}/history/${promptId}`, {
          signal: signal || AbortSignal.timeout(10000)
        });
        if (histRes.ok) {
          const hist = await histRes.json().catch(() => ({}));
          const entry = hist[promptId];
          if (entry) {
            lastStatus = entry.status?.completed ? 'COMPLETED' : (entry.status?.failed ? 'FAILED' : 'RUNNING');
            const outputs = entry.outputs || {};
            for (const nodeId of Object.keys(outputs)) {
              const out = outputs[nodeId];
              if (out && Array.isArray(out.images) && out.images.length > 0) {
                const img = out.images[0];
                outputImageInfo = {
                  filename: img.filename,
                  subfolder: img.subfolder || '',
                  type: img.type || 'output'
                };
                break;
              }
            }
            if (lastStatus === 'COMPLETED' || lastStatus === 'FAILED') break;
          }
        }
      } catch {
        // history not ready yet; keep polling
      }
      if (outputImageInfo) break;
      await new Promise((r) => setTimeout(r, this.pollingIntervalMs));
    }

    if (!outputImageInfo) {
      const elapsedMs = Date.now() - startTime;
      return {
        success: false,
        error: `ComfyUI text-to-image execution did not produce output after ${Math.round(elapsedMs / 1000)}s (promptId: ${promptId})`,
        reasonCode: 'OUTPUT_NOT_FOUND',
        promptId,
        elapsedMs,
        lastStatus
      };
    }

    if (lastStatus === 'FAILED') {
      return {
        success: false,
        error: `ComfyUI text-to-image execution FAILED (promptId: ${promptId})`,
        reasonCode: 'EXECUTION_FAILED',
        promptId
      };
    }

    // 3. Download output image via /view
    try {
      const viewUrl = `${this.baseUrl}/view?filename=${encodeURIComponent(outputImageInfo.filename)}&subfolder=${encodeURIComponent(outputImageInfo.subfolder || '')}&type=${encodeURIComponent(outputImageInfo.type || 'output')}`;
      const viewRes = await fetchFn(viewUrl);
      if (!viewRes.ok) {
        return {
          success: false,
          error: `Failed to download output image from ComfyUI (HTTP ${viewRes.status})`,
          reasonCode: 'OUTPUT_NOT_FOUND',
          promptId
        };
      }

      const outputBuffer = Buffer.from(await viewRes.arrayBuffer());

      const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const isPng = outputBuffer.length >= 8 && outputBuffer.subarray(0, 8).equals(PNG_MAGIC);
      const isJpeg = outputBuffer.length >= 3 && outputBuffer[0] === 0xFF && outputBuffer[1] === 0xD8 && outputBuffer[2] === 0xFF;
      if (!isPng && !isJpeg && outputBuffer.length < 1024) {
        return {
          success: false,
          error: 'ComfyUI returned invalid or corrupted image bytes.',
          reasonCode: 'OUTPUT_INVALID',
          promptId
        };
      }

      console.log(`[COMFYUI_TXT2IMG_OUTPUT] filename=${outputImageInfo.filename}`);
      console.log(`[COMFYUI_TXT2IMG_OUTPUT] bytes=${outputBuffer.length}`);
      console.log(`[COMFYUI_TXT2IMG_OUTPUT] retrieved=true`);

      return {
        success: true,
        imageBuffer: outputBuffer,
        filename: outputImageInfo.filename,
        mimeType: outputImageInfo.filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
        model: this.checkpoint,
        promptId,
        steps,
        width,
        height,
        elapsedMs: Date.now() - startTime
      };
    } catch (downloadErr) {
      return {
        success: false,
        error: `Failed to download output image: ${downloadErr.message}`,
        reasonCode: 'OUTPUT_NOT_FOUND',
        promptId
      };
    }
  }

  async isAvailable() {
    const probe = await this.capabilityProbe();
    return Boolean(probe.available);
  }
}

export const comfyuiTextToImageProviderInstance = new ComfyUITextToImageProvider();
export default comfyuiTextToImageProviderInstance;

