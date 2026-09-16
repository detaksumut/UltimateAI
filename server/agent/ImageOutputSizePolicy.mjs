/**
 * ImageOutputSizePolicy.mjs
 * Centralized Global Image Output Size Policy across UltimateAI Image Pipelines.
 * 
 * Global Contract:
 * - MAX_IMAGE_BYTES    = 1_000_000 (1 MB hard ceiling)
 * - TARGET_IMAGE_BYTES = 900_000   (900 KB safety target)
 * 
 * Responsibilities:
 * 1. validate(buffer): Validates binary integrity and confirms size is under limit.
 * 2. getMetadata(buffer): Extracts real image metadata (format, dimensions, mimeType).
 * 3. normalize(buffer, options): Progressively normalizes oversized images (format -> quality -> scale).
 * 4. ensureUnderLimit(buffer, options): Main gateway for providers before artifact persistence.
 * 5. validatePersistedFile(localPath): Post-persistence stat() check guaranteeing physical file < 1 MB.
 */

import fs from 'fs';
import Jimp from 'jimp';

import {
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  IMAGE_MAX_BYTES,
  IMAGE_TARGET_BYTES,
  DEFAULT_IMAGE_SIZE
} from './ImageOutputConfig.mjs';

export {
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  IMAGE_MAX_BYTES,
  IMAGE_TARGET_BYTES,
  DEFAULT_IMAGE_SIZE
};

export const MAX_IMAGE_BYTES = IMAGE_MAX_BYTES;
export const TARGET_IMAGE_BYTES = IMAGE_TARGET_BYTES;

export const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF]);
export const PNG_MAGIC  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
export const WEBP_MAGIC = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF

export class ImageOutputSizePolicy {
  constructor(options = {}) {
    this.maxBytes = options.maxBytes || MAX_IMAGE_BYTES;
    this.targetBytes = options.targetBytes || TARGET_IMAGE_BYTES;
  }

  /**
   * Fast header magic bytes format detection
   * @param {Buffer} buffer
   * @returns {'jpeg' | 'png' | 'webp' | 'unknown'}
   */
  detectFormat(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8) return 'unknown';
    if (buffer.subarray(0, 3).equals(JPEG_MAGIC)) return 'jpeg';
    if (buffer.subarray(0, 8).equals(PNG_MAGIC)) return 'png';
    if (buffer.subarray(0, 4).equals(WEBP_MAGIC) && buffer.length >= 12) {
      if (buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
    }
    return 'unknown';
  }

  /**
   * Fast metadata extraction
   * @param {Buffer} buffer
   */
  async getMetadata(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { sizeBytes: 0, format: 'unknown', width: 0, height: 0, mimeType: null };
    }
    const format = this.detectFormat(buffer);
    const mimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';

    let width = 0;
    let height = 0;
    try {
      const img = await Jimp.read(buffer);
      width = img.bitmap.width;
      height = img.bitmap.height;
    } catch {
      // If Jimp cannot decode, width and height stay 0
    }

    return {
      sizeBytes: buffer.length,
      format,
      width,
      height,
      mimeType
    };
  }

  /**
   * Validates whether an image buffer is decodable and within limits
   * @param {Buffer} buffer
   */
  validate(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { valid: false, sizeBytes: 0, reason: 'INVALID_OR_EMPTY_BUFFER' };
    }
    const format = this.detectFormat(buffer);
    if (format === 'unknown') {
      return { valid: false, sizeBytes: buffer.length, reason: 'UNSUPPORTED_OR_CORRUPT_IMAGE_FORMAT' };
    }
    if (buffer.length >= this.maxBytes) {
      return {
        valid: false,
        sizeBytes: buffer.length,
        format,
        reason: 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED'
      };
    }
    return {
      valid: true,
      sizeBytes: buffer.length,
      format
    };
  }

  /**
   * Progressively normalizes an oversized buffer until size <= targetBytes (or strictly < maxBytes).
   * 
   * Strategy:
   * 1. Check transparency: if PNG and no alpha transparency is required, convert to JPEG.
   * 2. Progressive JPEG quality ladder: [85, 75, 65, 55, 45, 35].
   * 3. Progressive dimensional scaling preserving aspect ratio: [0.85, 0.70, 0.55, 0.40, 0.30].
   * 4. Re-encode and verify size.
   * 
   * @param {Buffer} buffer
   * @param {Object} options
   */
  async normalize(buffer, options = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { success: false, error: 'INVALID_BUFFER' };
    }

    // If already <= targetBytes, accept without modification
    if (buffer.length <= this.targetBytes) {
      const meta = await this.getMetadata(buffer);
      return {
        success: true,
        buffer,
        metadata: meta,
        modified: false
      };
    }

    let jimpImage;
    try {
      jimpImage = await Jimp.read(buffer);
    } catch (readErr) {
      return {
        success: false,
        error: `IMAGE_DECODE_FAILED: ${readErr.message}`
      };
    }

    const origWidth = jimpImage.bitmap.width;
    const origHeight = jimpImage.bitmap.height;
    const format = this.detectFormat(buffer);

    // Transparency check: preserve PNG ONLY if transparency is actively present and requested
    const hasAlpha = typeof jimpImage.hasAlpha === 'function' ? jimpImage.hasAlpha() : false;
    const preservePng = options.preserveFormat === true && format === 'png' && hasAlpha;
    const targetMime = preservePng ? Jimp.MIME_PNG : Jimp.MIME_JPEG;
    const targetFormat = preservePng ? 'png' : 'jpeg';

    // 1. Progressive Quality Reduction (Without reducing dimensions first)
    const qualities = [85, 75, 65, 55, 45, 35];
    for (const q of qualities) {
      const clone = jimpImage.clone();
      if (!preservePng) clone.quality(q);
      try {
        const encoded = await clone.getBufferAsync(targetMime);
        if (encoded.length <= this.targetBytes) {
          return {
            success: true,
            buffer: encoded,
            metadata: {
              sizeBytes: encoded.length,
              format: targetFormat,
              width: origWidth,
              height: origHeight,
              mimeType: targetMime,
              quality: q
            },
            modified: true
          };
        }
      } catch {}
    }

    // 2. Progressive Dimensional Scaling preserving aspect ratio
    const scaleFactors = [0.85, 0.70, 0.55, 0.40, 0.30];
    for (const factor of scaleFactors) {
      const newWidth = Math.round(origWidth * factor);
      const newHeight = Math.round(origHeight * factor);
      if (newWidth < 64 || newHeight < 64) break;

      for (const q of [75, 65, 50, 40]) {
        const clone = jimpImage.clone();
        clone.resize(newWidth, newHeight);
        if (!preservePng) clone.quality(q);
        try {
          const encoded = await clone.getBufferAsync(targetMime);
          if (encoded.length <= this.targetBytes) {
            return {
              success: true,
              buffer: encoded,
              metadata: {
                sizeBytes: encoded.length,
                format: targetFormat,
                width: newWidth,
                height: newHeight,
                mimeType: targetMime,
                scaledFactor: factor,
                quality: q
              },
              modified: true
            };
          }
        } catch {}
      }
    }

    // 3. Fallback aggressive attempt if still > 900KB but can be brought under 1,000,000 bytes
    for (const factor of [0.25, 0.20]) {
      const newWidth = Math.max(64, Math.round(origWidth * factor));
      const newHeight = Math.max(64, Math.round(origHeight * factor));
      const clone = jimpImage.clone();
      clone.resize(newWidth, newHeight);
      clone.quality(30);
      try {
        const encoded = await clone.getBufferAsync(Jimp.MIME_JPEG);
        if (encoded.length < this.maxBytes) {
          return {
            success: true,
            buffer: encoded,
            metadata: {
              sizeBytes: encoded.length,
              format: 'jpeg',
              width: newWidth,
              height: newHeight,
              mimeType: Jimp.MIME_JPEG,
              scaledFactor: factor,
              quality: 30
            },
            modified: true
          };
        }
      } catch {}
    }

    return {
      success: false,
      error: 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED'
    };
  }

  /**
   * Main Pipeline Gateway:
   * Called by all providers before returning an image buffer.
   * Guarantees that the final Buffer satisfies JIN size policy.
   * Emits standardized telemetry diagnostics.
   * 
   * @param {Buffer} buffer - Raw output buffer from image provider
   * @param {Object} options
   */
  async ensureUnderLimit(buffer, options = {}) {
    const inputBytes = buffer?.length || 0;
    console.log(`[IMAGE_SIZE_POLICY]\ninputBytes=${inputBytes}\ntargetBytes=${this.targetBytes}\nmaxBytes=${this.maxBytes}`);

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      console.log(`[IMAGE_SIZE_POLICY] FAILED\nreason=INVALID_OR_EMPTY_BUFFER`);
      return {
        success: false,
        error: 'INVALID_OR_EMPTY_BUFFER',
        sizePolicy: { maxBytes: this.maxBytes, targetBytes: this.targetBytes, status: 'FAILED' }
      };
    }

    // If already <= targetBytes, accept without modification
    if (buffer.length <= this.targetBytes) {
      console.log(`[IMAGE_SIZE_POLICY] PASS\nfinalBytes=${buffer.length}`);
      const meta = await this.getMetadata(buffer);
      return {
        success: true,
        buffer,
        sizeBytes: buffer.length,
        format: meta.format,
        width: meta.width,
        height: meta.height,
        mimeType: meta.mimeType,
        sizePolicy: {
          maxBytes: this.maxBytes,
          targetBytes: this.targetBytes,
          status: 'PASS'
        }
      };
    }

    // Output buffer exceeds targetBytes -> progressively normalize
    const normResult = await this.normalize(buffer, options);
    if (normResult.success && normResult.buffer && normResult.buffer.length < this.maxBytes) {
      const finalBytes = normResult.buffer.length;
      console.log(`[IMAGE_SIZE_POLICY] normalized\noriginalBytes=${inputBytes}\nfinalBytes=${finalBytes}\nformat=${normResult.metadata.format}\nwidth=${normResult.metadata.width}\nheight=${normResult.metadata.height}`);
      console.log(`[IMAGE_SIZE_POLICY] PASS\nfinalBytes=${finalBytes}`);
      return {
        success: true,
        buffer: normResult.buffer,
        sizeBytes: finalBytes,
        format: normResult.metadata.format,
        width: normResult.metadata.width,
        height: normResult.metadata.height,
        mimeType: normResult.metadata.mimeType,
        sizePolicy: {
          maxBytes: this.maxBytes,
          targetBytes: this.targetBytes,
          status: 'PASS'
        }
      };
    }

    console.log(`[IMAGE_SIZE_POLICY] FAILED\nreason=IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED`);
    return {
      success: false,
      error: 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED',
      sizePolicy: {
        maxBytes: this.maxBytes,
        targetBytes: this.targetBytes,
        status: 'FAILED'
      }
    };
  }

  /**
   * Post-Persistence Validation:
   * Inspects physical file on disk after write to guarantee physical size < 1,000,000 bytes.
   * @param {string} localPath
   */
  validatePersistedFile(localPath) {
    if (!localPath || !fs.existsSync(localPath)) {
      return { valid: false, reason: 'FILE_NOT_FOUND' };
    }
    const stat = fs.statSync(localPath);
    if (stat.size >= this.maxBytes) {
      return {
        valid: false,
        sizeBytes: stat.size,
        reason: 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED'
      };
    }
    return {
      valid: true,
      sizeBytes: stat.size,
      maxBytes: this.maxBytes,
      targetBytes: this.targetBytes
    };
  }
}

export const imageOutputSizePolicyInstance = new ImageOutputSizePolicy();
export default imageOutputSizePolicyInstance;
