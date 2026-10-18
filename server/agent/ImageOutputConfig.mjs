/**
 * ImageOutputConfig.mjs
 * Centralized Global Production Configuration for all JIN Image Production Pipelines.
 * 
 * Global Contract (REFINED — LOW-BYTE ENTERPRISE ASSETS):
 * - IMAGE_WIDTH        = 512 (Default global image width)
 * - IMAGE_HEIGHT       = 512 (Default global image height)
 * - IMAGE_MAX_BYTES    = 1000000 (1 MB hard ceiling — enterprise presentation assets)
 * - IMAGE_TARGET_BYTES = 1000000 (1 MB target — NO recompression for images already <= 1 MB)
 * 
 * Presentation resolution hints (request `size` is ONLY a hint — providers may map
 * it internally to a different canvas; the STRICT BOX is always validated on the
 * ACTUAL decoded dimensions of the received image):
 *   STRICT 16:9 : preferred "1024x576", fallback "912x513"
 *   STRICT 9:16 : preferred "576x1024", fallback "513x912"
 *   SQUARE 1:1  : preferred "1024x1024" (only when the user explicitly requests 1:1)
 *
 * Never "912x512": in live probing it was mapped by a provider to a 3:2 canvas.
 *
 * All image producers (IMAGE_GENERATION, IMAGE_REVISION, Pollinations, ComfyUI, etc.)
 * MUST consume their dimensions and size limits from this central configuration.
 */

export const IMAGE_WIDTH = parseInt(
  process.env.IMAGE_WIDTH || '512',
  10
);

export const IMAGE_HEIGHT = parseInt(
  process.env.IMAGE_HEIGHT || '512',
  10
);

export const IMAGE_STEPS = parseInt(
  process.env.IMAGE_STEPS || '8',
  10
);

export const IMAGE_DENOISE = parseFloat(
  process.env.IMAGE_DENOISE || '0.52'
);

export const IMAGE_MAX_BYTES = parseInt(
  process.env.IMAGE_OUTPUT_MAX_BYTES || process.env.IMAGE_MAX_BYTES || '1000000',
  10
);

export const IMAGE_TARGET_BYTES = parseInt(
  process.env.IMAGE_OUTPUT_TARGET_BYTES || process.env.IMAGE_TARGET_BYTES || '1000000',
  10
);

export const DEFAULT_IMAGE_SIZE = `${IMAGE_WIDTH}x${IMAGE_HEIGHT}`;

// ── Presentation resolution hints for the Strict Box Policy ────────────────
// Order matters: [preferred, fallback]. These are request hints only — the
// strict box is ALWAYS validated against ACTUAL decoded dimensions afterwards.
export const PRESENTATION_16X9_SIZES = ['768x432', '640x360'];
export const PRESENTATION_9X16_SIZES = ['432x768', '360x640'];
export const PRESENTATION_SQUARE_SIZES = ['768x768'];

/**
 * Resolve the ordered request-size hints for a requested aspect ratio.
 * @param {string} aspectRatio '16:9' | '9:16' | '1:1' (anything else -> '16:9')
 * @returns {string[]} [preferred, fallback]
 */
export function resolveRequestSizes(aspectRatio) {
  const ar = String(aspectRatio || '16:9');
  if (ar === '9:16') return PRESENTATION_9X16_SIZES;
  if (ar === '1:1') return PRESENTATION_SQUARE_SIZES;
  return PRESENTATION_16X9_SIZES;
}

export default {
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  IMAGE_MAX_BYTES,
  IMAGE_TARGET_BYTES,
  DEFAULT_IMAGE_SIZE,
  PRESENTATION_16X9_SIZES,
  PRESENTATION_9X16_SIZES,
  PRESENTATION_SQUARE_SIZES,
  resolveRequestSizes
};
