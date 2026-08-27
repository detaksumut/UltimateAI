/**
 * useJinAvatar.js
 * React hook subscribing directly to JinAvatarController Single Source of Truth.
 */

import { useState, useEffect } from 'react';
import { jinAvatarController } from '../services/avatar/JinAvatarController.js';
import { AVATAR_STATES, AVATAR_EVENTS } from '../services/avatar/JinAvatarStates.js';

export function useJinAvatar() {
  const [avatarData, setAvatarData] = useState(jinAvatarController.getState());

  useEffect(() => {
    const unsubscribe = jinAvatarController.subscribe(setAvatarData);
    return unsubscribe;
  }, []);

  const dispatch = (type, payload = {}) => {
    return jinAvatarController.dispatch({ type, ...payload });
  };

  return {
    state: avatarData.state,
    statusMessage: avatarData.statusMessage,
    lastEvent: avatarData.lastEvent,
    isIdle: avatarData.state === AVATAR_STATES.IDLE,
    isListening: avatarData.state === AVATAR_STATES.LISTENING,
    isProcessing: avatarData.state === AVATAR_STATES.PROCESSING,
    isSpeaking: avatarData.state === AVATAR_STATES.SPEAKING,
    isInterrupted: avatarData.state === AVATAR_STATES.INTERRUPTED,
    isError: avatarData.state === AVATAR_STATES.ERROR,
    dispatch,
    AVATAR_STATES,
    AVATAR_EVENTS
  };
}

export default useJinAvatar;
