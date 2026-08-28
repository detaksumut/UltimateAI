/**
 * JinAudioQueue.js
 * Intelligent Sequential Audio Playback Queue & Barge-In Coordinator.
 *
 * SPECIFICATION COMPLIANCE:
 * 1. Sentence-Based Queuing: Plays synthesized neural audio segments seamlessly with calibrated pauses.
 * 2. Instant Human Barge-In: Immediately stops active audio playback on interruption.
 * 3. Context & Residual Preservation: Keeps unspoken segments in memory for seamless "Lanjutkan" resume.
 * 4. Observable State: Emits live playback status to Control Center HUD.
 */

import { neuralIndonesianTTSProviderInstance } from './NeuralIndonesianTTSProvider.js';
import { speechRendererInstance } from './SpeechRenderer.js';

export class JinAudioQueue {
  constructor(ttsProvider = neuralIndonesianTTSProviderInstance, renderer = speechRendererInstance) {
    this.provider = ttsProvider;
    this.renderer = renderer;

    // Queue of segment items: [{ text, audioDataUrl, audioBlob, duration, status: 'PENDING'|'READY'|'PLAYED' }]
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isInterrupted = false;

    // Audio element
    this.audioElement = typeof window !== 'undefined' ? new Audio() : null;
    this.currentAudioUrl = null;

    // Preserved context for barge-in and resume
    this.preservedTaskContext = null;
    this.unspokenSegments = [];
    this.spokenSegments = [];

    // State listeners for HUD
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
      this._emitState({ isPlaying: true });
    };

    this.audioElement.onended = () => {
      if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
        this.spokenSegments.push(this.queue[this.currentIndex].text);
      }
      this._playNextSegment();
    };

    this.audioElement.onerror = (e) => {
      console.warn('[AUDIO_QUEUE] Audio playback error on segment:', this.currentIndex, e);
      this._playNextSegment();
    };
  }

  /**
   * Enqueue and begin streaming playback of a JIN response.
   * @param {string} fullText - JIN response text
   * @param {Object} options - { onStart, onEnd, onError, taskContext }
   */
  async speak(fullText, options = {}) {
    this.stop(); // Stop any currently active speech

    this.isInterrupted = false;
    this.spokenSegments = [];
    this.unspokenSegments = [];
    this.preservedTaskContext = options.taskContext || null;

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
      status: 'PENDING'
    }));

    this.currentIndex = -1;
    this.callbacks = options;
    this._emitState({ totalSegments: this.queue.length, isPlaying: true });

    // 3. Pre-fetch first segment immediately for low-latency start
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
        item.audioDataUrl = synthResult.audioDataUrl;
        item.duration = synthResult.duration;
        item.status = 'READY';
      }

      // Check if interrupted while synthesizing
      if (this.isInterrupted) return;

      // Pipeline pre-fetch next segment in background
      if (index + 1 < this.queue.length && !this.queue[index + 1].audioDataUrl) {
        this.provider.synthesize(this.queue[index + 1].text).then(res => {
          if (this.queue[index + 1]) {
            this.queue[index + 1].audioDataUrl = res.audioDataUrl;
            this.queue[index + 1].status = 'READY';
          }
        }).catch(() => {});
      }

      // Play current audio
      if (this.audioElement && item.audioDataUrl) {
        this.audioElement.src = item.audioDataUrl;
        this.isPlaying = true;
        this._emitState({ isPlaying: true, currentIndex: index });

        if (index === 0 && this.callbacks?.onStart) {
          this.callbacks.onStart();
        }

        await this.audioElement.play();
      } else {
        // Fallback or Node environment mock progress
        setTimeout(() => this._playNextSegment(), 800);
      }
    } catch (err) {
      console.error(`[AUDIO_QUEUE] Failed to synthesize segment ${index}:`, err.message);
      // Skip failed segment and attempt next
      this._playNextSegment();
    }
  }

  _playNextSegment() {
    if (this.isInterrupted) return;

    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.queue.length) {
      // Natural 120ms pause between sentence segments
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
   * Immediately stops audio and preserves unspoken segments for "Lanjutkan".
   */
  stop() {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {}
    }

    // Preserve remaining unspoken segments
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      this.unspokenSegments = this.queue.slice(this.currentIndex + 1).map(q => q.text);
    }

    this.isPlaying = false;
    this.isInterrupted = true;
    this._emitState({ isPlaying: false, isInterrupted: true });

    console.log('[AUDIO_QUEUE] 🛑 Barge-in: Stopped playback. Preserved unspoken segments:', this.unspokenSegments.length);
  }

  cancel() {
    this.stop();
    this.queue = [];
    this.currentIndex = -1;
    this.unspokenSegments = [];
    this.preservedTaskContext = null;
    this.isInterrupted = false;
    this._emitState({ isPlaying: false, isInterrupted: false, totalSegments: 0 });
  }

  /**
   * Resume playback of remaining unspoken segments on "Lanjutkan".
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
