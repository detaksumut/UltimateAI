/**
 * server/studio/core/StudioCreationClassifier.mjs
 * Deterministic Priority 3 (P3) Studio Creation Intent Classifier.
 * Detects requests to instantiate new Studio Projects:
 * - SLIDE_STUDIO (PPT, slide deck, presentasi)
 * - ARCHITECTURAL_STUDIO (desain rumah, denah lahan, rancang bangun)
 * - DATA_LAB (analisis data, dataset, olah csv/excel)
 */

export class StudioCreationClassifier {
  constructor() {}

  /**
   * Classify if prompt intends to initiate a new Studio project.
   */
  classify(userPrompt = '') {
    const raw = String(userPrompt || '').trim();
    if (!raw) {
      return { matched: false, studioType: null, priority: 'P3', parameters: {}, reason: 'empty_prompt' };
    }

    const text = raw.toLowerCase().replace(/^(?:jin\s+)?(?:tolong\s+)?(?:coba\s+)?/i, '').trim();

    // Guard: Do not intercept if user asks to read documents, generate textual points/outline, or has attached documents
    if (/(?:baca|point\s+point|poin\s+poin|outline|materi|rangkum|ringkas|pelajari|analisis)\b/i.test(text) ||
        raw.includes('--- [BERKAS DOKUMEN') || raw.includes('--- [DOKUMEN') || raw.includes('--- [Konteks Dokumen')) {
      return { matched: false, studioType: null, priority: 'P3', parameters: {}, reason: 'document_reading_or_textual_outline' };
    }

    // 1. SLIDE_STUDIO Intent
    // e.g. "buat PPT 20 slide", "buatkan presentasi strategi AI 15 slide", "buat deck presentasi"
    const slideMatch = text.match(/(?:buat(?:kan)?|bikin|susun|rancang)\s+(?:draft\s+)?(?:presentasi|ppt|powerpoint|slide\s+deck|deck)(?:\s+(?:tentang|mengenai|tema|dengan\s+tema)?\s*(.*?))?(?:\s+(\d+)\s+slide)?$/i) ||
      text.match(/(?:buat(?:kan)?|bikin)\s+(?:ppt|presentasi|slide\s+deck)\b/i) ||
      text.match(/\b(\d+)\s+slide\s+presentasi\b/i);

    if (slideMatch) {
      let count = 20;
      const countMatch = text.match(/(\d+)\s+slide/i);
      if (countMatch) {
        count = parseInt(countMatch[1], 10);
      }
      return {
        matched: true,
        studioType: 'SLIDE_STUDIO',
        priority: 'P3',
        intent: 'SLIDE_STUDIO',
        parameters: {
          requestedCount: count,
          rawTopic: raw
        },
        reason: 'new_slide_studio_intent'
      };
    }

    // 2. ARCHITECTURAL_STUDIO Intent
    // e.g. "buat desain rumah di lahan 20x30", "rancang rumah 2 lantai", "desain rumah minimalis"
    const archMatch = text.match(/(?:buat(?:kan)?|rancang|desain)\s+(?:konsep\s+)?(?:desain\s+)?rumah\b/i) ||
      text.match(/(?:desain|rancang\s+bangun)\s+di\s+lahan\s+\d+\s*(?:x|×)\s*\d+/i) ||
      text.match(/(?:buat(?:kan)?\s+)?denah\s+rumah\b/i);

    if (archMatch) {
      return {
        matched: true,
        studioType: 'ARCHITECTURAL_STUDIO',
        priority: 'P3',
        intent: 'ARCHITECTURAL_DESIGN',
        parameters: {
          rawTopic: raw
        },
        reason: 'new_architectural_studio_intent'
      };
    }

    // 3. DATA_LAB Intent
    // e.g. "analisis data ini", "analisis dataset", "buat grafik dari csv", "olah data tabel"
    const dataMatch = text.match(/(?:analisis|olah|bedah)\s+(?:data|dataset|file\s+data)\b/i) ||
      text.match(/(?:buat\s+grafik|analisis\s+statistik)\s+dari\s+(?:csv|excel|dataset|data)\b/i);

    if (dataMatch) {
      return {
        matched: true,
        studioType: 'DATA_LAB',
        priority: 'P3',
        intent: 'DATA_LAB',
        parameters: {
          rawTopic: raw
        },
        reason: 'new_datalab_intent'
      };
    }

    return {
      matched: false,
      studioType: null,
      priority: 'P3',
      intent: null,
      parameters: {},
      reason: 'no_studio_creation_pattern'
    };
  }
}

export const studioCreationClassifierInstance = new StudioCreationClassifier();
export default studioCreationClassifierInstance;
