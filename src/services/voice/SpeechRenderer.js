/**
 * SpeechRenderer.js
 * Transforms JIN's rich, structured display responses into natural, human-like spoken Indonesian.
 * 
 * ARCHITECTURE ROLE:
 * JIN response (Display / Markdown / Structured Analysis)
 *   ↓
 * SpeechRenderer (Normalizes, converts layout to conversational prosody, segments)
 *   ↓
 * TTS Provider (NeuralIndonesianTTSProvider)
 *   ↓
 * JinAudioQueue (Web Audio / Audio Playback)
 * 
 * Core Rules:
 * 1. Never read raw markdown symbols (###, **, ---, [], {}, code blocks, URLs).
 * 2. Convert headers into natural introductory clauses ("Kesimpulannya.", "Mengenai analisis risiko.", etc.).
 * 3. Convert bullet/numbered points into conversational enumerators ("Pertama...", "Kedua...", "Ketiga...").
 * 4. Apply Indonesian text normalization (numbers, dates, currency, percentages, abbreviations).
 * 5. Provide segment array for sentence-based neural TTS generation and streaming playback.
 */

import { indonesianTextNormalizerInstance } from './IndonesianTextNormalizer.js';

export class SpeechRenderer {
  constructor(normalizer = indonesianTextNormalizerInstance) {
    this.normalizer = normalizer;
  }

  /**
   * Renders detailed display text into clean, conversational Indonesian speech.
   * @param {string} rawText - Detailed response text from JIN
   * @param {Object} options - Rendering options { maxSentences, isVoiceOnly, tone }
   * @returns {Object} { speechText, segments, originalText, stats }
   */
  renderForSpeech(rawText, options = {}) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return {
        speechText: '',
        segments: [],
        originalText: rawText || '',
        stats: { sentenceCount: 0, charCount: 0 }
      };
    }

    let text = rawText.trim();

    // 1. Transform Markdown Headings to Conversational Transitions
    text = this._convertHeadingsToSpokenPhrases(text);

    // 2. Transform Structured Lists (Bullets / Numbered) to Spoken Sequences
    text = this._convertListsToSpokenSequences(text);

    // 3. Transform Key-Value Labels (e.g. "**Status:** Selesai")
    text = text.replace(/\*\*([A-Za-z\s]+):\*\*\s+/g, '$1, ');
    text = text.replace(/([A-Za-z\s]+):\s+/g, '$1, ');

    // 4. Clean Markdown & Code fences
    text = this.normalizer.stripMarkdown(text);

    // 5. Full Linguistic Normalization (numbers, currency, dates, percentages, abbreviations)
    text = this.normalizer.normalize(text);

    // 6. Natural Conversational Smoothing (remove redundant punctuation and clean spacing)
    text = this._smoothPunctuation(text);

    // 7. Sentence & Paragraph Segmentation for Neural TTS Generation
    const segments = this._buildSpeechSegments(text, options.maxSegmentChars || 180);

    const speechText = segments.join(' ').trim();

    return {
      speechText,
      segments,
      originalText: rawText,
      stats: {
        sentenceCount: segments.length,
        charCount: speechText.length
      }
    };
  }

  /**
   * Convert markdown headings into spoken Indonesian introductory phrases.
   */
  _convertHeadingsToSpokenPhrases(text) {
    return text.replace(/^#{1,6}\s+(.+)$/gm, (match, heading) => {
      const h = heading.trim().toLowerCase();
      if (h.includes('kesimpulan') || h.includes('ringkasan') || h.includes('summary')) {
        return 'Kesimpulannya.';
      }
      if (h.includes('rekomendasi')) {
        return 'Berikut rekomendasinya.';
      }
      if (h.includes('analisis') || h.includes('temuan')) {
        return `Terkait ${heading.trim()}.`;
      }
      if (h.includes('risiko') || h.includes('dampak')) {
        return `Mengenai ${heading.trim()}.`;
      }
      if (h.includes('latar belakang') || h.includes('konteks')) {
        return `Sebagai konteks.`;
      }
      return `${heading.trim()}.`;
    });
  }

  /**
   * Convert structured list items into conversational enumerators.
   */
  _convertListsToSpokenSequences(text) {
    const listWords = ['Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima', 'Keenam', 'Ketujuh'];
    let itemIndex = 0;

    // Replace bullet points at start of lines
    return text.replace(/^[\s]*[-*+]\s+(.+)$/gm, (match, item) => {
      const prefix = listWords[itemIndex] || 'Selanjutnya';
      itemIndex++;
      let cleanedItem = item.trim();
      // Remove trailing colon or semicolon
      cleanedItem = cleanedItem.replace(/[:;]$/, '.');
      return `${prefix}, ${cleanedItem}`;
    });
  }

  /**
   * Smooths punctuation for natural TTS prosody.
   */
  _smoothPunctuation(text) {
    let t = text;
    // Replace multiple periods/ellipses with single pause period
    t = t.replace(/\.{2,}/g, '.');
    // Ensure space after punctuation
    t = t.replace(/([.,!?;:])([^\s\d])/g, '$1 $2');
    // Remove standalone dashes or arrows
    t = t.replace(/\s+[-–—→]\s+/g, ', ');
    // Remove isolated single quotes or brackets
    t = t.replace(/["'(){}[\]]/g, ' ');
    // Normalize spaces
    t = t.replace(/\s{2,}/g, ' ');
    return t.trim();
  }

  /**
   * Builds speech segment chunks preserving sentence and semantic boundaries.
   * Each sentence becomes an individual speech segment for natural inter-sentence pauses.
   */
  _buildSpeechSegments(text, maxChars = 180) {
    if (!text) return [];

    // Split on sentence boundaries: . ! ?
    const rawSentences = text.split(/(?<=[.!?])\s+/);
    const segments = [];
    let buffer = '';

    for (const sentence of rawSentences) {
      const clean = sentence.trim();
      if (!clean) continue;

      // If previous buffer was very short (e.g. "Baik.", "Halo."), merge it with current
      if (buffer.length > 0 && buffer.length < 25) {
        buffer = (buffer + ' ' + clean).trim();
      } else {
        if (buffer) segments.push(buffer);
        buffer = clean;
      }

      // If current buffer exceeds maxChars, split by comma or clauses
      if (buffer.length > maxChars) {
        const clauses = buffer.split(/(?<=[,;])\s+/);
        let clauseBuffer = '';
        for (const clause of clauses) {
          if ((clauseBuffer + ' ' + clause).trim().length <= maxChars) {
            clauseBuffer = (clauseBuffer + ' ' + clause).trim();
          } else {
            if (clauseBuffer) segments.push(clauseBuffer);
            clauseBuffer = clause;
          }
        }
        buffer = clauseBuffer;
      }
    }

    if (buffer.trim()) {
      segments.push(buffer.trim());
    }

    return segments.filter(s => s.length > 0);
  }
}

export const speechRendererInstance = new SpeechRenderer();
export default speechRendererInstance;
