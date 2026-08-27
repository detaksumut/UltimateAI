/**
 * useVoiceEngine.js
 * React hook for interacting with VoiceController (STT, TTS, and barge-in).
 */

import { useState, useCallback, useEffect } from 'react';
import { voiceControllerInstance } from '../services/voice/VoiceController.js';

export function useVoiceEngine({ onBargeIn } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if (onBargeIn) {
      voiceControllerInstance.setBargeInHandler(onBargeIn);
    }
  }, [onBargeIn]);

  const startListening = useCallback(({ onFinal } = {}) => {
    setIsListening(true);
    setTranscript('');
    voiceControllerInstance.startListening({
      onTranscript: (text) => setTranscript(text),
      onFinalTranscript: (text) => {
        setIsListening(false);
        if (onFinal) onFinal(text);
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false)
    });
  }, []);

  const stopListening = useCallback(() => {
    voiceControllerInstance.stopListening();
    setIsListening(false);
  }, []);

  const speak = useCallback((text, { onStart, onEnd } = {}) => {
    setIsSpeaking(true);
    voiceControllerInstance.speak(text, {
      onStart: () => {
        setIsSpeaking(true);
        if (onStart) onStart();
      },
      onEnd: () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      },
      onError: () => {
        setIsSpeaking(false);
      }
    });
  }, []);

  const stopAll = useCallback(() => {
    voiceControllerInstance.stopAll();
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    startListening,
    stopListening,
    speak,
    stopAll
  };
}

export default useVoiceEngine;
