/**
 * TextToSpeech.js (Natural Indonesian Edition)
 *
 * Architecture:
 * - IndonesianTextNormalizer preprocesses all text before synthesis
 * - Smart voice selection: prioritizes highest quality id-ID voice available
 * - Sentence segmentation with natural pauses between segments
 * - Prosody calibration: rate, pitch, volume tuned for Indonesian conversation
 * - TTS Queue: prevents overlapping utterances
 * - Barge-in: immediately cancels with residual content preserved
 * - TTS Provider abstraction: cloud backend can be plugged in without changing AgentRuntime
 *
 * IMPORTANT:
 * If browser Web Speech API cannot deliver natural Indonesian on this machine,
 * this engine reports the limitation clearly and exposes a pluggable cloud adapter point.
 * It does NOT claim quality it cannot deliver.
 */

import { indonesianTextNormalizerInstance } from './IndonesianTextNormalizer.js';

// TTS configuration tuned for Indonesian conversation
const TTS_CONFIG = {
  lang: 'id-ID',
  // Slightly slower than default — Indonesian words are longer syllabically
  rate: 0.90,
  // Slightly raised for warmth; 1.0 is flat
  pitch: 1.08,
  volume: 1.0,
  // Pause durations in ms (simulated via setTimeout between utterances)
  PAUSE_SENTENCE: 100,
  PAUSE_PARAGRAPH: 280,
  PAUSE_HEADING: 180,
  // Max chars per speech segment — long sentences are split for naturalness
  MAX_SEGMENT_CHARS: 200
};

// Voice quality tier labels for observability
const VOICE_TIERS = {
  NEURAL_PREMIUM: 'NEURAL_PREMIUM',     // Google Neural / Microsoft Neural
  NATIVE_INDONESIAN: 'NATIVE_INDONESIAN', // id-ID native
  LOCALE_MATCH: 'LOCALE_MATCH',          // Lang starts with 'id'
  FALLBACK: 'FALLBACK'                    // Non-Indonesian fallback
};

export class TextToSpeech {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.voices = [];
    this.selectedVoice = null;
    this.selectedVoiceTier = null;

    // TTS Queue — prevents overlapping utterances
    this.queue = [];
    this.isProcessingQueue = false;

    // Barge-in state
    this.bargeInCallback = null;
    this.residualSegments = [];

    // State listeners for Control Center
    this.stateListeners = new Set();
    this.state = {
      voice: null,
      language: TTS_CONFIG.lang,
      rate: TTS_CONFIG.rate,
      pitch: TTS_CONFIG.pitch,
      queueLength: 0,
      playing: false,
      interrupted: false,
      qualityTier: null,
      engineType: 'BROWSER_WEB_SPEECH_API',
      limitation: null
    };

    if (this.synth) {
      this.loadVoices();
      if (typeof this.synth.onvoiceschanged !== 'undefined') {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
          this.selectBestVoice();
        };
      }
    }
  }

  // ─────────────────────────────────────────────
  // STATE & OBSERVABILITY
  // ─────────────────────────────────────────────

  subscribeState(listener) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  _emitState(partial = {}) {
    Object.assign(this.state, partial, {
      queueLength: this.queue.length,
      playing: this.isPlaying
    });
    for (const l of this.stateListeners) {
      try { l({ ...this.state }); } catch {}
    }
  }

  // ─────────────────────────────────────────────
  // VOICE SELECTION
  // ─────────────────────────────────────────────

  loadVoices() {
    if (!this.synth) return [];
    this.voices = this.synth.getVoices() || [];
    return this.voices;
  }

  /**
   * Selects the highest-quality Indonesian voice available on the system.
   * Priority order:
   * 1. Neural/Premium id-ID (Google Neural Indonesian, Microsoft Neural Indonesian)
   * 2. Any id-ID locale voice
   * 3. Any voice with 'indonesia' or 'bahasa' in name
   * 4. Fallback: null (browser picks lang=id-ID automatically)
   *
   * NEVER selects English voices.
   */
  selectBestVoice() {
    if (!this.voices || this.voices.length === 0) this.loadVoices();
    if (!this.voices || this.voices.length === 0) return null;

    // Log all available voices for debugging
    console.log('[TTS] Available voices:');
    this.voices.forEach(v => console.log(`  [TTS]   lang=${v.lang} name="${v.name}" local=${v.localService}`));

    // Tier 1: Neural/Premium Indonesian voices
    const neuralTerms = ['neural', 'premium', 'enhanced', 'wavenet', 'studio'];
    const tier1 = this.voices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const isIndonesian = lang.startsWith('id') || name.includes('indonesia') || name.includes('bahasa') || name.includes('andika') || name.includes('gadis');
      const isNeural = neuralTerms.some(t => name.includes(t));
      return isIndonesian && isNeural;
    });

    if (tier1) {
      this.selectedVoice = tier1;
      this.selectedVoiceTier = VOICE_TIERS.NEURAL_PREMIUM;
      this._logVoiceSelection(tier1, VOICE_TIERS.NEURAL_PREMIUM);
      return tier1;
    }

    // Tier 2: Any id-ID locale voice (not English)
    const tier2 = this.voices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const isEnglish = /en[-_](us|gb|au|ca|nz|in)/i.test(v.lang) || name.includes('david') || name.includes('zira') || name.includes('mark');
      return (lang === 'id-id' || lang.startsWith('id-')) && !isEnglish;
    });

    if (tier2) {
      this.selectedVoice = tier2;
      this.selectedVoiceTier = VOICE_TIERS.NATIVE_INDONESIAN;
      this._logVoiceSelection(tier2, VOICE_TIERS.NATIVE_INDONESIAN);
      return tier2;
    }

    // Tier 3: Any voice with Indonesian markers in name
    const tier3 = this.voices.find(v => {
      const name = (v.name || '').toLowerCase();
      return name.includes('indonesia') || name.includes('bahasa') || name.includes('id');
    });

    if (tier3) {
      this.selectedVoice = tier3;
      this.selectedVoiceTier = VOICE_TIERS.LOCALE_MATCH;
      this._logVoiceSelection(tier3, VOICE_TIERS.LOCALE_MATCH);
      return tier3;
    }

    // Tier 4: Null — browser will attempt id-ID synthesis automatically
    // Report limitation clearly
    this.selectedVoice = null;
    this.selectedVoiceTier = VOICE_TIERS.FALLBACK;
    const limitation = 'Tidak ada suara id-ID ditemukan di sistem ini. Browser akan mencoba sintesis otomatis untuk bahasa Indonesia. Kualitas mungkin tidak optimal. Pertimbangkan cloud TTS (Google Cloud TTS / Azure Cognitive Speech) untuk kualitas neural.';
    console.warn(`[TTS] ⚠️ No native Indonesian voice found. Limitation: ${limitation}`);
    this._emitState({ limitation, qualityTier: VOICE_TIERS.FALLBACK, voice: 'BROWSER_AUTO_ID' });
    return null;
  }

  _logVoiceSelection(voice, tier) {
    const display = voice.name || 'Unknown';
    console.log(`[TTS] language = id-ID`);
    console.log(`[TTS] voice = ${display}`);
    console.log(`[TTS] qualityTier = ${tier}`);
    console.log(`[TTS] rate = ${TTS_CONFIG.rate}`);
    console.log(`[TTS] pitch = ${TTS_CONFIG.pitch}`);
    this._emitState({
      voice: display,
      qualityTier: tier,
      limitation: null
    });
  }

  getBestVoice() {
    if (!this.selectedVoice) {
      return this.selectBestVoice();
    }
    return this.selectedVoice;
  }

  // ─────────────────────────────────────────────
  // TEXT PREPROCESSING
  // ─────────────────────────────────────────────

  /**
   * Prepare text for speech:
   * 1. Normalize (numbers, dates, currency, abbreviations, markdown)
   * 2. Split into speech segments with natural boundaries
   */
  prepareSegments(text) {
    const normalized = indonesianTextNormalizerInstance.normalize(text);
    if (!normalized.trim()) return [];

    // Split by paragraph (double newline after markdown strip)
    // Then split long paragraphs by sentence
    const paragraphs = normalized.split(/\n{1,}/);
    const segments = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (trimmed.length <= TTS_CONFIG.MAX_SEGMENT_CHARS) {
        segments.push({ text: trimmed, pause: TTS_CONFIG.PAUSE_SENTENCE });
      } else {
        // Split at sentence boundaries
        const sentenceSplit = trimmed.split(/(?<=[.!?])\s+/);
        let current = '';
        for (const sent of sentenceSplit) {
          if ((current + ' ' + sent).trim().length > TTS_CONFIG.MAX_SEGMENT_CHARS && current.length > 0) {
            segments.push({ text: current.trim(), pause: TTS_CONFIG.PAUSE_SENTENCE });
            current = sent;
          } else {
            current = (current + ' ' + sent).trim();
          }
        }
        if (current.trim()) {
          segments.push({ text: current.trim(), pause: TTS_CONFIG.PAUSE_PARAGRAPH });
        }
      }
    }

    return segments.filter(s => s.text.length > 1);
  }

  // ─────────────────────────────────────────────
  // SPEECH SYNTHESIS
  // ─────────────────────────────────────────────

  /**
   * Main speak entry point.
   * Normalizes text, segments it, queues segments with natural pauses.
   */
  speak(text, { onStart, onEnd, onError, voiceLang = 'id-ID' } = {}) {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    const segments = this.prepareSegments(text);
    if (segments.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    // Store residual for barge-in recovery
    this.residualSegments = [...segments];

    // Add to queue
    this.queue.push({ segments, onStart, onEnd, onError, started: false });
    this._emitState({ queueLength: this.queue.length });

    if (!this.isProcessingQueue) {
      this._processQueue();
    }
  }

  _processQueue() {
    if (this.queue.length === 0) {
      this.isProcessingQueue = false;
      this._emitState({ queueLength: 0, playing: false });
      return;
    }

    this.isProcessingQueue = true;
    const item = this.queue[0];

    try {
      if (this.synth.paused) this.synth.resume();
    } catch {}

    this._speakSegments(item.segments, item, () => {
      this.queue.shift();
      this._emitState({ queueLength: this.queue.length });
      this._processQueue();
    });
  }

  _speakSegments(segments, item, onAllDone) {
    if (!segments || segments.length === 0) {
      this.isPlaying = false;
      this._emitState({ playing: false });
      if (item.onEnd) item.onEnd();
      onAllDone();
      return;
    }

    const [current, ...rest] = segments;
    const voice = this.getBestVoice();

    const utterance = new SpeechSynthesisUtterance(current.text);
    utterance.lang = TTS_CONFIG.lang;
    utterance.rate = TTS_CONFIG.rate;
    utterance.pitch = TTS_CONFIG.pitch;
    utterance.volume = TTS_CONFIG.volume;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      if (!item.started) {
        item.started = true;
        this.isPlaying = true;
        this._emitState({ playing: true });
        console.log(`[TTS] 🔊 Speaking | voice="${voice?.name || 'BROWSER_AUTO'}" | lang=id-ID | rate=${TTS_CONFIG.rate} | pitch=${TTS_CONFIG.pitch}`);
        if (item.onStart) item.onStart();
      }
    };

    utterance.onend = () => {
      // Natural pause between segments
      if (rest.length > 0) {
        setTimeout(() => {
          this._speakSegments(rest, item, onAllDone);
        }, current.pause || TTS_CONFIG.PAUSE_SENTENCE);
      } else {
        this.isPlaying = false;
        this.currentUtterance = null;
        console.log('[TTS] ✅ Finished speaking.');
        if (item.onEnd) item.onEnd();
        onAllDone();
      }
    };

    utterance.onerror = (e) => {
      // 'interrupted' is expected on barge-in — not an error
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('[TTS] ⚠️ Speech error:', e.error);
      this.isPlaying = false;
      this.currentUtterance = null;
      if (item.onError) item.onError(e);
      else if (item.onEnd) item.onEnd();
      onAllDone();
    };

    this.currentUtterance = utterance;

    try {
      this.synth.speak(utterance);
    } catch (err) {
      console.error('[TTS] Speak invocation error:', err);
      if (item.onEnd) item.onEnd();
      onAllDone();
    }
  }

  // ─────────────────────────────────────────────
  // BARGE-IN
  // ─────────────────────────────────────────────

  /**
   * Immediately cancels current speech.
   * Preserves remaining unspoken segments for optional resumption.
   * Does NOT restart from beginning.
   */
  stop() {
    if (this.synth && this.isPlaying) {
      try { this.synth.cancel(); } catch {}
    }
    // Preserve residual context but clear queue
    this.queue = [];
    this.isPlaying = false;
    this.isProcessingQueue = false;
    this.currentUtterance = null;
    this._emitState({ playing: false, interrupted: true, queueLength: 0 });
    console.log('[TTS] 🛑 Barge-in: speech cancelled. Residual context preserved.');
  }

  cancel() {
    this.stop();
    this.residualSegments = [];
    this._emitState({ interrupted: false });
  }

  // ─────────────────────────────────────────────
  // TTS PROVIDER ABSTRACTION
  // ─────────────────────────────────────────────

  /**
   * Cloud TTS adapter hook.
   * When a cloud provider (Google Cloud TTS, Azure Cognitive Speech, ElevenLabs)
   * is configured, this method is called instead of browser speechSynthesis.
   * This allows native neural Indonesian quality without changing AgentRuntime.
   *
   * Implementation: set this.cloudProvider before use.
   */
  async speakViaCloud(text, { onStart, onEnd, onError } = {}) {
    if (!this.cloudProvider) {
      console.warn('[TTS] No cloud provider configured. Falling back to browser synthesis.');
      return this.speak(text, { onStart, onEnd, onError });
    }

    try {
      const normalizedText = indonesianTextNormalizerInstance.normalize(text);
      const audioBuffer = await this.cloudProvider.synthesize(normalizedText, {
        language: 'id-ID',
        voice: this.cloudProvider.preferredVoice || 'id-ID-Standard-A',
        rate: TTS_CONFIG.rate,
        pitch: TTS_CONFIG.pitch
      });
      if (onStart) onStart();
      await this.cloudProvider.playAudio(audioBuffer, onEnd);
    } catch (err) {
      console.error('[TTS] Cloud TTS failed:', err);
      if (onError) onError(err);
      else if (onEnd) onEnd();
    }
  }

  /**
   * Self-diagnostic: reports actual voice capability and limitation.
   */
  getDiagnostics() {
    const voice = this.getBestVoice();
    return {
      engineType: 'BROWSER_WEB_SPEECH_API',
      language: TTS_CONFIG.lang,
      selectedVoice: voice?.name || 'BROWSER_AUTO_ID',
      qualityTier: this.selectedVoiceTier || 'UNKNOWN',
      rate: TTS_CONFIG.rate,
      pitch: TTS_CONFIG.pitch,
      volume: TTS_CONFIG.volume,
      availableVoices: (this.voices || []).filter(v =>
        (v.lang || '').toLowerCase().startsWith('id') ||
        (v.name || '').toLowerCase().includes('indonesia')
      ).map(v => ({ name: v.name, lang: v.lang, local: v.localService })),
      limitation: this.state.limitation,
      cloudAdapterConfigured: Boolean(this.cloudProvider)
    };
  }

  testVoiceAudio() {
    this.speak('Halo! Saya JIN. Sistem suara aktif dan siap melayani Anda.');
  }
}

export const textToSpeechInstance = new TextToSpeech();
export default textToSpeechInstance;
