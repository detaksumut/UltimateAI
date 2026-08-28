/**
 * LocalBackendSTTProvider.js
 * Local Audio Recording & Backend Speech-to-Text Provider.
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
    this.vadTimer = null;
    this.silenceStart = null;
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

      console.log('[VOG] MIC_STARTED | Engine: LOCAL_BACKEND_STT');
      if (onStart) onStart();

      // Setup VAD (Voice Activity Detector) via AudioContext
      this._setupVAD(this.mediaStream, () => {
        // VAD triggered silence after speech
        console.log('[VOG] VAD_SPEECH_END | Silence detected, finalizing audio capture');
        this.stop();
      });

      // Setup MediaRecorder
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
        console.log(`[VOG] AUDIO_CAPTURED | Size: ${fullAudioBlob.size} bytes | MIME: ${mimeType}`);

        if (fullAudioBlob.size < 1000) {
          console.warn('[VOG] Captured audio too short, skipping transcription');
          if (onEnd) onEnd();
          return;
        }

        try {
          console.log('[VOG] STT_DISPATCHING ➔ Transcribing via LocalRouter :20200/api/voice/transcribe');
          const transcript = await this._sendForTranscription(fullAudioBlob);
          
          if (transcript && transcript.trim()) {
            console.log(`[VOG] STT_RESULT: "${transcript.trim()}"`);
            if (onTranscript) onTranscript(transcript.trim(), true);
            if (onFinalTranscript) onFinalTranscript(transcript.trim());
          } else {
            console.warn('[VOG] Empty transcript returned from backend STT');
          }
        } catch (transcribeErr) {
          console.error('[VOG] ❌ Backend STT transcription failed:', transcribeErr.message);
          if (onError) onError(transcribeErr);
        }

        if (onEnd) onEnd();
      };

      this.mediaRecorder.start(100); // 100ms chunk slices
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
      let silenceFrames = 0;

      const checkAudioLevel = () => {
        if (!this.isListening) return;

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Threshold for human voice in 0..255 scale
        if (average > 12) {
          if (!speechDetected) {
            speechDetected = true;
            console.log('[VOG] VAD_SPEECH_START');
          }
          silenceFrames = 0;
        } else if (speechDetected) {
          silenceFrames++;
          // ~750ms of silence at ~60fps (45 frames)
          if (silenceFrames > 45) {
            speechDetected = false;
            if (onSilenceDetected) onSilenceDetected();
            return;
          }
        }

        requestAnimationFrame(checkAudioLevel);
      };

      requestAnimationFrame(checkAudioLevel);
    } catch (err) {
      console.warn('[VOG] VAD AudioContext setup failed, falling back to manual stop:', err);
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

  async _sendForTranscription(blob) {
    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });

    const audioBase64 = await base64Promise;

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: blob.type || 'audio/webm',
        language: 'id-ID'
      })
    });

    if (!res.ok) {
      throw new Error(`STT endpoint HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.transcript || '';
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
