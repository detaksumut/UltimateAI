/**
 * ArchitecturalVisualRenderer.mjs
 * Programmatic local renderer for HOUSE_DESIGN VisualDesignSpec.
 * Implements ArchitecturalRenderer interface.
 * Produces real PNG image artifacts using Jimp.
 */

import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';
import { imageOutputSizePolicyInstance, MAX_IMAGE_BYTES } from '../ImageOutputSizePolicy.mjs';

const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');

export class ArchitecturalVisualRenderer {
  constructor(options = {}) {
    this.configured = options.configured !== false;
    this._ensureDir();
  }

  _ensureDir() {
    try {
      if (!fs.existsSync(ARTIFACTS_DIR)) {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
      }
    } catch {}
  }

  isConfigured() {
    return this.configured;
  }

  /**
   * Renders a HOUSE_DESIGN VisualDesignSpec into a real PNG image artifact.
   * 
   * @param {Object} spec - JIN.VisualDesignSpec v1.0 (HOUSE_DESIGN)
   * @returns {Promise<{ success: boolean, buffer?: Buffer, format?: string, mimeType?: string, width?: number, height?: number, artifact?: Object, error?: string }>}
   */
  async render(spec) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'HOUSE_RENDERER_NOT_CONFIGURED: Local architectural renderer is not configured.',
        reasonCode: 'HOUSE_RENDERER_NOT_CONFIGURED'
      };
    }

    if (!spec || spec.domain !== 'HOUSE_DESIGN') {
      return {
        success: false,
        error: `INVALID_SPEC: Expected domain HOUSE_DESIGN, got "${spec?.domain}"`,
        reasonCode: 'RENDER_FAILED'
      };
    }

    const width = spec.canvas?.width || 1600;
    const height = spec.canvas?.height || 900;
    const site = spec.site || { widthMeters: 10, depthMeters: 20 };
    const bldg = spec.building || { floors: 2, style: 'modern tropical' };
    const facade = spec.facade || { materials: ['concrete', 'wood', 'glass'], roof: { type: 'flat' } };
    const requestId = spec.requestId || `req-arch-${Date.now()}`;

    try {
      // 1. Create canvas with architectural dark slate background
      const img = await new Promise((resolve, reject) => {
        new Jimp(width, height, 0x0A0F1DFF, (err, image) => {
          if (err) reject(err);
          else resolve(image);
        });
      });

      // Colors
      const C_BORDER = Jimp.rgbaToInt(56, 189, 248, 255);    // Sky blue accent
      const C_GRID = Jimp.rgbaToInt(25, 38, 64, 255);        // Grid line
      const C_WALL = Jimp.rgbaToInt(226, 232, 240, 255);     // Off-white wall
      const C_GLASS = Jimp.rgbaToInt(56, 189, 248, 160);     // Glass blue tint
      const C_WOOD = Jimp.rgbaToInt(180, 100, 40, 255);      // Wood accent
      const C_GROUND = Jimp.rgbaToInt(15, 23, 42, 255);      // Ground line
      const C_ROOF = Jimp.rgbaToInt(51, 65, 85, 255);        // Roof dark grey
      const C_TEXT = Jimp.rgbaToInt(248, 250, 252, 255);

      // Helper drawing functions
      const fillRect = (x, y, w, h, col) => {
        const x1 = Math.max(0, Math.round(x));
        const y1 = Math.max(0, Math.round(y));
        const x2 = Math.min(width, Math.round(x + w));
        const y2 = Math.min(height, Math.round(y + h));
        for (let px = x1; px < x2; px++) {
          for (let py = y1; py < y2; py++) {
            img.setPixelColor(col, px, py);
          }
        }
      };

      const strokeRect = (x, y, w, h, col, sw = 2) => {
        fillRect(x, y, w, sw, col);
        fillRect(x, y + h - sw, w, sw, col);
        fillRect(x, y, sw, h, col);
        fillRect(x + w - sw, y, sw, h, col);
      };

      // 2. Draw Drafting Margins & Technical Grid
      strokeRect(30, 30, width - 60, height - 60, C_BORDER, 2);
      strokeRect(35, 35, width - 70, height - 70, C_GRID, 1);

      for (let gx = 60; gx < width - 60; gx += 80) {
        for (let gy = 60; gy < height - 60; gy += 80) {
          img.setPixelColor(C_GRID, gx, gy);
        }
      }

      // 3. Ground plane
      const groundY = Math.round(height * 0.75);
      fillRect(60, groundY, width - 120, 8, C_BORDER);
      fillRect(60, groundY + 8, width - 120, height - groundY - 68, C_GROUND);

      // 4. House Building Elevation
      const houseW = Math.round(width * 0.55);
      const floors = bldg.floors || 2;
      const floorH = Math.round(height * 0.22);
      const totalH = floorH * floors;
      const houseX = Math.round((width - houseW) / 2);
      const houseY = groundY - totalH;

      // Building main body
      fillRect(houseX, houseY, houseW, totalH, C_WALL);
      strokeRect(houseX, houseY, houseW, totalH, C_BORDER, 3);

      // Roof
      if (facade.roof?.type === 'flat') {
        fillRect(houseX - 20, houseY - 18, houseW + 40, 18, C_ROOF);
        strokeRect(houseX - 20, houseY - 18, houseW + 40, 18, C_BORDER, 2);
      } else {
        fillRect(houseX - 30, houseY - 30, houseW + 60, 30, C_ROOF);
      }

      // Windows & Balconies per floor
      for (let f = 0; f < floors; f++) {
        const curY = houseY + f * floorH;
        // Floor dividing line
        if (f > 0) {
          fillRect(houseX, curY, houseW, 6, C_BORDER);
        }

        // Left large window
        fillRect(houseX + 40, curY + 30, Math.round(houseW * 0.35), floorH - 60, C_GLASS);
        strokeRect(houseX + 40, curY + 30, Math.round(houseW * 0.35), floorH - 60, C_BORDER, 2);

        // Right architectural wood louvers
        fillRect(houseX + Math.round(houseW * 0.45), curY + 30, Math.round(houseW * 0.45), floorH - 60, C_WOOD);
        strokeRect(houseX + Math.round(houseW * 0.45), curY + 30, Math.round(houseW * 0.45), floorH - 60, C_BORDER, 2);
      }

      // Entrance Door on Ground Floor
      const doorW = 80;
      const doorH = 140;
      const doorX = houseX + Math.round(houseW * 0.5) - 40;
      const doorY = groundY - doorH;
      fillRect(doorX, doorY, doorW, doorH, C_WOOD);
      strokeRect(doorX, doorY, doorW, doorH, C_BORDER, 2);

      // 5. Title block
      const tbW = 420;
      const tbH = 150;
      const tbX = width - tbW - 50;
      const tbY = height - tbH - 50;
      fillRect(tbX, tbY, tbW, tbH, 0x0B132BFF);
      strokeRect(tbX, tbY, tbW, tbH, C_BORDER, 2);

      // Export buffer with Jimp
      const rawPngBuffer = await img.getBufferAsync(Jimp.MIME_PNG);

      // Pass through ImageOutputSizePolicy (< 1 MB)
      const policyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(rawPngBuffer);
      const finalBuffer = policyResult.buffer || rawPngBuffer;

      // Save file
      const artifactId = `img-house-${Date.now()}`;
      const filename = `${artifactId}.png`;
      const localPath = path.join(ARTIFACTS_DIR, filename);
      fs.writeFileSync(localPath, finalBuffer);

      const artifact = {
        id: artifactId,
        type: 'image',
        mimeType: 'image/png',
        format: 'png',
        path: `/api/artifacts/images/${filename}`,
        localPath,
        width,
        height,
        sizeBytes: finalBuffer.length,
        provider: 'LOCAL_HERMES_RENDERER',
        domain: 'HOUSE_DESIGN',
        requestId
      };

      return {
        success: true,
        buffer: finalBuffer,
        format: 'png',
        mimeType: 'image/png',
        width,
        height,
        artifact,
        sizeBytes: finalBuffer.length
      };
    } catch (err) {
      return {
        success: false,
        error: `RENDER_FAILED: ${err.message}`,
        reasonCode: 'RENDER_FAILED'
      };
    }
  }
}

export const architecturalVisualRendererInstance = new ArchitecturalVisualRenderer();
export default architecturalVisualRendererInstance;
