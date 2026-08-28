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
    this.activeObjectUrls = new Set();

    this.unspokenSegments = [];
    this.spokenSegments = [];
    this.callbacks = null;

    this.listeners = new Set();

    if (this.audioElement) {
      this._setupAudioListeners();
    }
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

    this.audioElement.onplay = () => {
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
        this.isPlaying = true;
        this._emitState({ isPlaying: true, currentIndex: index });

        if (index === 0 && this.callbacks?.onStart) {
          this.callbacks.onStart();
        }

        try {
          await this.audioElement.play();
        } catch (playErr) {
          console.warn('[AUDIO_QUEUE] Autoplay policy prevented immediate play, attempting user gesture resume:', playErr);
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
