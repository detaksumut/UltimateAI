/**
 * useAudioAnalyzer.js
 * React hook to receive continuous audio-reactive metrics (mouth glow, waveform, orbit speed).
 */

import { useState, useEffect } from 'react';
import { audioReactiveAnalyzerInstance } from '../services/avatar/AudioReactiveAnalyzer.js';

export function useAudioAnalyzer(avatarState = 'IDLE') {
  const [metrics, setMetrics] = useState({
    volume: 0.1,
    mouthGlow: 0,
    orbitSpeed: 1.0,
    spectrum: [10, 15, 12, 18, 14, 16, 12, 10],
    state: avatarState
  });

  useEffect(() => {
    audioReactiveAnalyzerInstance.startSynthetic(avatarState);
    const unsubscribe = audioReactiveAnalyzerInstance.subscribe(setMetrics);
    return () => {
      unsubscribe();
      audioReactiveAnalyzerInstance.stop();
    };
  }, [avatarState]);

  return metrics;
}

export default useAudioAnalyzer;
