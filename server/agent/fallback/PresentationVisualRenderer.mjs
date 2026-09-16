/**
 * PresentationVisualRenderer.mjs
 * Programmatic renderer for PRESENTATION VisualDesignSpec.
 * Conforms to:
 * VisualDesignSpec -> SlideRenderer -> SVG -> PNG -> PPTX -> QA
 */

import fs from 'fs';
import path from 'path';
import { slideStudioInstance } from '../../studio/slide/SlideStudio.mjs';
import { slideRendererInstance } from '../../studio/slide/SlideRenderer.mjs';
import { slideQAInstance } from '../../studio/slide/SlideQA.mjs';
import { imageOutputSizePolicyInstance } from '../ImageOutputSizePolicy.mjs';

const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');

export class PresentationVisualRenderer {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    try {
      if (!fs.existsSync(ARTIFACTS_DIR)) {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
      }
    } catch {}
  }

  /**
   * Renders a PRESENTATION VisualDesignSpec into SVG, PNG preview, and editable PPTX with QA.
   * 
   * @param {Object} spec - JIN.VisualDesignSpec v1.0 (PRESENTATION)
   * @returns {Promise<{ success: boolean, buffer?: Buffer, format?: string, mimeType?: string, width?: number, height?: number, artifact?: Object, pptxArtifact?: Object, qaReport?: Object, error?: string }>}
   */
  async render(spec) {
    if (!spec || spec.domain !== 'PRESENTATION') {
      return {
        success: false,
        error: `INVALID_SPEC: Expected domain PRESENTATION, got "${spec?.domain}"`,
        reasonCode: 'RENDER_FAILED'
      };
    }

    const title = spec.header?.title || 'Executive Presentation Slide';
    const subtitle = spec.header?.subtitle || '';
    const requestId = spec.requestId || `req-slide-${Date.now()}`;
    const width = spec.canvas?.width || 1920;
    const height = spec.canvas?.height || 1080;

    try {
      // 1. Synthesize slide schema matching SlideStudio standard
      const slideResult = await slideStudioInstance.createSlide(title, {
        context: {
          requestId,
          subtitle,
          theme: spec.theme?.style || 'enterprise',
          primaryColor: spec.theme?.primaryColor || '#123456',
          specElements: spec.elements || []
        }
      });

      if (!slideResult || !slideResult.success) {
        throw new Error('SlideStudio programmatic rendering failed to produce artifact.');
      }

      let previewBuffer = slideResult.previewBuffer;
      if (!previewBuffer && slideResult.files?.preview?.path) {
        previewBuffer = fs.readFileSync(slideResult.files.preview.path);
      }

      let pptxBuffer = slideResult.pptxBuffer;
      if (!pptxBuffer && slideResult.files?.pptx?.path) {
        pptxBuffer = fs.readFileSync(slideResult.files.pptx.path);
      }

      if (!previewBuffer || previewBuffer.length === 0) {
        throw new Error('SlideStudio rendered empty preview buffer.');
      }

      // Pass through ImageOutputSizePolicy (< 1 MB)
      const policyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(previewBuffer);
      const finalBuffer = policyResult.buffer || previewBuffer;

      const artifactId = `img-pres-${Date.now()}`;
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
        width: 1280,
        height: 720,
        sizeBytes: finalBuffer.length,
        provider: 'LOCAL_HERMES_RENDERER',
        domain: 'PRESENTATION',
        requestId
      };

      return {
        success: true,
        buffer: finalBuffer,
        format: 'png',
        mimeType: 'image/png',
        width: 1280,
        height: 720,
        artifact,
        svg: slideResult.svg,
        pptxBuffer,
        pptxArtifact: slideResult.pptxArtifact,
        qaReport: slideResult.qaReport,
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

export const presentationVisualRendererInstance = new PresentationVisualRenderer();
export default presentationVisualRendererInstance;
