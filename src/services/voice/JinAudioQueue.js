/**
 * JinAudioQueue.js
 * Production Sequential Neural Audio Playback Queue with Object URL Lifecycle Management & Instant Barge-In.
 *
 * SPECIFICATION COMPLIANCE:
 * 1. Playable Audio Source: Converts neural TTS results into Blob Object URLs for HTMLAudioElement.
 * 2. Full Lifecycle: generate audio ➔ create playable source ➔ enqueue ➔ audio.play() ➔ ended ➔ revoke URL ➔ next segment.
 * 3. Never revokes URL before playback finishes.
 * 4. Error Observability: Logs PLAYBACK_STARTED, PLAYBACK_FINISHED, AUDIO_PLAYBACK_FAILED with details.
 * 5. Instant Human Barge-In: Stops playback immediately, preserves unspoken segments for "Lanjutkan".
 */

import { neuralIndonesianTTSProviderInstance } from './NeuralIndonesianTTSProvider.js';
import { speechRendererInstance } from './SpeechRenderer.js';

export class JinAudioQueue {
  constructor(ttsProvider = neuralIndonesianTTSProviderInstance, renderer = speechRendererInstance) {
    this.provider = ttsProvider;
    this.renderer = renderer;

    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isInterrupted = false;

    this.audioElement = typeof window !== 'undefined' ? new Audio() : null;
    this.executivePlaybackRate = 1.14; // Executive Business Cadence: crisp enunciation, eliminates slow swaying drawl
    this.activeObjectUrls = new Set();

    this.unspokenSegments = [];
    this.spokenSegments = [];
    this.callbacks = null;

    this.listeners = new Set();

    if (this.audioElement) {
      this._applyExecutiveAudioProfile();
      this._setupAudioListeners();
    }
  }

  _applyExecutiveAudioProfile() {
    if (!this.audioElement) return;
    try {
      this.audioElement.playbackRate = this.executivePlaybackRate || 1.14;
      this.audioElement.preservesPitch = true;
      if ('mozPreservesPitch' in this.audioElement) this.audioElement.mozPreservesPitch = true;
      if ('webkitPreservesPitch' in this.audioElement) this.audioElement.webkitPreservesPitch = true;
    } catch {}
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emitState(partial = {}) {
    const state = {
      isPlaying: this.isPlaying,
      isInterrupted: this.isInterrupted,
      currentIndex: this.currentIndex,
      totalSegments: this.queue.length,
      queueLength: Math.max(0, this.queue.length - (this.currentIndex + 1)),
      hasResidualContext: this.unspokenSegments.length > 0,
      provider: 'NEURAL_INDONESIAN_TTS',
      ...partial
    };

    for (const listener of this.listeners) {
      try { listener(state); } catch {}
    }
  }

  _setupAudioListeners() {
    if (!this.audioElement) return;

    this.audioElement.onloadedmetadata = () => {
      this._applyExecutiveAudioProfile();
    };

    this.audioElement.onplay = () => {
      this._applyExecutiveAudioProfile();
      this.isPlaying = true;
      console.log(`[AUDIO_QUEUE] 🔊 PLAYBACK_STARTED | Segment ${this.currentIndex + 1}/${this.queue.length}`);
      this._emitState({ isPlaying: true });
    };

    this.audioElement.onended = () => {
      console.log(`[AUDIO_QUEUE] ✅ PLAYBACK_FINISHED | Segment ${this.currentIndex + 1}/${this.queue.length}`);
      this._cleanupCurrentSegmentUrl();
      if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
        this.spokenSegments.push(this.queue[this.currentIndex].text);
      }
      this._playNextSegment();
    };

    this.audioElement.onerror = (e) => {
      // Ignore reset/empty src errors on stop
      if (!this.audioElement.src || this.audioElement.src === '' || this.audioElement.src === window?.location?.href) {
        return;
      }
      console.error(`[AUDIO_QUEUE] ❌ AUDIO_PLAYBACK_FAILED on segment ${this.currentIndex}:`, this.audioElement.error?.message || e);
      this._cleanupCurrentSegmentUrl();
      this._playNextSegment();
    };
  }

  _cleanupCurrentSegmentUrl() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      const item = this.queue[this.currentIndex];
      if (item && item.audioDataUrl && item.audioDataUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.audioDataUrl);
          this.activeObjectUrls.delete(item.audioDataUrl);
        } catch {}
      }
    }
  }

  /**
   * Enqueue and begin sequential neural speech playback.
   */
  async speak(fullText, options = {}) {
    this.stop(); // Halt any active audio playback

    this.isInterrupted = false;
    this.spokenSegments = [];
    this.unspokenSegments = [];

    // 1. Render display text into conversational Indonesian segments
    const { segments, speechText } = this.renderer.renderForSpeech(fullText);

    if (!segments || segments.length === 0) {
      if (options.onEnd) options.onEnd();
      return;
    }

    console.log(`[AUDIO_QUEUE] 📢 Enqueuing ${segments.length} neural speech segments:`, segments);

    // 2. Initialize Queue items
    this.queue = segments.map((text, idx) => ({
      index: idx,
      text,
      audioDataUrl: null,
      audioBlob: null,
      mimeType: null,
      status: 'PENDING'
    }));

    this.currentIndex = -1;
    this.callbacks = options;
    this._emitState({ totalSegments: this.queue.length, isPlaying: true });

    // 3. Pre-fetch first segment and start playback
    this._synthesizeAndPlayFrom(0);
  }

  /**
   * Synthesize audio for segment and start playback
   */
  async _synthesizeAndPlayFrom(index) {
    if (index >= this.queue.length) {
      this.isPlaying = false;
      this._emitState({ isPlaying: false });
      if (this.callbacks?.onEnd) this.callbacks.onEnd();
      return;
    }

    this.currentIndex = index;
    const item = this.queue[index];

    try {
      if (!item.audioDataUrl) {
        const synthResult = await this.provider.synthesize(item.text);
        if (!synthResult || !synthResult.audioDataUrl) {
          throw new Error('AUDIO_SOURCE_EMPTY: Neural TTS did not produce audioDataUrl');
        }
        item.audioDataUrl = synthResult.audioDataUrl;
        item.audioBlob = synthResult.audioBlob;
        item.mimeType = synthResult.mimeType;
        item.duration = synthResult.duration;
        item.status = 'READY';

        if (item.audioDataUrl && item.audioDataUrl.startsWith('blob:')) {
          this.activeObjectUrls.add(item.audioDataUrl);
        }
      }

      if (this.isInterrupted) return;

      // Pipeline pre-fetch next segment in background
      if (index + 1 < this.queue.length && !this.queue[index + 1].audioDataUrl) {
        this.provider.synthesize(this.queue[index + 1].text).then(res => {
          if (this.queue[index + 1] && res?.audioDataUrl) {
            this.queue[index + 1].audioDataUrl = res.audioDataUrl;
            this.queue[index + 1].audioBlob = res.audioBlob;
            this.queue[index + 1].mimeType = res.mimeType;
            this.queue[index + 1].status = 'READY';
            if (res.audioDataUrl.startsWith('blob:')) {
              this.activeObjectUrls.add(res.audioDataUrl);
            }
          }
        }).catch(() => {});
      }

      // Play audio on HTMLAudioElement ONLY if valid non-empty audio source exists
      if (this.audioElement && item.audioDataUrl && item.audioDataUrl.trim().length > 5) {
        this.audioElement.src = item.audioDataUrl;
        this._applyExecutiveAudioProfile();
        this.isPlaying = true;
        this._emitState({ isPlaying: true, currentIndex: index });

        if (index === 0 && this.callbacks?.onStart) {
          this.callbacks.onStart();
        }

        try {
          this._applyExecutiveAudioProfile();
          await this.audioElement.play();
        } catch (playErr) {
          console.warn('[AUDIO_QUEUE] Audio play blocked or failed, attempting speech fallback:', playErr.message);
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            await this._playSpeechFallbackUtterance(item, index);
            return;
          }
          this._cleanupCurrentSegmentUrl();
          this._playNextSegment();
        }
      } else {
        // Headless / test mock timer
        setTimeout(() => {
          this.spokenSegments.push(item.text);
          this._playNextSegment();
        }, 800);
      }
    } catch (err) {
      console.error(`[AUDIO_QUEUE] ❌ Failed to synthesize segment ${index}:`, err.message);
      this._playNextSegment();
    }
  }

  /**
   * Natural Indonesian Female Speech Synthesis Fallback Player
   * Selects Google Bahasa Indonesia or Microsoft Gadis with natural, fluent female prosody.
   */
  async _playSpeechFallbackUtterance(item, index) {
    return new Promise(async (resolve) => {
      if (this.isInterrupted) return resolve();

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.rate = this.executivePlaybackRate || 1.10;
      utterance.pitch = 1.00;

      // Ensure browser voices are loaded
      let voices = window.speechSynthesis.getVoices() || [];
      if (!voices || voices.length === 0) {
        await new Promise((res) => {
          let resolved = false;
          const handler = () => {
            if (resolved) return;
            resolved = true;
            window.speechSynthesis.removeEventListener('voiceschanged', handler);
            res();
          };
          window.speechSynthesis.addEventListener('voiceschanged', handler);
          setTimeout(handler, 500);
        });
        voices = window.speechSynthesis.getVoices() || [];
      }

      const isEnglish = this._isEnglishText(item.text);
      if (isEnglish) {
        utterance.lang = 'en-US';
        const enVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
        if (enVoice) utterance.voice = enVoice;
      } else {
        utterance.lang = 'id-ID';
        const idVoice = voices.find(v => {
          const l = (v.lang || '').toLowerCase().replace(/_/g, '-');
          return l.startsWith('id') || l.includes('indonesia');
        });
        if (idVoice) utterance.voice = idVoice;
      }

      utterance.onstart = () => {
        if (this.isInterrupted) {
          window.speechSynthesis.cancel();
          return resolve();
        }
        this.isPlaying = true;
        this._emitState({ isPlaying: true, currentIndex: index });
        if (index === 0 && this.callbacks?.onStart) {
          this.callbacks.onStart();
        }
      };

      utterance.onend = () => {
        this.spokenSegments.push(item.text);
        resolve();
        this._playNextSegment();
      };

      utterance.onerror = (e) => {
        console.warn('[AUDIO_QUEUE] Speech fallback ended or encountered error:', e?.error || e);
        this.spokenSegments.push(item.text);
        resolve();
        this._playNextSegment();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Fast lexical heuristic to detect if a sentence segment is English or Indonesian.
   */
  _isEnglishText(text = '') {
    const clean = (text || '').toLowerCase().trim();
    if (!clean) return false;

    // English keywords & markers
    const englishTokens = [
      'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'this', 'that', 'these', 'those',
      'you', 'your', 'we', 'our', 'they', 'their', 'what', 'when', 'where', 'why', 'how',
      'hello', 'hi', 'sure', 'certainly', 'english', 'speak', 'language', 'with', 'about', 'from',
      'please', 'thank', 'thanks', 'good', 'morning', 'afternoon', 'evening', 'welcome', 'great',
      'here', 'there', 'would', 'could', 'should', 'will', 'can', 'assist', 'help', 'project',
      'i', 'am', 'jin', 'today', 'now', 'let', 'me', 'know', 'feel', 'free', 'to', 'ask'
    ];

    // Indonesian keywords & markers
    const indonesianTokens = [
      'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada', 'adalah',
      'saya', 'anda', 'kamu', 'kita', 'kami', 'mereka', 'bisa', 'sudah', 'akan', 'telah',
      'tidak', 'bukan', 'apakah', 'bagaimana', 'mengapa', 'halo', 'selamat', 'pagi', 'siang',
      'malam', 'baik', 'tentu', 'terima', 'kasih', 'mohon', 'siap', 'silakan', 'bicara'
    ];

    const words = clean.split(/\s+/).map(w => w.replace(/[^a-zA-Z]/g, ''));
    let enCount = 0;
    let idCount = 0;

    for (const w of words) {
      if (englishTokens.includes(w)) enCount++;
      if (indonesianTokens.includes(w)) idCount++;
    }

    if (/^(hello|hi|welcome|certainly|sure|of course|good morning|good afternoon|good evening|i am jin|let me)\b/i.test(clean)) {
      enCount += 3;
    }

    return enCount > idCount;
  }

  _playNextSegment() {
    if (this.isInterrupted) return;

    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.queue.length) {
      // Natural 120ms inter-sentence pause
      setTimeout(() => {
        if (!this.isInterrupted) {
          this._synthesizeAndPlayFrom(nextIndex);
        }
      }, 120);
    } else {
      this.isPlaying = false;
      this._emitState({ isPlaying: false, queueLength: 0 });
      if (this.callbacks?.onEnd) this.callbacks.onEnd();
    }
  }

  /**
   * Instant Human Barge-In
   * Stops current playback immediately and preserves unspoken segments.
   */
  stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.src = '';
      } catch {}
    }

    // Preserve remaining unspoken segments for "Lanjutkan"
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      this.unspokenSegments = this.queue.slice(this.currentIndex + 1).map(q => q.text);
    }

    // Clean up all active blob URLs
    for (const url of this.activeObjectUrls) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    this.activeObjectUrls.clear();

    this.isPlaying = false;
    this.isInterrupted = true;
    this._emitState({ isPlaying: false, isInterrupted: true });

    console.log('[AUDIO_QUEUE] 🛑 Barge-in: Playback stopped. Preserved unspoken segments:', this.unspokenSegments.length);
  }

  cancel() {
    this.stop();
    this.queue = [];
    this.currentIndex = -1;
    this.unspokenSegments = [];
    this.isInterrupted = false;
    this._emitState({ isPlaying: false, isInterrupted: false, totalSegments: 0 });
  }

  /**
   * Resume playback of preserved context on "Lanjutkan"
   */
  resume(callbacks = {}) {
    if (this.unspokenSegments.length === 0) {
      console.log('[AUDIO_QUEUE] No unspoken segments to resume.');
      if (callbacks.onEnd) callbacks.onEnd();
      return false;
    }

    console.log('[AUDIO_QUEUE] 🔁 Resuming playback of unspoken segments:', this.unspokenSegments);
    const resumeText = this.unspokenSegments.join(' ');
    this.speak(resumeText, callbacks);
    return true;
  }

  hasResidualContext() {
    return this.unspokenSegments.length > 0;
  }

  getResidualSegments() {
    return [...this.unspokenSegments];
  }
}

export const jinAudioQueueInstance = new JinAudioQueue();
export default jinAudioQueueInstance;
