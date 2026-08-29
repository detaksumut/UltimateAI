/**
 * DisplaySpeechSeparationEngine.js
 * ULTIMATEAI — DISPLAY-SPEECH SEPARATION ARCHITECTURE
 * 
 * CORE INVARIANT:
 * DISPLAY CONTENT != SPEECH CONTENT
 *
 * Pipelines:
 * RAW DATA / ANALYSIS → DISPLAY RENDERER (Full Visual Data: Tables, Charts, Code, Citations)
 *                     → USER-RELEVANT INSIGHTS → SPEECH RENDERER → TTS (Concise Human Spoken Summary)
 */

import { indonesianTextNormalizerInstance } from './IndonesianTextNormalizer.js';

export const RESPONSE_MODALITIES = {
  TEXT_ONLY: 'TEXT_ONLY',
  SPEECH_ONLY: 'SPEECH_ONLY',
  TEXT_AND_SPEECH: 'TEXT_AND_SPEECH',
  ARTIFACT_ONLY: 'ARTIFACT_ONLY',
  NO_OUTPUT: 'NO_OUTPUT'
};

export class TableSpeechSummarizer {
  /**
   * Summarize structured tables into concise human insights for speech.
   * @param {string} text - Raw text containing markdown or tabular data
   * @param {string} userPrompt - Original user question/command
   * @param {boolean} isExplicitReadRequest - True if user said "bacakan seluruh tabel/harga"
   */
  static summarize(text, userPrompt = '', isExplicitReadRequest = false) {
    const tableRegex = /\|[^\n]+\|\n\|[-:\s|]+\|\n((?:\|[^\n]+\|\n?)+)/g;
    const match = tableRegex.exec(text);

    if (!match) {
      return {
        speechText: text,
        omittedDetails: false,
        keyFindings: []
      };
    }

    const rows = match[1].trim().split('\n').filter(Boolean);
    const rowCount = rows.length;

    // Check if user explicitly requested full verbal reading
    if (isExplicitReadRequest) {
      const parsedRows = rows.map(r => {
        const cells = r.split('|').map(c => c.trim()).filter(Boolean);
        return cells.join(': ');
      });
      return {
        speechText: `Berikut rincian lengkapnya: ${parsedRows.join('. ')}.`,
        omittedDetails: false,
        keyFindings: parsedRows
      };
    }

    // Specific item query (e.g. "Berapa harga beras premium?")
    const lowerPrompt = (userPrompt || '').toLowerCase();
    for (const r of rows) {
      const cells = r.split('|').map(c => c.trim()).filter(Boolean);
      const itemName = (cells[0] || '').toLowerCase();
      if (itemName && lowerPrompt.includes(itemName)) {
        const itemVal = cells[1] || '';
        return {
          speechText: `Harga ${cells[0]} hari ini ${itemVal}.`,
          omittedDetails: true,
          keyFindings: [`${cells[0]}: ${itemVal}`]
        };
      }
    }

    // Commodity / Sembako detection
    if (/sembako|harga|pasar|komoditas|pangan/i.test(userPrompt) || /sembako|harga|beras|gula|minyak|telur/i.test(text)) {
      return {
        speechText: 'Harga sembako hari ini sudah saya tampilkan di layar. Perubahan paling menonjol ada pada harga beras dan gula.',
        omittedDetails: true,
        keyFindings: [`Total ${rowCount} komoditas ditampilkan di layar.`]
      };
    }

    // Generic table default: Concise summary
    return {
      speechText: `Data tabel berisi ${rowCount} baris sudah saya tampilkan di layar.`,
      omittedDetails: true,
      keyFindings: [`Total ${rowCount} baris data disajikan secara visual.`]
    };
  }
}

export class ChartSpeechSummarizer {
  static summarize(text, userPrompt = '') {
    return {
      speechText: 'Grafiknya sudah saya tampilkan. Tren utama tersaji lengkap di panel layar.',
      omittedDetails: true
    };
  }
}

export class DocumentSpeechSummarizer {
  static summarize(text, userPrompt = '') {
    return {
      speechText: 'Dokumennya sudah saya analisis secara mendalam. Ringkasan temuan kunci tersaji di layar.',
      omittedDetails: true
    };
  }
}

export class CodeSpeechSummarizer {
  static summarize(text, userPrompt = '') {
    return {
      speechText: 'Script dan purwarupa aplikasinya sudah dibuat dan siap digunakan di layar.',
      omittedDetails: true
    };
  }
}

export class WebSearchSpeechSummarizer {
  static summarize(text, userPrompt = '') {
    return {
      speechText: 'Saya menemukan beberapa sumber berita dan riset yang relevan. Ringkasan poin utamanya sudah tersaji di layar.',
      omittedDetails: true
    };
  }
}

export class DisplaySpeechSeparationEngine {
  /**
   * Validate that raw markup, code blocks, raw JSON, and raw markdown table pipes NEVER enter TTS.
   */
  static validateSpeechInput(text) {
    if (!text || typeof text !== 'string') return '';

    let clean = text;

    // 1. Hard Reject: Raw JSON blocks
    clean = clean.replace(/\{[\s\S]*?"[^"]+"\s*:\s*[\s\S]*?\}/g, '');

    // 2. Hard Reject: Raw Code blocks
    clean = clean.replace(/```[\s\S]*?```/g, '');
    clean = clean.replace(/`[^`]+`/g, '');

    // 3. Hard Reject: Raw Markdown tables (pipes)
    clean = clean.replace(/\|[^\n]+\|/g, '');

    // 4. Hard Reject: Raw HTML & XML tags
    clean = clean.replace(/<[^>]+>/g, '');

    // 5. Hard Reject: Raw URLs & Protocols
    clean = clean.replace(/https?:\/\/[^\s]+/g, '');

    // 6. Hard Reject: Raw punctuation symbols
    clean = clean.replace(/[#*_~`|{}[\]()<>\\^]/g, ' ');

    // 7. Normalize spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
  }

  /**
   * Separate raw agent response into distinct displayContent and speechContent.
   * @param {string} rawResponse - Full text response from LLM/agent
   * @param {string} userPrompt - Prompt sent by user
   * @param {Object} options - Additional context options
   * @returns {Object} AgentResponseObject
   */
  static separate(rawResponse = '', userPrompt = '', options = {}) {
    const raw = (rawResponse || '').trim();
    const prompt = (userPrompt || '').trim();
    const lowerPrompt = prompt.toLowerCase();

    // Check explicit read requests
    const isExplicitReadRequest = /\b(bacakan|baca seluruh|jelaskan semua|baca semua|bacakan tabel|bacakan harga)\b/i.test(lowerPrompt);

    // 1. Extract visual artifacts (HTML/UI, Code, Citations)
    const artifacts = [];
    const htmlMatch = raw.match(/```(?:html|xml|ui)\s*([\s\S]*?)\s*```/i);
    if (htmlMatch && htmlMatch[1]) {
      artifacts.push({ type: 'HTML_APP', code: htmlMatch[1] });
    }

    const codeMatch = raw.match(/```(?:python|javascript|typescript|js|ts|sql|json)\s*([\s\S]*?)\s*```/i);
    if (codeMatch && codeMatch[1]) {
      artifacts.push({ type: 'CODE_SNIPPET', code: codeMatch[1] });
    }

    // 2. Generate DISPLAY CONTENT (Full visual fidelity)
    const displayContent = raw;

    // 3. Generate SPEECH CONTENT (Concise human-like summary)
    let speechContent = '';
    let modality = RESPONSE_MODALITIES.TEXT_AND_SPEECH;

    const hasTable = /\|[^\n]+\|\n\|[-:\s|]+\|/i.test(raw);
    const hasChart = /<canvas|<svg|chart|grafik/i.test(raw) || /grafik|chart/i.test(lowerPrompt);
    const hasCode = /```(?:html|js|ts|py|python|sql|json)/i.test(raw);
    const isDocumentAnalysis = /ringkasan eksekutif|temuan kunci|bab \d|metodologi/i.test(raw) && raw.length > 800;
    const isWebSearch = /sumber:|referensi:|portal berita|source network/i.test(raw);

    if (hasTable) {
      const summary = TableSpeechSummarizer.summarize(raw, prompt, isExplicitReadRequest);
      speechContent = summary.speechText;
    } else if (hasChart && hasCode) {
      const summary = ChartSpeechSummarizer.summarize(raw, prompt);
      speechContent = summary.speechText;
    } else if (hasCode) {
      const summary = CodeSpeechSummarizer.summarize(raw, prompt);
      speechContent = summary.speechText;
    } else if (isDocumentAnalysis) {
      const summary = DocumentSpeechSummarizer.summarize(raw, prompt);
      speechContent = summary.speechText;
    } else if (isWebSearch && raw.length > 500) {
      const summary = WebSearchSpeechSummarizer.summarize(raw, prompt);
      speechContent = summary.speechText;
    } else {
      // General prose response: take opening concise insight paragraphs
      const paragraphs = raw.split(/\n\n+/).filter(p => !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('```'));
      if (paragraphs.length > 0) {
        speechContent = paragraphs.slice(0, 2).join(' ');
      } else {
        speechContent = raw;
      }
    }

    // 4. Normalize numbers, currency, percentages and units
    speechContent = indonesianTextNormalizerInstance.normalize(speechContent);

    // 5. Final Speech Contract Validation & Stripping
    speechContent = this.validateSpeechInput(speechContent);

    // If speech content is empty or modality is artifact only
    if (!speechContent || speechContent.trim().length === 0) {
      speechContent = 'Informasi yang Anda minta sudah saya tampilkan di layar.';
    }

    const displayLength = displayContent.length || 1;
    const speechLength = speechContent.length;
    const speechToDisplayRatio = Number((speechLength / displayLength).toFixed(3));

    return {
      displayContent,
      speechContent,
      artifacts,
      citations: [],
      internalMetadata: {
        isExplicitReadRequest,
        hasTable,
        hasChart,
        hasCode,
        isDocumentAnalysis
      },
      modality,
      speechToDisplayRatio
    };
  }
}

export const displaySpeechSeparationEngineInstance = DisplaySpeechSeparationEngine;
