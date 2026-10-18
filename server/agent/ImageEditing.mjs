/**
 * ImageEditing.mjs
 * MINIMAL PATH TRUE Image-to-Image / Image Revision Execution Service.
 * 
 * Strict Responsibilities:
 * 1. Accept referenceImage (URL or path) and resolve it to the physical file on disk.
 * 2. Read the actual binary bytes into a Buffer.
 * 3. Pass the physical Buffer and prompt to 9Router Gateway.
 * 4. Persist the revised image as a new artifact with strict parentArtifactId lineage.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { comfyUIImageEditingProviderInstance } from './providers/ComfyUIImageEditingProvider.mjs';
import { mockImageEditingProviderInstance } from './providers/MockImageEditingProvider.mjs';
import { imageOutputSizePolicyInstance, MAX_IMAGE_BYTES, TARGET_IMAGE_BYTES } from './ImageOutputSizePolicy.mjs';
import { IMAGE_WIDTH, IMAGE_HEIGHT } from './ImageOutputConfig.mjs';
import { nineRouterImageEditingProviderInstance } from './providers/NineRouterImageEditingProvider.mjs';

const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const MIN_ARTIFACT_BYTES = 1024;

export class ImageEditingService {
  constructor() {
    this._ensureDirectories();
    this.providers = new Map();
    this.registerProvider('9ROUTER', nineRouterImageEditingProviderInstance);
    this.registerProvider('COMFYUI', comfyUIImageEditingProviderInstance);
    this.registerProvider('MOCK', mockImageEditingProviderInstance);
    this.defaultProvider = (process.env.IMAGE_EDITING_PROVIDER || '9ROUTER').toUpperCase();
  }

  _ensureDirectories() {
    try {
      if (!fs.existsSync(ARTIFACTS_DIR)) {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[ImageEditing] Failed to ensure artifacts dir:', err.message);
    }
  }

  registerProvider(name, providerInstance) {
    this.providers.set(name.toUpperCase(), providerInstance);
  }

  async capabilityProbe(transport = null) {
    const p = this.providers.get(this.defaultProvider);
    if (p) {
      const probe = await p.capabilityProbe(transport);
      return { ...probe, textToImage: false, imageToImage: true };
    }
    return {
      available: false,
      provider: 'NONE',
      reason: 'No image editing backend is currently active.',
      textToImage: false,
      imageToImage: true
    };
  }

  resolveReferenceImage(referenceImage) {
    if (!referenceImage || typeof referenceImage !== 'string') {
      return { success: false, error: 'Reference image identifier is missing or invalid.' };
    }

    let localPath = referenceImage;
    if (referenceImage.startsWith('/api/artifacts/images/')) {
      const filename = path.basename(referenceImage);
      localPath = path.join(ARTIFACTS_DIR, filename);
    } else if (referenceImage.startsWith('/')) {
      localPath = path.join(ARTIFACTS_DIR, path.basename(referenceImage));
    }

    if (!fs.existsSync(localPath)) {
      const altPath = path.resolve(referenceImage);
      if (fs.existsSync(altPath)) {
        localPath = altPath;
      } else {
        return { success: false, error: `Reference image file not found on disk: ${localPath}` };
      }
    }

    try {
      const buffer = fs.readFileSync(localPath);
      if (!buffer || buffer.length < 16) {
        return { success: false, error: `Reference image file is empty or corrupted: ${localPath}` };
      }

      const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC);
      const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const mimeType = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'application/octet-stream';
      const artifactId = path.basename(localPath, path.extname(localPath));

      return { success: true, buffer, mimeType, localPath, artifactId };
    } catch (err) {
      return { success: false, error: `Failed to read reference image: ${err.message}` };
    }
  }

  async editImage(params = {}, transport = null) {
    const {
      referenceImage,
      prompt,
      originalPrompt,
      negativePrompt,
      providerOverride = null,
      generationId = null,
      messageId = null,
      requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      signal = null,
      aspectRatio = null,
      width = null,
      height = null
    } = params;

    console.log(`[IMAGE_REVISION] requestId=${requestId}`);
    console.log(`[IMAGE_REVISION] referenceImage=${referenceImage}`);
    console.log(`[IMAGE_REVISION] mode=IMAGE_TO_IMAGE`);

    // 1. Resolve source image
    const refResolution = this.resolveReferenceImage(referenceImage);
    if (!refResolution.success) {
      return {
        success: false,
        error: `Reference image resolution failed: ${refResolution.error}`,
        reasonCode: 'PROVIDER_EXECUTION_FAILED'
      };
    }

    let selectedProviderName = (providerOverride || process.env.IMAGE_EDITING_PROVIDER || this.defaultProvider || '9ROUTER').toUpperCase();
    let provider = this.providers.get(selectedProviderName) || this.providers.get('9ROUTER');
    selectedProviderName = provider.name;

    const probe = await provider.capabilityProbe(transport);
    if (!probe.available) {
      // ── FULL AUTONOMY: Try 9ROUTER cloud editing instead of failing outright.
      //     Local-only COMFYUI being offline must not block sunset-atmosphere style
      //     revisions when a cloud vision model is reachable. ──
      const fallbackOrder = ['9ROUTER', 'MOCK'].filter(n => n !== selectedProviderName);
      let fallbackErr = `Provider ${selectedProviderName} is unavailable: ${probe.reason}`;
      for (const fbName of fallbackOrder) {
        const fbProvider = this.providers.get(fbName);
        if (!fbProvider) continue;
        const fbProbe = await fbProvider.capabilityProbe(transport);
        if (!fbProbe.available) {
          console.warn(`[IMAGE_REVISION] Fallback ${fbName} unavailable: ${fbProbe.reason}`);
          continue;
        }
        console.log(`[IMAGE_REVISION] Fallback: ${selectedProviderName} offline → ${fbName}`);
        provider = fbProvider;
        selectedProviderName = fbProvider.name;
        fallbackErr = null;
        break;
      }
      if (fallbackErr) {
        return {
          success: false,
          error: fallbackErr,
          reasonCode: 'PROVIDER_UNAVAILABLE'
        };
      }
    }

    // 2. Dispatch to Provider (Minimal Path, no masks, no evaluations)
    const result = await provider.editImage({
      referenceImageBuffer: refResolution.buffer,
      referenceMimeType: refResolution.mimeType,
      referenceArtifactId: refResolution.artifactId,
      prompt,
      originalPrompt: originalPrompt || prompt,
      negativePrompt,
      requestId,
      signal,
      aspectRatio,
      width,
      height
    }, transport);

    if (!result.success || !result.imageBuffer) {
      return {
        success: false,
        error: result.error || 'Image editing provider produced no image data.',
        reasonCode: result.reasonCode || 'PROVIDER_EXECUTION_FAILED'
      };
    }

    // 3. Process Result Size
    const rawOutBuffer = result.imageBuffer;
    const policyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(rawOutBuffer);
    if (!policyResult.success || !policyResult.buffer || policyResult.buffer.length >= MAX_IMAGE_BYTES) {
      return { success: false, error: 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED' };
    }
    const finalBuffer = policyResult.buffer;

    const isPng = finalBuffer.length >= 8 && finalBuffer.subarray(0, 8).equals(PNG_MAGIC);
    const isJpeg = finalBuffer.length >= 3 && finalBuffer[0] === 0xFF && finalBuffer[1] === 0xD8 && finalBuffer[2] === 0xFF;
    if (!isPng && !isJpeg && finalBuffer.length < MIN_ARTIFACT_BYTES) {
      return { success: false, error: 'Provider returned invalid or corrupt image data' };
    }

    // 4. Persist Artifact
    const newId = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const format = policyResult.format || (isPng ? 'png' : 'jpeg');
    const ext = format === 'jpeg' ? 'jpg' : format;
    const mimeType = policyResult.mimeType || (format === 'png' ? 'image/png' : 'image/jpeg');
    const filename = `${newId}.${ext}`;
    const localPath = path.join(ARTIFACTS_DIR, filename);
    const relativeUrl = `/api/artifacts/images/${filename}`;

    try {
      fs.writeFileSync(localPath, finalBuffer);
    } catch (writeErr) {
      return { success: false, error: `Failed to write edited artifact to disk: ${writeErr.message}` };
    }

    const postCheck = imageOutputSizePolicyInstance.validatePersistedFile(localPath);
    if (!postCheck.valid || postCheck.sizeBytes >= MAX_IMAGE_BYTES) {
      return { success: false, error: postCheck.reason || 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED' };
    }

    const artifact = {
      id: newId,
      type: 'IMAGE',
      status: 'completed',
      url: relativeUrl,
      thumbnailUrl: relativeUrl,
      localPath,
      mimeType,
      format,
      width: policyResult.width || params.width || IMAGE_WIDTH,
      height: policyResult.height || params.height || IMAGE_HEIGHT,
      provider: selectedProviderName,
      model: result.modelUsed || result.model || 'img2img',
      prompt: prompt || '',
      originalPrompt: originalPrompt || prompt || '',
      generationId,
      messageId,
      bytesSize: finalBuffer.length,
      sizeBytes: finalBuffer.length,
      sizePolicy: policyResult.sizePolicy || { maxBytes: MAX_IMAGE_BYTES, targetBytes: TARGET_IMAGE_BYTES, status: 'PASS' },
      createdAt: new Date().toISOString(),
      renderable: true,
      operation: 'REVISION',
      parentArtifactId: refResolution.artifactId,
      lineage: {
        parentArtifactId: refResolution.artifactId,
        parentUrl: referenceImage,
        mode: 'IMAGE_TO_IMAGE',
        operation: 'REVISION'
      },
      metadata: {
        artifactId: newId,
        parentArtifactId: refResolution.artifactId,
        generationId,
        messageId,
        provider: selectedProviderName,
        model: result.modelUsed || result.model || 'img2img',
        createdAt: new Date().toISOString(),
        format,
        sizeBytes: finalBuffer.length,
        bytesSize: finalBuffer.length,
        mimeType
      }
    };

    console.log(`[IMAGE_REVISION] COMPLETE artifact=${artifact.url} parentArtifactId=${refResolution.artifactId} bytes=${finalBuffer.length}`);

    return {
      success: true,
      artifact,
      parentArtifactId: refResolution.artifactId,
      width: result.width || null,
      height: result.height || null
    };
  }
}

export const imageEditingInstance = new ImageEditingService();
export default imageEditingInstance;
