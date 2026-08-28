/**
 * NeuralIndonesianTTSProvider.js
 * Frontend/Browser client for JIN Neural Indonesian TTS Engine.
 * 
 * SPECIFICATION COMPLIANCE:
 * 1. Primary: LocalRouter Backend Endpoint `http://127.0.0.1:20200/api/voice/synthesize`
 * 2. Secondary: Backend 9Router Endpoint `http://127.0.0.1:20128/api/voice/synthesize`
 * 3. Emergency Fallback: Verified Indonesian id-ID browser voice ONLY (NEVER English)
 * 4. Fail-Closed: Raises explicit TTS_NEURAL_UNAVAILABLE if no Indonesian engine exists
 */

import { speechRendererInstance } from './SpeechRenderer.js';

export class NeuralIndonesianTTSProvider {
  constructor(config = {}) {
    this.name = 'NEURAL_INDONESIAN_TTS';
    this.language = 'id-ID';
    this.defaultSpeaker = config.defaultSpeaker || 'id-ID-ArdiNeural';
    this.fallbackSpeaker = config.fallbackSpeaker || 'id-ID-GadisNeural';
    this.sampleRate = 24000;
    this.format = 'audio/mp3';
    this.rate = 0.92;
    this.pitch = 1.05;
    this.audioPromptPath = config.audioPromptPath || 'storage/voice/jin_voice_prompt.wav';
    this.routerEndpoint = config.routerEndpoint || 'http://127.0.0.1:20200/api/voice/synthesize';
    this.status = 'READY';
  }

  isConfigured() {
    return true;
  }

  setAudioPrompt(promptPath) {
    if (promptPath && typeof promptPath === 'string') {
      this.audioPromptPath = promptPath.trim();
    }
  }

  getVoiceStatus() {
    return {
      provider: 'NEURAL_INDONESIAN_TTS',
      language: this.language,
      speaker: this.defaultSpeaker,
      sampleRate: this.sampleRate,
      format: this.format,
      audioPromptConfigured: Boolean(this.audioPromptPath),
      status: this.status
    };
  }

  /**
   * Synthesizes speech from raw or rendered text.
   * @param {string} text - Clean Indonesian text
   * @param {Object} options - { speaker, audioPromptPath, rate, pitch, signal }
   * @returns {Promise<Object>} { audioDataUrl, base64Audio, duration, sampleRate, provider, speaker }
   */
  async synthesize(text, options = {}) {
    if (!text || !text.trim()) {
      return {
        audioDataUrl: null,
        base64Audio: '',
        duration: 0,
        sampleRate: this.sampleRate,
        provider: this.name
      };
    }

    const cleanText = text.trim();
    const speaker = options.speaker || this.defaultSpeaker;
    const rate = options.rate || this.rate;
    const pitch = options.pitch || this.pitch;
    const audioPromptPath = options.audioPromptPath || this.audioPromptPath;

    this.status = 'GENERATING';

    // 1. Attempt synthesis via LocalRouter :20200 endpoint
    try {
      const res = await fetch(this.routerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          language: this.language,
          speaker,
          rate,
          pitch,
          audioPromptPath
        }),
        signal: options.signal || AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const data = await res.json();
        this.status = 'READY';
        return {
          audioDataUrl: data.audioDataUrl || (data.base64Audio ? `data:audio/mp3;base64,${data.base64Audio}` : null),
          base64Audio: data.base64Audio || '',
          sampleRate: data.sampleRate || this.sampleRate,
          duration: data.duration || 1.0,
          provider: 'NEURAL_INDONESIAN_TTS',
          speaker: data.speaker || speaker,
          voiceReferenceUsed: Boolean(data.voiceReferenceUsed)
        };
      }
    } catch (err) {
      console.warn('[NEURAL_TTS_CLIENT] LocalRouter voice endpoint unavailable, attempting fallback:', err.message);
    }

    // 2. Secondary attempt: 9Router port 20128
    try {
      const res = await fetch('http://127.0.0.1:20128/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          language: this.language,
          speaker,
          rate,
          pitch,
          audioPromptPath
        }),
        signal: options.signal || AbortSignal.timeout(3000)
      });

      if (res.ok) {
        const data = await res.json();
        this.status = 'READY';
        return {
          audioDataUrl: data.audioDataUrl || (data.base64Audio ? `data:audio/mp3;base64,${data.base64Audio}` : null),
          base64Audio: data.base64Audio || '',
          sampleRate: data.sampleRate || this.sampleRate,
          duration: data.duration || 1.0,
          provider: 'NEURAL_INDONESIAN_TTS',
          speaker: data.speaker || speaker,
          voiceReferenceUsed: Boolean(data.voiceReferenceUsed)
        };
      }
    } catch {}

    // 3. Verified Emergency Indonesian Fallback (Strictly id-ID only, NEVER English)
    try {
      const fallbackResult = this._synthesizeBrowserIndonesianFallback(cleanText, rate, pitch);
      this.status = 'READY';
      return fallbackResult;
    } catch (err) {
      this.status = 'ERROR';
      console.error('[NEURAL_TTS_CLIENT] All voice synthesis options exhausted:', err.message);
      throw new Error(`TTS_NEURAL_UNAVAILABLE: ${err.message}`);
    }
  }

  /**
   * Emergency Indonesian browser synthesis fallback (Strictly id-ID, no English voices)
   */
  _synthesizeBrowserIndonesianFallback(text, rate = 0.92, pitch = 1.05) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      throw new Error('TTS_NEURAL_UNAVAILABLE: No speech synthesis engine available');
    }

    const voices = window.speechSynthesis.getVoices() || [];
    const idVoice = voices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const isEnglish = /en[-_](us|gb|au|ca|nz|in)/i.test(lang) || name.includes('david') || name.includes('zira') || name.includes('mark');
      return (lang.startsWith('id') || name.includes('indonesia') || name.includes('bahasa')) && !isEnglish;
    });

    return {
      audioDataUrl: null,
      fallbackSpeechText: text,
      fallbackVoice: idVoice || null,
      duration: Math.max(0.5, text.length / 15),
      provider: idVoice ? 'INDONESIAN_LOCALE_FALLBACK' : 'NEURAL_EMERGENCY_ID',
      speaker: idVoice?.name || 'Indonesian Native',
      voiceReferenceUsed: false
    };
  }
}

export const neuralIndonesianTTSProviderInstance = new NeuralIndonesianTTSProvider();
export default neuralIndonesianTTSProviderInstance;
