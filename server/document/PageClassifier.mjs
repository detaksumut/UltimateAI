/**
 * PageClassifier.mjs
 * PHASE 1 — maps PageProfile -> execution plan per page/range.
 *
 * Workers: TEXT | OCR | VISION | TABLE | OCR+VISION | TEXT+TABLE
 * Merges consecutive pages with identical worker into ranges.
 */
import { PAGE_TYPES } from './DocumentProfiler.mjs';

export function workerForPage(profile) {
  if (!profile) return 'TEXT';
  switch (profile.type) {
    case PAGE_TYPES.SCAN: return 'OCR+VISION';
    case PAGE_TYPES.TABLE: return 'TEXT+TABLE';
    case PAGE_TYPES.VISION: return 'VISION';
    case PAGE_TYPES.MIXED: return 'OCR+VISION';
    case PAGE_TYPES.TEXT:
    default:
      if (profile.tableLikelihood >= 0.6) return 'TEXT+TABLE';
      if (profile.visionLikelihood >= 0.7) return 'VISION';
      if (profile.ocrRequired) return 'OCR+VISION';
      return 'TEXT';
  }
}

export function buildExecutionPlan(pageProfiles = []) {
  const pages = (pageProfiles || []).map((p) => ({
    page: p.page,
    type: p.type,
    worker: workerForPage(p)
  }));
  const ranges = [];
  for (const pg of pages) {
    const last = ranges[ranges.length - 1];
    if (last && last.worker === pg.worker && pg.page === last.end + 1) {
      last.end = pg.page;
      last.pages.push(pg.page);
    } else {
      ranges.push({ worker: pg.worker, start: pg.page, end: pg.page, pages: [pg.page] });
    }
  }
  return { pages, ranges };
}

export default { workerForPage, buildExecutionPlan };
