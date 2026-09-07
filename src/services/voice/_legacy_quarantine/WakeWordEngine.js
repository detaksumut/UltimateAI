/**
 * WakeWordEngine.js
 * PHASE 8 - Always-On Wake Word Detection Engine for JIN.
 * Detects "Hey JIN", "Halo JIN", "JIN", "Hai JIN" in background and triggers seamless hands-free conversation.
 */

import { conversationSessionControllerInstance } from './ConversationSessionController.js';

export const WAKE_PATTERNS = [
  'hey jin',
  'halo jin',
  'hai jin',
  'hi jin',
  'ok jin',
  'jin',
  'jarvis'
];

export class WakeWordEngine {
  constructor() {
    this.isListening = false;
    this.recognition = null;
    this.callbacks = new Set();
    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[WAKE WORD] Web Speech Recognition API not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'id-ID';

      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          this.checkWakeWord(transcript);
        }
      };

      this.recognition.onerror = (err) => {
        if (err.error !== 'no-speech') {
          console.debug('[WAKE WORD] Recognition event:', err.error);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart if always-on mode is active
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            // Ignored if already started
          }
        }
      };
    } catch (err) {
      console.warn('[WAKE WORD] Failed to initialize SpeechRecognition:', err.message);
    }
  }

  checkWakeWord(transcript) {
    const matched = WAKE_PATTERNS.some(pat => transcript.includes(pat));
    if (matched) {
      console.log(`[WAKE WORD TRIGGERED] Detected: "${transcript}"`);
      this.triggerWakeWord(transcript);
    }
  }

  triggerWakeWord(transcript) {
    // 1. Invalidate old sessions and activate new session cleanly
    const session = conversationSessionControllerInstance.startNewSession('WAKE_WORD_ACTIVATION');

    // 2. Play acoustic chime feedback
    this.playWakeChime();

    // 3. Notify all listeners (UI, Avatar FSM, Controller)
    this.callbacks.forEach(cb => {
      try {
        cb({
          type: 'WAKE_WORD_ACTIVATED',
          transcript,
          sessionId: session.id,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('[WAKE WORD] Callback error:', err);
      }
    });
  }

  playWakeChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // AudioContext fallback
    }
  }

  startAlwaysOn() {
    if (!this.recognition) return false;
    this.isListening = true;
    try {
      this.recognition.start();
      console.log('[WAKE WORD ENGINE] Always-On Acoustic Listener Active ("Hey JIN")');
      return true;
    } catch {
      return false;
    }
  }

  stopAlwaysOn() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
        console.log('[WAKE WORD ENGINE] Listener Stopped.');
      } catch {
        // Ignored
      }
    }
  }

  onWakeWord(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
}

export const wakeWordEngineInstance = new WakeWordEngine();
export default wakeWordEngineInstance;
