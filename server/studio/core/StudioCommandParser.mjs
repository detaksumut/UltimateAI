/**
 * server/studio/core/StudioCommandParser.mjs
 * Structured Studio Command Parser for Conversational Project Continuations.
 *
 * Implements deterministic grammar parsing with exact confidence tiers:
 * - EXACT: Unambiguous canonical commands ("slide 3", "buat slide 3", "buat denah", "buat grafik kedua")
 * - STRONG: Parameterized or studio-bound commands ("lanjut slide 3", "buat gambar rumah untuk slide 3")
 * - CONTEXTUAL: Context-dependent continuation tokens ("lanjut", "berikutnya", "ulang")
 * - AMBIGUOUS: Vague, under-specified intents ("buat yang lebih bagus", "baguskan")
 * - NONE: Completely unrelated requests ("buat gambar rumah", "berapa umur presiden")
 */

export const MATCH_TYPES = {
  EXACT: 'EXACT',
  STRONG: 'STRONG',
  CONTEXTUAL: 'CONTEXTUAL',
  AMBIGUOUS: 'AMBIGUOUS',
  NONE: 'NONE'
};


export class StudioCommandParser {
  constructor() {}

  /**
   * Normalizes raw user input for grammar matching:
   * - Lowercase
   * - Strip conversational prefixes ("jin tolong", "tolong", "coba")
   * - Strip redundant punctuation
   * - Normalize whitespace
   */
  normalizeInput(rawText = '') {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText
      .toLowerCase()
      .replace(/^(?:jin\s+)?(?:tolong\s+)?(?:coba\s+)?(?:harap\s+)?/i, '')
      .replace(/["'“”]/g, '')
      .replace(/[?!,;]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parses user prompt against the active StudioContext.
   */
  parse(userPrompt = '', activeSession = null) {
    const text = this.normalizeInput(userPrompt);
    if (!text) {
      return {
        matchType: MATCH_TYPES.NONE,
        isCompatible: false,
        studio: null,
        action: null,
        parameters: {},
        reason: 'empty_input'
      };
    }

    let studioType = activeSession ? (activeSession.studioType || activeSession.studio?.type || activeSession.studio) : null;

      return {
        matchType: MATCH_TYPES.NONE,
        isCompatible: false,
        studio: null,
        action: null,
        parameters: {},
        reason: 'no_active_session'
      };
    }

    // Check ambiguous commands first
    if (/^(?:buat\s+)?(?:yang\s+)?(?:lebih\s+)?(?:bagus|keren|cantik|mantap|oke)$/i.test(text) ||
        /^(?:perbagus|baguskan|percantik)$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.AMBIGUOUS,
        isCompatible: false,
        studio: studioType,
        action: 'AMBIGUOUS_FEEDBACK',
        parameters: { rawText: userPrompt },
        reason: 'vague_improvement_request'
      };
    }

    let result = null;
    if (studioType === 'ARCHITECTURAL_STUDIO') {
      result = this._parseArchCommand(text, activeSession, userPrompt);
    } else if (studioType === 'DATA_LAB') {
      result = this._parseDataLabCommand(text, activeSession, userPrompt);
    }

    if (result && result.parameters) {
      if (result.parameters.slideNumber !== undefined) result.slideNumber = result.parameters.slideNumber;
      if (result.parameters.revisionNotes !== undefined) result.revisionNotes = result.parameters.revisionNotes;
      if (result.parameters.stepCode !== undefined) result.stepCode = result.parameters.stepCode;
      if (result.parameters.stepQuery !== undefined) result.stepQuery = result.parameters.stepQuery;
    }

    return result || {
      matchType: MATCH_TYPES.NONE,
      isCompatible: false,
      studio: null,
      action: null,
      parameters: {},
      reason: 'unknown_studio_type'
    };
  }


  _parseArchCommand(text, session) {
    // 0. Collision Check: Standalone non-architectural requests (e.g. "buat poster rumah") -> NONE
    if (/^(?:buat|generate)\s+poster\b/i.test(text)) {
      return {
        matchType: MATCH_TYPES.NONE,
        isCompatible: false,
        studio: 'ARCHITECTURAL_STUDIO',
        action: null,
        parameters: {},
        reason: 'poster_request_escapes_studio'
      };
    }

    // 1. Revision of design state (kamar utama, garasi, kolam, etc.)
    const stateRevMatch = text.match(/^(?:revisi|ubah|geser|pindahkan|perlebar|perkecil)\s+(kamar(?:\s+utama)?|garasi|kolam|teras|dapur|ruang\s+tamu|balkon)(?:\s*[:,\-]?\s*(.*))?$/i);
    if (stateRevMatch) {
      return {
        matchType: MATCH_TYPES.STRONG,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'REVISE_DESIGN_STATE',
        parameters: {
          targetComponent: stateRevMatch[1].trim(),
          instruction: text
        },
        reason: 'architectural_state_revision'
      };
    }

    // 2. Explicit Steps
    const stepKeywords = [
      { step: 'STEP_01_DENAH', code: '01', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:denah|floor\s*plan|tata\s+ruang)$/i },
      { step: 'STEP_02_STRUKTUR', code: '02', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:struktur|rangka|grid\s+kolom)$/i },
      { step: 'STEP_03_TAMPAK_DEPAN', code: '03', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:tampak\s+depan|fasad\s+depan)$/i },
      { step: 'STEP_04_TAMPAK_KIRI', code: '04', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:tampak\s+(?:samping\s+)?kiri)$/i },
      { step: 'STEP_05_TAMPAK_KANAN', code: '05', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:tampak\s+(?:samping\s+)?kanan)$/i },
      { step: 'STEP_06_TAMPAK_BELAKANG', code: '06', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:tampak\s+belakang)$/i },
      { step: 'STEP_07_MODEL_3D', code: '07', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:3d|model\s*3d|perspektif)$/i },
      { step: 'STEP_08_HOLOGRAM_3D', code: '08', pattern: /^(?:(?:buat|lanjut|tampilkan)\s+)?(?:hologram|hologram\s*3d)$/i }
    ];

    for (const entry of stepKeywords) {
      if (entry.pattern.test(text)) {
        return {
          matchType: MATCH_TYPES.EXACT,
          isCompatible: true,
          studio: 'ARCHITECTURAL_STUDIO',
          action: `GENERATE_STEP(${entry.code})`,
          parameters: { stepCode: entry.step, stepNumber: parseInt(entry.code, 10) },
          reason: 'explicit_arch_step'
        };
      }
    }

    // 3. Step revisions & regenerations
    const retryMatch = text.match(/^(?:ulang|buat\s+ulang)\s+(denah|struktur|tampak\s+depan|tampak\s+kiri|tampak\s+kanan|tampak\s+belakang|3d|hologram)$/i);
    if (retryMatch) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'REGENERATE_STEP',
        parameters: { stepName: retryMatch[1] },
        reason: 'regenerate_arch_step'
      };
    }

    const revStepMatch = text.match(/^(?:revisi|ubah)\s+denah(?:\s*[:,\-]?\s*(.*))?$/i);
    if (revStepMatch) {
      return {
        matchType: MATCH_TYPES.STRONG,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'REVISE_STEP(01)',
        parameters: { stepCode: 'STEP_01_DENAH', instruction: (revStepMatch[1] || '').trim() },
        reason: 'revise_denah_step'
      };
    }

    // 4. Lock steps
    const lockMatch = text.match(/^kunci\s+(denah|struktur|tampak\s+depan)$/i);
    if (lockMatch) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'LOCK_STEP',
        parameters: { target: lockMatch[1] },
        reason: 'lock_arch_step'
      };
    }

    // 5. Continuation & Batch
    if (/^(?:lanjut|lanjutkan|next)$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.CONTEXTUAL,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'NEXT_STEP',
        parameters: {},
        reason: 'contextual_next_arch_step'
      };
    }

    if (/^(?:buat\s+semua|produksi\s+semua|generate\s+semua)$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'GENERATE_ALL_STEPS',
        parameters: {},
        reason: 'generate_all_arch_steps'
      };
    }

    if (/^(?:export|ekspor)\s+gambar$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'EXPORT_ARTIFACTS',
        parameters: {},
        reason: 'export_arch_artifacts'
      };
    }

    if (/^(?:batalkan|batal)\s+desain$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'ARCHITECTURAL_STUDIO',
        action: 'CANCEL_STUDIO',
        parameters: {},
        reason: 'cancel_arch_studio'
      };
    }

    return {
      matchType: MATCH_TYPES.NONE,
      isCompatible: false,
      studio: 'ARCHITECTURAL_STUDIO',
      action: null,
      parameters: {},
      reason: 'unmatched_arch_command'
    };
  }

  _parseDataLabCommand(text, session) {
    // 0. Collision Check: Standalone unrelated requests like "buat gambar pemandangan" -> NONE
    if (/^(?:buat|generate)\s+gambar\b/i.test(text)) {
      return {
        matchType: MATCH_TYPES.NONE,
        isCompatible: false,
        studio: 'DATA_LAB',
        action: null,
        parameters: {},
        reason: 'image_request_escapes_datalab'
      };
    }

    // 1. Chart Commands: "buat grafik", "buat grafik kedua", "tampilkan grafik"
    const chartIndexedMatch = text.match(/^(?:buat(?:kan)?|tampilkan)\s+grafik\s+(kedua|ketiga|keempat|\d+)$/i);
    if (chartIndexedMatch) {
      const idxMap = { kedua: 2, ketiga: 3, keempat: 4 };
      const chartNum = idxMap[chartIndexedMatch[1].toLowerCase()] || parseInt(chartIndexedMatch[1], 10) || 2;
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: `CREATE_CHART(${chartNum})`,
        parameters: { chartIndex: chartNum },
        reason: 'explicit_indexed_chart'
      };
    }

    if (/^(?:buat(?:kan)?|tampilkan)\s+grafik$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'CREATE_CHART',
        parameters: { chartIndex: 1 },
        reason: 'explicit_chart_command'
      };
    }

    // 2. Table / Statistics / Calculations
    if (/^(?:buat(?:kan)?|tampilkan)\s+tabel$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'CREATE_TABLE',
        parameters: {},
        reason: 'create_table_command'
      };
    }

    if (/^(?:buat(?:kan)?|tampilkan)\s+statistik$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'STATISTICAL_ANALYSIS',
        parameters: {},
        reason: 'statistical_analysis_command'
      };
    }

    if (/^hitung\s+(rata-rata|median|mean|modus|standar\s+deviasi)$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'CALCULATE',
        parameters: { metric: text.replace(/^hitung\s+/i, '').trim() },
        reason: 'calculate_metric_command'
      };
    }

    if (/^bandingkan\s+kelompok/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'COMPARE_GROUPS',
        parameters: {},
        reason: 'compare_groups_command'
      };
    }

    if (/^(?:buat(?:kan)?\s+)?korelasi/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'CORRELATION_ANALYSIS',
        parameters: {},
        reason: 'correlation_analysis_command'
      };
    }

    if (/^(?:buat(?:kan)?\s+)?regresi/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'REGRESSION_ANALYSIS',
        parameters: {},
        reason: 'regression_analysis_command'
      };
    }

    if (/^jelaskan\s+hasil/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'EXPLAIN_RESULT',
        parameters: {},
        reason: 'explain_result_command'
      };
    }

    // 3. Revisions & Parameter updates
    if (/^(?:ubah|ganti)\s+(?:grafik|sumbu\s+[xy])/i.test(text)) {
      return {
        matchType: MATCH_TYPES.STRONG,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'REVISE_CHART',
        parameters: { instruction: text },
        reason: 'revise_chart_command'
      };
    }

    const colParamMatch = text.match(/^gunakan\s+kolom\s+([a-z0-9_\s]+)$/i);
    if (colParamMatch) {
      return {
        matchType: MATCH_TYPES.STRONG,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'UPDATE_ANALYSIS_PARAMETER',
        parameters: { column: colParamMatch[1].trim() },
        reason: 'update_column_parameter'
      };
    }

    // 4. Continuations & Exports
    if (/^(?:lanjut|lanjutkan|next)$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.CONTEXTUAL,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'NEXT_PENDING_OPERATION',
        parameters: {},
        reason: 'contextual_next_operation'
      };
    }

    if (/^ulang\s+analisis$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'REANALYZE',
        parameters: {},
        reason: 'reanalyze_dataset'
      };
    }

    if (/^(?:export|ekspor|download|unduh)\s+(?:excel|xlsx)$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'EXPORT_XLSX',
        parameters: {},
        reason: 'export_excel_format'
      };
    }

    if (/^(?:export|ekspor|download|unduh)\s+csv$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'EXPORT_CSV',
        parameters: {},
        reason: 'export_csv_format'
      };
    }

    if (/^(?:export|ekspor|download|unduh)\s+laporan$/i.test(text)) {
      return {
        matchType: MATCH_TYPES.EXACT,
        isCompatible: true,
        studio: 'DATA_LAB',
        action: 'EXPORT_REPORT',
        parameters: {},
        reason: 'export_data_report'
      };
    }

    return {
      matchType: MATCH_TYPES.NONE,
      isCompatible: false,
      studio: 'DATA_LAB',
      action: null,
      parameters: {},
      reason: 'unmatched_datalab_command'
    };
  }
}

export const studioCommandParserInstance = new StudioCommandParser();
export default studioCommandParserInstance;
