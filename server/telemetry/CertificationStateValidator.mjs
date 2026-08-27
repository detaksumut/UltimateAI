/**
 * CertificationStateValidator.mjs
 * State Machine Guard & Integrity Rule Validator for 9Router Certification.
 * Enforces:
 *  1. Mandatory Single-Session Coherence across all 4 Acceptance Gates & Events
 *  2. Strict Event Identity, Finite Timestamps & Provenance
 *  3. Explicit Successor Session Creation Contract (parentSessionId ➔ successor sessionId)
 *  4. Event-Level & Gate-Level Strict Temporal Ordering
 *  5. Monotonic Deterministic Verdict Derivation (Zero manual status override)
 */

import { PROVIDER_STATUS, RUNTIME_CERTIFICATION, FINAL_VERDICT, STREAM_MODE } from './CanonicalVocabulary.mjs';

export class CertificationStateValidator {
  /**
   * Evaluates a host empirical session with strict single-session coherence, temporal order, and monotonic derivation
   * @param {Object} sessionBundle - { sessionId, gates: { router, microphone, tts, bargeIn }, events: [], successorSessions: [] }
   * @returns {Object} { isValid: boolean, verdict: string, sessionId: string, gates: Object, blockingConditions: Array, inconsistencies: Array }
   */
  static evaluateSession(sessionBundle = {}) {
    const {
      sessionId = null,
      gates = {},
      events = [],
      successorSessions = []
    } = sessionBundle;

    const inconsistencies = [];
    const blockingConditions = [];

    // --- RULE 1: MANDATORY ROOT SESSION ID ---
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      inconsistencies.push({
        rule: 'RULE_1_MISSING_SESSION_ID',
        message: 'A coherent host session ID is required for empirical certification.'
      });
    }

    const {
      router = null,
      microphone = null,
      tts = null,
      bargeIn = null
    } = gates;

    // --- RULE 2: MANDATORY GATE-LEVEL SESSION COHERENCE & METADATA PROVENANCE ---
    const gateEntries = [
      { name: 'gate1_router', data: router },
      { name: 'gate2_microphone', data: microphone },
      { name: 'gate3_tts', data: tts },
      { name: 'gate4_bargeIn', data: bargeIn }
    ];

    for (const { name, data } of gateEntries) {
      if (data) {
        if (!data.sessionId || data.sessionId !== sessionId) {
          inconsistencies.push({
            rule: 'RULE_2_SESSION_ID_MISMATCH',
            message: `Gate "${name}" must have sessionId matching root session "${sessionId}". Got "${data.sessionId || 'UNDEFINED'}".`
          });
        }
        if (!Number.isFinite(data.timestamp)) {
          inconsistencies.push({
            rule: 'RULE_2_MISSING_TIMESTAMP',
            message: `Gate "${name}" is missing mandatory finite timestamp.`
          });
        }
        if (!data.provenance) {
          inconsistencies.push({
            rule: 'RULE_2_MISSING_PROVENANCE',
            message: `Gate "${name}" is missing mandatory provenance metadata.`
          });
        }
      }
    }

    // --- RULE 3: SUCCESSOR SESSION CAUSAL EXISTENCE VERIFICATION ---
    if (bargeIn) {
      if (bargeIn.sessionInvalidated && !bargeIn.successorSessionId) {
        inconsistencies.push({
          rule: 'RULE_3_MISSING_SUCCESSOR_SESSION_ID',
          message: 'Barge-in invalidated session but failed to provide a valid successorSessionId link.'
        });
      }
      if (bargeIn.successorSessionId === sessionId) {
        inconsistencies.push({
          rule: 'RULE_3_CIRCULAR_SUCCESSOR_LINK',
          message: 'Successor session ID cannot be identical to the invalidated parent session ID.'
        });
      }
      if (bargeIn.successorSessionId && bargeIn.successorSessionId !== sessionId) {
        const isSuccessorPresent = Array.isArray(successorSessions) && successorSessions.some(s => 
          s === bargeIn.successorSessionId || s?.sessionId === bargeIn.successorSessionId
        );
        if (!isSuccessorPresent) {
          inconsistencies.push({
            rule: 'RULE_3_SUCCESSOR_SESSION_NOT_FOUND',
            message: `Successor session "${bargeIn.successorSessionId}" not found in verified successorSessions registry. Phantom successor IDs are prohibited.`
          });
        }
      }
    }

    // --- RULE 4: MANDATORY EVENT IDENTITY, TIMELINE & PROVENANCE INTEGRITY ---
    if (Array.isArray(events) && events.length > 0) {
      for (let i = 0; i < events.length; i++) {
        const evt = events[i];
        
        if (evt.type === 'SUCCESSOR_SESSION_CREATED') {
          // Successor creation event contract
          if (!evt.parentSessionId || evt.parentSessionId !== sessionId) {
            inconsistencies.push({
              rule: 'RULE_4_SUCCESSOR_EVENT_PARENT_MISMATCH',
              message: `Successor event parentSessionId "${evt.parentSessionId || 'UNDEFINED'}" must match root session "${sessionId}".`
            });
          }
          if (!evt.sessionId || evt.sessionId === sessionId) {
            inconsistencies.push({
              rule: 'RULE_4_SUCCESSOR_EVENT_INVALID_ID',
              message: `Successor event must declare distinct new sessionId. Got "${evt.sessionId || 'UNDEFINED'}".`
            });
          }
          if (!Number.isFinite(evt.timestamp)) {
            inconsistencies.push({
              rule: 'RULE_4_SUCCESSOR_EVENT_TIMESTAMP_MISSING',
              message: 'Successor event is missing mandatory finite timestamp.'
            });
          }
          if (!evt.provenance) {
            inconsistencies.push({
              rule: 'RULE_4_SUCCESSOR_EVENT_PROVENANCE_MISSING',
              message: 'Successor event is missing mandatory provenance metadata.'
            });
          }
        } else {
          // Standard session event contract
          if (!evt.sessionId || evt.sessionId !== sessionId) {
            inconsistencies.push({
              rule: 'RULE_4_EVENT_SESSION_MISMATCH',
              message: `Event "${evt.type || evt.name || i}" must have sessionId matching parent session "${sessionId}". Got "${evt.sessionId || 'UNDEFINED'}".`
            });
          }
          if (!Number.isFinite(evt.timestamp)) {
            inconsistencies.push({
              rule: 'RULE_4_EVENT_TIMESTAMP_MISSING',
              message: `Event "${evt.type || evt.name || i}" is missing mandatory finite timestamp.`
            });
          }
          if (!evt.provenance) {
            inconsistencies.push({
              rule: 'RULE_4_EVENT_PROVENANCE_MISSING',
              message: `Event "${evt.type || evt.name || i}" is missing mandatory provenance metadata.`
            });
          }
        }

        // Monotonic event-level temporal sequence check
        if (i > 0 && Number.isFinite(events[i - 1]?.timestamp) && Number.isFinite(evt?.timestamp)) {
          if (events[i - 1].timestamp > evt.timestamp) {
            inconsistencies.push({
              rule: 'RULE_4_EVENT_TIMELINE_ANOMALY',
              message: `Event timeline inverted between "${events[i - 1].type || i - 1}" (${events[i - 1].timestamp}) and "${evt.type || i}" (${evt.timestamp}).`
            });
          }
        }
      }
    }

    // --- RULE 5: GATE-LEVEL STRICT TEMPORAL ORDERING ---
    if (microphone?.timestamp && router?.timestamp && microphone.timestamp > router.timestamp) {
      inconsistencies.push({
        rule: 'RULE_5_TEMPORAL_ORDER_ANOMALY',
        message: `Microphone event timestamp (${microphone.timestamp}) is after router event timestamp (${router.timestamp}). Causality violated.`
      });
    }

    if (router?.timestamp && tts?.timestamp && router.timestamp > tts.timestamp) {
      inconsistencies.push({
        rule: 'RULE_5_TEMPORAL_ORDER_ANOMALY',
        message: `Router event timestamp (${router.timestamp}) is after TTS event timestamp (${tts.timestamp}). Causality violated.`
      });
    }

    if (tts?.timestamp && bargeIn?.timestamp && tts.timestamp > bargeIn.timestamp) {
      inconsistencies.push({
        rule: 'RULE_5_TEMPORAL_ORDER_ANOMALY',
        message: `TTS event timestamp (${tts.timestamp}) is after Barge-in event timestamp (${bargeIn.timestamp}). Causality violated.`
      });
    }

    // --- RULE 6: INDIVIDUAL GATE VERIFICATION ---
    const isRouterPass = Boolean(
      router &&
      router.sessionId === sessionId &&
      router.transport === 'NINE_ROUTER_PROXY' &&
      router.fallbackUsed === false &&
      router.actualProvider &&
      router.actualModel
    );

    const isMicPass = Boolean(
      microphone &&
      microphone.sessionId === sessionId &&
      microphone.permission === 'GRANTED' &&
      microphone.speechActivityDetected === true &&
      microphone.transcriptReceived === true
    );

    const isTtsPass = Boolean(
      tts &&
      tts.sessionId === sessionId &&
      tts.actualProvider &&
      tts.playbackStarted === true
    );

    const isBargeInPass = Boolean(
      bargeIn &&
      bargeIn.sessionId === sessionId &&
      bargeIn.detected === true &&
      bargeIn.ttsCancelled === true &&
      bargeIn.llmAborted === true &&
      bargeIn.queueFlushed === true &&
      bargeIn.sessionInvalidated === true &&
      bargeIn.successorSessionId
    );

    // Track explicit blocking conditions
    if (!isRouterPass) blockingConditions.push('ROUTER_GATE_PENDING');
    if (!isMicPass) blockingConditions.push('MICROPHONE_GATE_PENDING');
    if (!isTtsPass) blockingConditions.push('TTS_GATE_PENDING');
    if (!isBargeInPass) blockingConditions.push('BARGE_IN_GATE_PENDING');

    // --- RULE 7: MONOTONIC DETERMINISTIC VERDICT DERIVATION ---
    let verdict = FINAL_VERDICT.CERTIFICATION_PENDING;

    if (inconsistencies.length > 0) {
      verdict = FINAL_VERDICT.CERTIFICATION_FAILED;
    } else if (isRouterPass && isMicPass && isTtsPass && isBargeInPass) {
      verdict = RUNTIME_CERTIFICATION.REAL_WORLD_VERIFIED;
    } else {
      verdict = FINAL_VERDICT.CERTIFICATION_PENDING;
    }

    return {
      isValid: inconsistencies.length === 0,
      verdict,
      sessionId,
      gates: {
        router: isRouterPass,
        microphone: isMicPass,
        tts: isTtsPass,
        bargeIn: isBargeInPass
      },
      blockingConditions,
      inconsistencies,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Validates legacy pillar state consistency and derives strict verdict.
   */
  static validateCertificationState({ pillars = {}, envData = {}, streamMode = null, activeProvider = null }) {
    const inconsistencies = [];
    const blockingConditions = [];

    // --- RULE 1: UPSTREAM_NATIVE vs PROVIDER_STATUS ---
    if (streamMode === STREAM_MODE.UPSTREAM_NATIVE) {
      if (!activeProvider || activeProvider.status !== PROVIDER_STATUS.AUTHENTICATED_LIVE) {
        inconsistencies.push({
          rule: 'RULE_1_STREAM_PROVIDER_ALIGNMENT',
          message: `Cannot claim ${STREAM_MODE.UPSTREAM_NATIVE} when active provider is ${activeProvider?.status || 'NOT_CONFIGURED'}.`
        });
      }
    }

    // --- RULE 2: REAL_WORLD_VERIFIED Evidence Integrity ---
    for (const [pillarName, pilarData] of Object.entries(pillars)) {
      if (pilarData.runtimeStatus === RUNTIME_CERTIFICATION.REAL_WORLD_VERIFIED) {
        if (!pilarData.evidenceId || !pilarData.timestamp || !pilarData.measurementMode) {
          inconsistencies.push({
            rule: 'RULE_2_REAL_WORLD_EVIDENCE_INTEGRITY',
            message: `Pillar "${pillarName}" claims ${RUNTIME_CERTIFICATION.REAL_WORLD_VERIFIED} but is missing mandatory evidence metadata (evidenceId, timestamp, or measurementMode).`
          });
        }
      }
    }

    // --- RULE 3: Blocking Conditions for Production Certification ---
    const gatewayPass = pillars.gateway?.runtimeStatus === RUNTIME_CERTIFICATION.HOST_RUNTIME_VERIFIED || pillars.gateway?.status === 'PASS';
    const brainLive = Object.values(pillars.aiBrain?.providers || {}).some(p => p.status === PROVIDER_STATUS.AUTHENTICATED_LIVE);
    const micHuman = pillars.microphoneSTT?.runtimeStatus === RUNTIME_CERTIFICATION.REAL_WORLD_VERIFIED;
    const bargeInHuman = pillars.fullDuplexBargeIn?.runtimeStatus === RUNTIME_CERTIFICATION.REAL_WORLD_VERIFIED;

    if (!brainLive) {
      blockingConditions.push('REAL_PROVIDER_AUTHENTICATION_PENDING');
    }
    if (!micHuman) {
      blockingConditions.push('HUMAN_MICROPHONE_RUNTIME_PENDING');
    }
    if (!bargeInHuman) {
      blockingConditions.push('REAL_HUMAN_BARGE_IN_PENDING');
    }

    // --- RULE 4: Final Verdict Derivation ---
    let verdict = FINAL_VERDICT.CONDITIONAL_CERTIFIED;

    if (inconsistencies.length > 0) {
      verdict = FINAL_VERDICT.CERTIFICATION_FAILED;
    } else if (blockingConditions.length === 0 && gatewayPass && brainLive && micHuman && bargeInHuman) {
      verdict = FINAL_VERDICT.PRODUCTION_CERTIFIED;
    } else {
      verdict = FINAL_VERDICT.CONDITIONAL_CERTIFIED;
    }

    return {
      isValid: inconsistencies.length === 0,
      verdict,
      blockingConditions,
      inconsistencies,
      validatedAt: new Date().toISOString()
    };
  }
}

export default CertificationStateValidator;
