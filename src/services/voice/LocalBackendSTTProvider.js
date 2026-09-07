/**
 * LocalBackendSTTProvider.js
 * Production Local Audio Recording & Backend Speech-to-Text Provider.
 * Captures real mic audio via MediaRecorder, runs local VAD silence detection,
 * and transcribes spoken Indonesian via LocalRouter /api/voice/transcribe.
 */

import { BaseSTTProvider } from './STTProvider.js';

export class LocalBackendSTTProvider extends BaseSTTProvider {
  constructor(endpoint = 'http://127.0.0.1:20200/api/voice/transcribe') {
    super('LOCAL_BACKEND_STT');
    this.endpoint = endpoint;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
  }

  isAvailable() {
    return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async start({ onStart, onTranscript, onFinalTranscript, onError, onEnd } = {}) {
    if (!this.isAvailable()) {
      if (onError) onError(new Error('MEDIA_RECORDER_UNAVAILABLE'));
      return false;
    }

    this.audioChunks = [];
    this.isListening = true;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });

      console.log('[VOG] MIC_STARTED | Engine: LOCAL_BACKEND_STT | Lang: id-ID');
      if (onStart) onStart();

      // Setup VAD (Voice Activity Detector)
      this._setupVAD(this.mediaStream, () => {
        console.log('[VOG] VAD_SPEECH_END | Silence detected, finalizing audio capture');
        this.stop();
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        this.isListening = false;
        this._cleanupVAD();

        const fullAudioBlob = new Blob(this.audioChunks, { type: mimeType });
        console.log(`[VOG] AUDIO_STREAM_ENDED | Captured: ${fullAudioBlob.size} bytes`);

        if (fullAudioBlob.size < 500) {
          console.warn('[VOG] STT_NO_RESULT: Audio stream too short');
          if (onError) onError(new Error('AUDIO_TOO_SHORT'));
          return;
        }

        try {
          // Transmogrify WebM/Opus -> WAV mono 16kHz (format yang dijamin didukung Gemini ASR)
          const wav = await this._convertToWavBase64(fullAudioBlob);
          const payload = wav || { audioBase64: null, mimeType: fullAudioBlob.type || 'audio/webm' };
          if (!payload.audioBase64) {
            const reader = new FileReader();
            const base64Promise = new Promise((resolve) => {
              reader.onloadend = () => resolve((reader.result || '').split(',')[1] || '');
              reader.readAsDataURL(fullAudioBlob);
            });
            payload.audioBase64 = await base64Promise;
          }

          console.log(`[VOG] STT_DISPATCHING ➔ Transcribing via LocalRouter :20200/api/voice/transcribe | MIME=${payload.mimeType}`);
          const transcript = await this._sendForTranscription(payload.audioBase64, payload.mimeType);

          if (transcript && transcript.trim()) {
            const clean = transcript.trim();
            console.log(`[VOG] STT_RESULT: "${clean}"`);
            if (onTranscript) onTranscript(clean, true);
            if (onFinalTranscript) onFinalTranscript(clean);
          } else {
            console.warn('[VOG] STT_NO_RESULT: Backend returned empty transcript');
            if (onError) onError(new Error('STT_NO_RESULT_EMPTY'));
          }
        } catch (transcribeErr) {
          console.error('[VOG] ❌ Backend STT transcription failed:', transcribeErr.message);
          if (onError) onError(transcribeErr);
        }

        if (onEnd) onEnd();
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.error('[VOG] LocalBackendSTT start failed:', err);
      this.isListening = false;
      if (onError) onError(err);
      return false;
    }
  }

  _setupVAD(stream, onSilenceDetected) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speechDetected = false;
      let soundLogged = false;
      let silenceFrames = 0;

      const checkAudioLevel = () => {
        if (!this.isListening) return;

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > 10) {
          if (!soundLogged) {
            console.log('[VOG] SOUND_DETECTED');
            soundLogged = true;
          }
          if (average > 18 && !speechDetected) {
            speechDetected = true;
            console.log('[VOG] VAD_SPEECH_START');
          }
          silenceFrames = 0;
        } else if (speechDetected) {
          silenceFrames++;
          // ~700ms silence at 60fps (42 frames)
          if (silenceFrames > 42) {
            speechDetected = false;
            if (onSilenceDetected) onSilenceDetected();
            return;
          }
        }

        requestAnimationFrame(checkAudioLevel);
      };

      requestAnimationFrame(checkAudioLevel);
    } catch (err) {
      console.warn('[VOG] VAD AudioContext setup failed:', err);
    }
  }

  _cleanupVAD() {
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  async _sendForTranscription(audioBase64, mimeType = 'audio/webm') {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType,
        language: 'id-ID'
      })
    });

    if (!res.ok) {
      throw new Error(`STT endpoint HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.transcript || '';
  }

  _wavToBase64(pcm, sampleRate) {
    const numSamples = pcm.length;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    new Int16Array(buffer, 44, numSamples).set(pcm);

    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async _convertToWavBase64(blob) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      try {
        const arrayBuf = await blob.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);

        const targetRate = 16000;
        const src = audioBuf.getChannelData(0);
        const ratio = audioBuf.sampleRate / targetRate;
        const outLen = Math.max(1, Math.floor(src.length / ratio));
        const pcm = new Int16Array(outLen);

        for (let i = 0; i < outLen; i++) {
          const idx = Math.min(src.length - 1, Math.floor(i * ratio));
          const sample = Math.max(-1, Math.min(1, src[idx]));
          pcm[i] = Math.round(sample * 32767);
        }

        return { mimeType: 'audio/wav', base64: this._wavToBase64(pcm, targetRate) };
      } finally {
        try { ctx.close(); } catch {}
      }
    } catch (err) {
      console.warn('[VOG] WAV conversion failed, falling back to raw WebM payload:', err.message);
      return null;
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.isListening = false;
  }
}

export default LocalBackendSTTProvider;
