/**
 * JinAvatarController.js
 * Single Source of Truth for JIN Embodied Intelligence State Machine.
 * Validates state transitions via event-driven dispatch.
 */

import { AVATAR_STATES, AVATAR_EVENTS } from './JinAvatarStates.js';

export class JinAvatarController {
  constructor() {
    this.currentState = AVATAR_STATES.IDLE;
    this.previousState = null;
    this.lastEvent = null;
    this.statusMessage = 'JIN STANDBY';
    this.listeners = new Set();

    // Transition table: Valid [State][Event] -> Next State
    this.transitions = {
      [AVATAR_STATES.IDLE]: {
        [AVATAR_EVENTS.MIC_ACTIVATED]: AVATAR_STATES.LISTENING,
        [AVATAR_EVENTS.REQUEST_STARTED]: AVATAR_STATES.PROCESSING,
        [AVATAR_EVENTS.RESET]: AVATAR_STATES.IDLE
      },
      [AVATAR_STATES.LISTENING]: {
        [AVATAR_EVENTS.INPUT_COMPLETED]: AVATAR_STATES.PROCESSING,
        [AVATAR_EVENTS.REQUEST_STARTED]: AVATAR_STATES.PROCESSING,
        [AVATAR_EVENTS.RESET]: AVATAR_STATES.IDLE,
        [AVATAR_EVENTS.FAILURE]: AVATAR_STATES.ERROR
      },
      [AVATAR_STATES.PROCESSING]: {
        [AVATAR_EVENTS.RESPONSE_READY]: AVATAR_STATES.SPEAKING,
        [AVATAR_EVENTS.RESPONSE_TEXT_ONLY]: AVATAR_STATES.IDLE,
        [AVATAR_EVENTS.FAILURE]: AVATAR_STATES.ERROR,
        [AVATAR_EVENTS.RESET]: AVATAR_STATES.IDLE
      },
      [AVATAR_STATES.SPEAKING]: {
        [AVATAR_EVENTS.SPEECH_FINISHED]: AVATAR_STATES.IDLE,
        [AVATAR_EVENTS.USER_BARGE_IN]: AVATAR_STATES.INTERRUPTED,
        [AVATAR_EVENTS.FAILURE]: AVATAR_STATES.ERROR,
        [AVATAR_EVENTS.RESET]: AVATAR_STATES.IDLE
      },
      [AVATAR_STATES.INTERRUPTED]: {
        [AVATAR_EVENTS.LISTENING_READY]: AVATAR_STATES.LISTENING,
        [AVATAR_EVENTS.RESET]: AVATAR_STATES.IDLE
      },
      [AVATAR_STATES.ERROR]: {
        [AVATAR_EVENTS.RESET]: AVATAR_STATES.IDLE,
        [AVATAR_EVENTS.MIC_ACTIVATED]: AVATAR_STATES.LISTENING,
        [AVATAR_EVENTS.REQUEST_STARTED]: AVATAR_STATES.PROCESSING
      }
    };
  }

  getState() {
    return {
      state: this.currentState,
      previousState: this.previousState,
      lastEvent: this.lastEvent,
      statusMessage: this.getStatusMessage()
    };
  }

  getStatusMessage() {
    switch (this.currentState) {
      case AVATAR_STATES.IDLE:
        return 'ONLINE - READY';
      case AVATAR_STATES.LISTENING:
        return 'JIN IS LISTENING...';
      case AVATAR_STATES.PROCESSING:
        return '9ROUTER ORCHESTRATING...';
      case AVATAR_STATES.SPEAKING:
        return 'JIN IS SPEAKING';
      case AVATAR_STATES.INTERRUPTED:
        return 'INTERRUPTED - RESUMING MIC';
      case AVATAR_STATES.ERROR:
        return 'SYSTEM ANOMALY DETECTED';
      default:
        return 'JIN ONLINE';
    }
  }

  dispatch(event, payload = {}) {
    const allowedNext = this.transitions[this.currentState]?.[event.type];

    if (!allowedNext) {
      // Graceful fallback for unexpected reset or interruption
      if (event.type === AVATAR_EVENTS.RESET) {
        this.transitionTo(AVATAR_STATES.IDLE, event.type);
      } else if (event.type === AVATAR_EVENTS.USER_BARGE_IN) {
        this.transitionTo(AVATAR_STATES.INTERRUPTED, event.type);
        setTimeout(() => this.dispatch({ type: AVATAR_EVENTS.LISTENING_READY }), 60);
      }
      return this.getState();
    }

    this.transitionTo(allowedNext, event.type);

    // Auto-transition from INTERRUPTED to LISTENING
    if (allowedNext === AVATAR_STATES.INTERRUPTED) {
      setTimeout(() => {
        this.dispatch({ type: AVATAR_EVENTS.LISTENING_READY });
      }, 80);
    }

    return this.getState();
  }

  transitionTo(nextState, eventType) {
    this.previousState = this.currentState;
    this.currentState = nextState;
    this.lastEvent = eventType;
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const stateData = this.getState();
    this.listeners.forEach(cb => cb(stateData));
  }
}

export const jinAvatarController = new JinAvatarController();
export const jinAvatarControllerInstance = jinAvatarController;
export default jinAvatarController;
