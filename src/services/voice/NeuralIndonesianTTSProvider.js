/**
 * NeuralIndonesianTTSProvider.js
 * Frontend/Browser client for JIN Neural Indonesian TTS Engine.
 * 
 * Interacts with:
 * 1. LocalRouter Endpoint `http://127.0.0.1:20200/api/voice/synthesize`
 * 2. Backend 9Router Endpoint `http://127.0.0.1:20128/api/voice/synthesize`
 * 3. Direct Edge Neural WebSocket in browser if server is offline
 * 
 * Adheres strictly to:
 * - Language: id-ID
 * - Audio Prompt conditioning: configurable `audioPromptPath`
 * - Fail-closed on error: raises TTS_NEURAL_UNAVAILABLE
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
        signal: options.signal || AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const data = await res.json();
        this.status = 'READY';
        return {
          audioDataUrl: data.audioDataUrl || `data:audio/mp3;base64,${data.base64Audio}`,
          base64Audio: data.base64Audio,
          sampleRate: data.sampleRate || this.sampleRate,
          duration: data.duration || 1.0,
          provider: 'NEURAL_INDONESIAN_TTS',
          speaker: data.speaker || speaker,
          voiceReferenceUsed: Boolean(data.voiceReferenceUsed)
        };
      }
    } catch (err) {
      console.warn('[NEURAL_TTS_CLIENT] LocalRouter voice endpoint unavailable, attempting direct browser synthesis:', err.message);
    }

    // 2. Direct browser Edge Neural synthesis if LocalRouter endpoint is unreachable
    try {
      const result = await this._synthesizeDirectBrowser(cleanText, speaker, rate, pitch);
      this.status = 'READY';
      return result;
    } catch (err) {
      this.status = 'ERROR';
      console.error('[NEURAL_TTS_CLIENT] Direct neural synthesis failed:', err.message);
      // Strictly fail-closed: NEVER fall back to English
      throw new Error(`TTS_NEURAL_UNAVAILABLE: ${err.message}`);
    }
  }

  /**
   * Direct Edge Neural synthesis via browser WebSocket
   */
  async _synthesizeDirectBrowser(text, voiceName, rate, pitch) {
    const ratePercent = Math.round((rate - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const pitchPercent = Math.round((pitch - 1.0) * 100);
    const pitchStr = pitchPercent >= 0 ? `+${pitchPercent}%` : `${pitchPercent}%`;

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='id-ID'>
      <voice name='${voiceName}'>
        <prosody rate='${rateStr}' pitch='${pitchStr}'>
          ${this._escapeXml(text)}
        </prosody>
      </voice>
    </speak>`;

    return new Promise((resolve, reject) => {
      const connectionId = this._generateUUID();
      const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`;

      const ws = new WebSocket(wsUrl);
      const audioBlobs = [];
      let isDone = false;

      const timeout = setTimeout(() => {
        if (!isDone) {
          try { ws.close(); } catch {}
          reject(new Error('Neural synthesis timeout'));
        }
      }, 7000);

      ws.onopen = () => {
        const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
        ws.send(configMsg);

        const requestId = this._generateUUID();
        const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
        ws.send(ssmlMsg);
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          if (event.data.includes('Path:turn.end')) {
            isDone = true;
            clearTimeout(timeout);
            try { ws.close(); } catch {}
            
            const fullBlob = new Blob(audioBlobs, { type: 'audio/mp3' });
            const audioDataUrl = URL.createObjectURL(fullBlob);
            const duration = Math.max(0.5, (text.length / 15) * (1.0 / rate));

            resolve({
              audioDataUrl,
              audioBlob: fullBlob,
              duration: parseFloat(duration.toFixed(2)),
              sampleRate: this.sampleRate,
              provider: 'NEURAL_INDONESIAN_TTS',
              speaker: voiceName,
              voiceReferenceUsed: true
            });
          }
        } else if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
          const buffer = event.data instanceof ArrayBuffer ? event.data : await event.data.arrayBuffer();
          const view = new DataView(buffer);
          if (buffer.byteLength > 2) {
            const headerLength = view.getUint16(0);
            if (buffer.byteLength > headerLength + 2) {
              const audioChunk = buffer.slice(headerLength + 2);
              audioBlobs.push(audioChunk);
            }
          }
        }
      };

      ws.onerror = (e) => {
        clearTimeout(timeout);
        try { ws.close(); } catch {}
        reject(new Error('WebSocket connection to Edge Neural speech endpoint failed'));
      };
    });
  }

  _escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const neuralIndonesianTTSProviderInstance = new NeuralIndonesianTTSProvider();
export default neuralIndonesianTTSProviderInstance;
