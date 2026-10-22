/**
 * SlideQA.mjs
 * Honest validation gate for editable corporate slides.
 * A slide only passes when the renderer's artifacts and schema checks exist.
 */
import fs from 'node:fs';

export class SlideQA {
  async audit(schema, rendered = {}) {
    const checks = [
      ['T1', 'Schema exists', Boolean(schema && typeof schema === 'object')],
      ['T2', 'Presentation domain', schema?.domain === 'PRESENTATION'],
      ['T3', 'Title is present', Boolean(String(schema?.header?.title || '').trim())],
      ['T4', 'Subtitle is present', Boolean(String(schema?.header?.subtitle || '').trim())],
      ['T5', 'Canvas dimensions are 16:9', schema?.canvas?.width === 1920 && schema?.canvas?.height === 1080 && schema?.canvas?.aspectRatio === '16:9'],
      ['T6', 'Two structured columns exist', Array.isArray(schema?.columns) && schema.columns.length === 2],
      ['T7', 'First column has readable content', Boolean(schema?.columns?.[0]?.title && Array.isArray(schema?.columns?.[0]?.items) && schema.columns[0].items.length >= 3)],
      ['T8', 'Second column has readable content', Boolean(schema?.columns?.[1]?.title && Array.isArray(schema?.columns?.[1]?.items) && schema.columns[1].items.length >= 3)],
      ['T9', 'Footer takeaway is present', String(schema?.footer?.takeaway || '').trim().length >= 12],
      ['T10', 'Footer conclusion is present', String(schema?.footer?.conclusion || '').trim().length >= 8],
      ['T11', 'SVG contains a root element', typeof rendered.svg === 'string' && /^<svg\b/.test(rendered.svg)],
      ['T12', 'SVG closes correctly', typeof rendered.svg === 'string' && /<\/svg>\s*$/.test(rendered.svg)],
      ['T13', 'SVG contains editable vector text', typeof rendered.svg === 'string' && rendered.svg.includes('<text')],
      ['T14', 'PNG preview exists and has bytes', Buffer.isBuffer(rendered.previewBuffer) && rendered.previewBuffer.length > 5000],
      ['T15', 'Preview dimensions are 1280x720', rendered.width === 1280 && rendered.height === 720],
      ['T16', 'PPTX buffer exists', Buffer.isBuffer(rendered.pptxBuffer) && rendered.pptxBuffer.length > 5000],
      ['T17', 'Target audience is represented', Boolean(schema?.metadata?.audience)],
      ['T18', 'Evidence and source status are explicit', Boolean(schema?.metadata?.evidencePolicy)]
    ];

    const results = checks.map(([id, name, passed]) => ({
      id,
      name,
      passed: Boolean(passed),
      status: passed ? 'PASS' : 'FAIL'
    }));
    const failures = results.filter(result => !result.passed);
    return {
      passed: failures.length === 0,
      failures,
      results,
      summary: results.length + ' checks, ' + (results.length - failures.length) + ' passed, ' + failures.length + ' failed',
      auditedAt: new Date().toISOString(),
      policy: 'QA_RESULT_DERIVED_FROM_RUNTIME_CHECKS'
    };
  }
}

export const slideQAInstance = new SlideQA();
export default slideQAInstance;
