/**
 * ComfyUIImageEditingProvider.mjs
 * Production-ready Adapter for local ComfyUI instance (default port 8188).
 * 
 * Implements TRUE Image-to-Image / Inpainting / Image Editing:
 * 1. Uploads physical source image buffer to ComfyUI /upload/image endpoint.
 * 2. Connects uploaded image into the workflow via LoadImage node -> VAEEncode -> KSampler / img2img denoise.
 * 3. Monitors execution progress through ComfyUI WebSocket or polling /history.
 * 4. Retrieves the resulting image bytes via /view endpoint.
 * 5. Returns raw generated image buffer.
 */

import { ImageEditingProvider } from './ImageEditingProvider.mjs';

import { IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_STEPS, IMAGE_DENOISE } from '../ImageOutputConfig.mjs';

export const COMFYUI_EXECUTION_TIMEOUT_MS = parseInt(
  process.env.COMFYUI_EXECUTION_TIMEOUT_MS || String(30 * 60 * 1000),
  10
); // 30 minutes CPU-safe default
export const COMFYUI_POLLING_INTERVAL_MS = parseInt(
  process.env.COMFYUI_POLLING_INTERVAL_MS || '2000',
  10
); // 2 seconds

/// Production CPU Optimization Defaults - STRICT POLICY: steps must always be 8 on CPU, width/height 512x512, denoise 0.75
export const COMFYUI_IMG2IMG_STEPS = IMAGE_STEPS || 8;
export const COMFYUI_IMG2IMG_WIDTH = IMAGE_WIDTH;
export const COMFYUI_IMG2IMG_HEIGHT = IMAGE_HEIGHT;
export const COMFYUI_IMG2IMG_DENOISE = parseFloat(
  process.env.COMFYUI_IMG2IMG_DENOISE || String(IMAGE_DENOISE || 0.52)
);
export const COMFYUI_IMG2IMG_CFG = parseFloat(
  process.env.COMFYUI_IMG2IMG_CFG || '7.5'
);
export const COMFYUI_IMG2IMG_SAMPLER = process.env.COMFYUI_IMG2IMG_SAMPLER || 'euler';
export const COMFYUI_IMG2IMG_SCHEDULER = process.env.COMFYUI_IMG2IMG_SCHEDULER || 'normal';

export class ComfyUIImageEditingProvider extends ImageEditingProvider {
  constructor(options = {}) {
    super('COMFYUI');
    this.baseUrl = options.baseUrl || process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
    this.defaultDenoise = options.defaultDenoise ?? COMFYUI_IMG2IMG_DENOISE;
    if (options.defaultSteps !== undefined && options.defaultSteps !== null && Number(options.defaultSteps) !== 8) {
      throw new Error(`[IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION] ComfyUI defaultSteps must strictly be 8 on CPU, received ${options.defaultSteps}`);
    }
    this.defaultSteps = 8;
    this.defaultCfg = options.defaultCfg ?? COMFYUI_IMG2IMG_CFG;
    this.defaultSampler = options.defaultSampler || COMFYUI_IMG2IMG_SAMPLER;
    this.defaultScheduler = options.defaultScheduler || COMFYUI_IMG2IMG_SCHEDULER;
    this.maxWidth = options.maxWidth || COMFYUI_IMG2IMG_WIDTH;
    this.maxHeight = options.maxHeight || COMFYUI_IMG2IMG_HEIGHT;
    this.timeoutMs = options.timeoutMs || COMFYUI_EXECUTION_TIMEOUT_MS;
    this.pollingIntervalMs = options.pollingIntervalMs || COMFYUI_POLLING_INTERVAL_MS;
  }

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
          textToImage: false,
          imageToImage: true,
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
      imageToImage: true
    };
  }

  /**
   * Scale input buffer to exact dimensions (default 512x512).
   * Ensures image is physically 512x512 for CPU execution and memory safety.
   */
  async _prepareInputBuffer(buffer, maxWidth = this.maxWidth, maxHeight = this.maxHeight) {
    const targetW = maxWidth || 512;
    const targetH = maxHeight || 512;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { buffer, width: targetW, height: targetH };
    }

    try {
      const Jimp = (await import('jimp')).default;
      const img = await Jimp.read(buffer);
      const origW = img.bitmap.width;
      const origH = img.bitmap.height;

      // If already physically targetW x targetH, return unchanged
      if (origW === targetW && origH === targetH) {
        return { buffer, width: origW, height: origH, originalWidth: origW, originalHeight: origH };
      }

      // Physically resize to target 512x512
      img.resize(targetW, targetH, Jimp.RESIZE_BILINEAR);
      const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
      const mime = isPng ? Jimp.MIME_PNG : Jimp.MIME_JPEG;
      const resizedBuffer = await img.getBufferAsync(mime);

      return {
        buffer: resizedBuffer,
        width: targetW,
        height: targetH,
        originalWidth: origW,
        originalHeight: origH
      };
    } catch (err) {
      console.warn(`[COMFYUI_INPUT] Could not scale input buffer: ${err.message}`);
      return { buffer, width: targetW, height: targetH };
    }
  }

  /**
   * Upload image buffer to ComfyUI
   * @param {Buffer} buffer
   * @param {string} filename
   * @param {string} mimeType
   * @param {Function} fetchFn
   * @returns {Promise<string>} Uploaded filename in ComfyUI input folder
   */
  async _uploadImage(buffer, filename, mimeType, fetchFn) {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('image', blob, filename);
    formData.append('overwrite', 'true');

    const res = await fetchFn(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`ComfyUI image upload failed (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.name || filename;
  }

  /**
   * Build pure Img2Img workflow for ComfyUI.
   * STRICT POLICY: steps must strictly equal 4 on CPU.
   */
  _buildImg2ImgWorkflow({
    uploadedFilename,
    uploadedMaskFilename = null,
    prompt,
    negativePrompt = '',
    seed = 42,
    steps = 8,
    cfg = this.defaultCfg,
    sampler = this.defaultSampler,
    scheduler = this.defaultScheduler,
    denoise = this.defaultDenoise,
    width = IMAGE_WIDTH,
    height = IMAGE_HEIGHT
  }) {
    const finalSteps = Number(steps || 8);
    if (finalSteps !== 8) {
      throw new Error(`[IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION] KSampler steps must strictly be 8, received ${steps}`);
    }
    const workflow = {
      "3": {
        "inputs": {
          "seed": seed,
          "steps": 8,
          "cfg": cfg,
          "sampler_name": sampler,
          "scheduler": scheduler,
          "denoise": denoise,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": "v1-5-pruned-emaonly.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": uploadedMaskFilename ? {
        "inputs": {
          "pixels": ["11", 0],
          "vae": ["4", 2],
          "mask": ["12", 0],
          "grow_mask_by": 6
        },
        "class_type": "VAEEncodeForInpaint"
      } : {
        "inputs": {
          "pixels": ["11", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEEncode"
      },
      "6": {
        "inputs": {
          "text": prompt,
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": negativePrompt || "blurry, low quality, distorted",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": "JIN_IMG2IMG",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      },
      "10": {
        "inputs": {
          "image": uploadedFilename,
          "upload": "image"
        },
        "class_type": "LoadImage"
      },
      "11": {
        "inputs": {
          "image": ["10", 0],
          "upscale_method": "bilinear",
          "width": width,
          "height": height,
          "crop": "disabled"
        },
        "class_type": "ImageScale"
      }
    };

    if (uploadedMaskFilename) {
      workflow["12"] = {
        "inputs": {
          "image": uploadedMaskFilename,
          "channel": "red",
          "upload": "image"
        },
        "class_type": "LoadImageMask"
      };
    }

    return workflow;
  }

  async editImage(params, transport = null) {
    const fetchFn = transport?.fetch || globalThis.fetch;
    const {
      referenceImageBuffer,
      referenceMimeType = 'image/jpeg',
      referenceArtifactId = 'source',
      prompt,
      negativePrompt,
      seed = Math.floor(Math.random() * 2147483647),
      signal,
      requestId = params.requestId || null
    } = params;

    // Strict invariant: must receive actual image bytes
    if (!referenceImageBuffer || !Buffer.isBuffer(referenceImageBuffer) || referenceImageBuffer.length === 0) {
      return {
        success: false,
        error: '[ComfyUI] Reference image buffer is missing or empty. True image-to-image requires raw image bytes.',
        reasonCode: 'PROVIDER_EXECUTION_FAILED'
      };
    }

    // Strict Workflow Policy Guard: steps must strictly be 8 on CPU
    const requestedSteps = params.steps !== undefined && params.steps !== null ? Number(params.steps) : 8;
    if (requestedSteps !== 8) {
      console.error(`[IMAGE_REVISION] VIOLATION: requested steps=${requestedSteps} != 8`);
      console.log(`[IMAGE_REVISION] execution=FAILED reason=IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION`);
      return {
        success: false,
        error: `[IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION] IMAGE_REVISION policy strictly mandates steps=8 on CPU (received steps=${requestedSteps}). 20-step or non-8-step workflows are strictly prohibited.`,
        reasonCode: 'IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION'
      };
    }
    const steps = 8;

    const probe = await this.capabilityProbe(transport);
    if (!probe.available) {
      return {
        success: false,
        error: `[ComfyUI] Provider unavailable: ${probe.reason}`,
        reasonCode: 'PROVIDER_UNAVAILABLE'
      };
    }

    console.log('[COMFYUI_EXECUTION]');
    console.log('steps=8');

    const cfg = params.cfg || this.defaultCfg || COMFYUI_IMG2IMG_CFG;
    const sampler = params.sampler || this.defaultSampler || COMFYUI_IMG2IMG_SAMPLER;
    const scheduler = params.scheduler || this.defaultScheduler || COMFYUI_IMG2IMG_SCHEDULER;
    const denoise = params.denoise !== undefined && params.denoise !== null ? Number(params.denoise) : (this.defaultDenoise ?? COMFYUI_IMG2IMG_DENOISE);
    const targetWidth = params.width || params.maxWidth || this.maxWidth || COMFYUI_IMG2IMG_WIDTH;
    const targetHeight = params.height || params.maxHeight || this.maxHeight || COMFYUI_IMG2IMG_HEIGHT;

    let promptId;
    let enhancedPromptObj = null;
    let prepared = { buffer: referenceImageBuffer, width: targetWidth, height: targetHeight };
    try {
      prepared = await this._prepareInputBuffer(referenceImageBuffer, targetWidth, targetHeight);
      const ext = referenceMimeType.includes('png') ? 'png' : 'jpg';
      const uploadName = `input_${Date.now()}_${referenceArtifactId}.${ext}`;

      // 1. Upload the physical 512x512 scaled image bytes
      const uploadedFilename = await this._uploadImage(prepared.buffer, uploadName, referenceMimeType, fetchFn);

      // 1.1 Upload mask buffer if provided (Inpainting mode)
      let uploadedMaskFilename = null;
      if (params.maskBuffer && Buffer.isBuffer(params.maskBuffer) && params.maskBuffer.length > 0) {
        const maskUploadName = `mask_${Date.now()}_${referenceArtifactId}.png`;
        uploadedMaskFilename = await this._uploadImage(params.maskBuffer, maskUploadName, 'image/png', fetchFn);
        console.log(`[COMFYUI_INPAINT_MASK] uploadedMaskFilename=${uploadedMaskFilename}`);
      }

      // 1.5 Use direct prompt from user
      const effectivePrompt = prompt || params.originalPrompt || '';
      const effectiveNegativePrompt = negativePrompt || '';
      const effectiveDenoise = uploadedMaskFilename ? (params.denoise !== undefined && params.denoise !== null ? Number(params.denoise) : 0.75) : denoise;

      // 2. Dispatch workflow connecting LoadImage(uploadedFilename) -> VAEEncode/VAEEncodeForInpaint -> KSampler
      const workflow = this._buildImg2ImgWorkflow({
        uploadedFilename,
        uploadedMaskFilename,
        prompt: effectivePrompt,
        negativePrompt: effectiveNegativePrompt,
        seed,
        steps,
        cfg,
        sampler,
        scheduler,
        denoise: effectiveDenoise
      });

      const ksamplerNode = Object.values(workflow).find(n => n.class_type === 'KSampler');
      const imageScaleNode = Object.values(workflow).find(n => n.class_type === 'ImageScale');
      const workflowKSamplerSteps = ksamplerNode?.inputs?.steps;
      const workflowScaleWidth = imageScaleNode?.inputs?.width;
      const workflowScaleHeight = imageScaleNode?.inputs?.height;
      const width = prepared.width;
      const height = prepared.height;

      console.log('[COMFYUI_REVISION_POLICY]');
      console.log(`steps=${steps}`);
      console.log(`denoise=${effectiveDenoise}`);
      console.log(`width=${width}`);
      console.log(`height=${height}`);

      console.log('[COMFYUI_PROMPT_PAYLOAD]');
      console.log(`steps=${steps}`);
      console.log(`width=${width}`);
      console.log(`height=${height}`);
      console.log(`denoise=${effectiveDenoise}`);
      console.log(`workflowKSamplerSteps=${workflowKSamplerSteps}`);
      console.log(`promptId=${requestId || referenceArtifactId}`);

      // Mandatory Invariants & Assertions:
      // workflowKSamplerSteps === 8
      // width === 512
      // height === 512
      // denoise <= 0.75
      if (
        workflowKSamplerSteps !== 8 ||
        width !== 512 ||
        height !== 512 ||
        effectiveDenoise > 0.75 ||
        workflowScaleWidth !== 512 ||
        workflowScaleHeight !== 512
      ) {
        console.error(`[IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION] Assertion failure: workflowKSamplerSteps=${workflowKSamplerSteps} (expected 8), width=${width} (expected 512), height=${height} (expected 512), denoise=${denoise} (expected <= 0.75), scaleWidth=${workflowScaleWidth}, scaleHeight=${workflowScaleHeight}`);
        console.log(`[IMAGE_REVISION] execution=FAILED reason=IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION`);
        return {
          success: false,
          error: `[IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION] Assertion failed: workflowKSamplerSteps === 8 && width === 512 && height === 512 && denoise <= 0.75 (received steps=${workflowKSamplerSteps}, width=${width}, height=${height}, denoise=${denoise})`,
          reasonCode: 'IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION'
        };
      }

      const promptRes = await fetchFn(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
        signal: signal || AbortSignal.timeout(60000)
      });

      if (!promptRes.ok) {
        const errText = await promptRes.text().catch(() => '');
        return {
          success: false,
          error: `ComfyUI queue prompt failed HTTP ${promptRes.status}: ${errText.slice(0, 150)}`,
          reasonCode: 'PROVIDER_EXECUTION_FAILED'
        };
      }

      const promptData = await promptRes.json();
      promptId = promptData.prompt_id;

      console.log('[COMFYUI_PROMPT_SUBMIT]');
      console.log(`requestId=${requestId || 'unknown'}`);
      console.log(`promptId=${promptId}`);
      console.log(`steps=${workflowKSamplerSteps}`);
      console.log(`timestamp=${new Date().toISOString()}`);
    } catch (uploadOrPromptErr) {
      return {
        success: false,
        error: `[ComfyUI] Failed to queue prompt: ${uploadOrPromptErr.message}`,
        reasonCode: 'PROVIDER_EXECUTION_FAILED'
      };
    }

    console.log(`[COMFYUI_EXECUTION] promptId=${promptId}`);
    console.log(`[COMFYUI_EXECUTION] steps=${steps} width=${prepared.width} height=${prepared.height}`);

    // 3. Poll /history/{promptId} until finished or timeout
    const timeoutMs = params.timeoutMs || this.timeoutMs || COMFYUI_EXECUTION_TIMEOUT_MS;
    const pollingIntervalMs = params.pollingIntervalMs || this.pollingIntervalMs || COMFYUI_POLLING_INTERVAL_MS;
    const startTime = Date.now();
    let outputImageInfo = null;
    let lastStatus = 'RUNNING';

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, pollingIntervalMs));

      if (signal?.aborted) {
        return {
          success: false,
          error: 'ComfyUI execution aborted by client signal.',
          reasonCode: 'ABORTED',
          promptId
        };
      }

      let histRes;
      try {
        histRes = await fetchFn(`${this.baseUrl}/history/${promptId}`);
      } catch (pollErr) {
        console.warn(`[COMFYUI_POLL] Transient error polling history: ${pollErr.message}`);
        continue;
      }

      if (histRes.ok) {
        const histData = await histRes.json().catch(() => ({}));
        const entry = histData[promptId];
        if (entry) {
          const status = entry.status || {};
          if (status.completed === true) {
            const elapsedMs = Date.now() - startTime;
            if (status.status_str === 'success' || !status.status_str) {
              console.log('[COMFYUI_EXECUTION]');
              console.log(`promptId=${promptId}`);
              console.log(`steps=${steps}`);
              console.log(`denoise=${denoise}`);
              console.log(`width=${prepared.width}`);
              console.log(`height=${prepared.height}`);
              console.log(`elapsedMs=${elapsedMs}`);
              console.log(`[COMFYUI_EXECUTION] status=SUCCESS elapsedMs=${elapsedMs}`);
              lastStatus = 'SUCCESS';

              // Inspect outputs
              const outputs = entry.outputs || {};
              for (const nodeOutputs of Object.values(outputs)) {
                if (nodeOutputs.images && nodeOutputs.images.length > 0) {
                  outputImageInfo = nodeOutputs.images[0];
                  break;
                }
              }

              if (!outputImageInfo) {
                return {
                  success: false,
                  error: 'ComfyUI execution completed but produced no output image.',
                  reasonCode: 'OUTPUT_NOT_FOUND',
                  promptId,
                  elapsedMs
                };
              }
              break;
            } else {
              console.log(`[COMFYUI_EXECUTION] status=FAILED elapsedMs=${elapsedMs}`);
              lastStatus = status.status_str || 'FAILED';
              return {
                success: false,
                error: `ComfyUI execution failed with status: ${status.status_str || 'error'}`,
                reasonCode: 'PROVIDER_EXECUTION_FAILED',
                promptId,
                elapsedMs,
                status
              };
            }
          } else {
            const elapsedMs = Date.now() - startTime;
            console.log(`[COMFYUI_EXECUTION] status=RUNNING elapsedMs=${elapsedMs}`);
            lastStatus = 'RUNNING';
          }
        } else {
          const elapsedMs = Date.now() - startTime;
          console.log(`[COMFYUI_EXECUTION] status=RUNNING elapsedMs=${elapsedMs}`);
          lastStatus = 'RUNNING';
        }
      }
    }

    if (!outputImageInfo) {
      const elapsedMs = Date.now() - startTime;
      console.log(`[COMFYUI_EXECUTION] status=TIMEOUT elapsedMs=${elapsedMs}`);

      let stillRunning = false;
      try {
        const qRes = await fetchFn(`${this.baseUrl}/queue`);
        if (qRes.ok) {
          const qData = await qRes.json().catch(() => ({}));
          const running = qData.queue_running || [];
          const pending = qData.queue_pending || [];
          stillRunning = [...running, ...pending].some(item =>
            item && (item[1] === promptId || item.prompt_id === promptId)
          );
        }
      } catch {}

      return {
        success: false,
        error: `ComfyUI execution timed out after ${Math.round(elapsedMs / 1000)}s (promptId: ${promptId})`,
        reasonCode: 'PROVIDER_TIMEOUT',
        promptId,
        elapsedMs,
        lastStatus,
        stillRunning
      };
    }

    // 4. Download output image via /view
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

      console.log(`[COMFYUI_OUTPUT] filename=${outputImageInfo.filename}`);
      console.log(`[COMFYUI_OUTPUT] bytes=${outputBuffer.length}`);
      console.log(`[COMFYUI_OUTPUT] retrieved=true`);

      return {
        success: true,
        imageBuffer: outputBuffer,
        filename: outputImageInfo.filename,
        mimeType: outputImageInfo.filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
        model: 'ComfyUI-img2img',
        promptId,
        steps,
        denoise,
        width: prepared.width,
        height: prepared.height,
        elapsedMs: Date.now() - startTime,
        originalModification: prompt
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
}

export const comfyUIImageEditingProviderInstance = new ComfyUIImageEditingProvider();
export default comfyUIImageEditingProviderInstance;
