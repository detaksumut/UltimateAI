/**
 * CertificationStateValidator.mjs
 * State Machine Guard & Integrity Rule Validator for 9Router Certification.
 * Prevents contradictory or over-claimed certification combinations.
 */

import { PROVIDER_STATUS, RUNTIME_CERTIFICATION, FINAL_VERDICT, STREAM_MODE } from './CanonicalVocabulary.mjs';

export class CertificationStateValidator {
  /**
   * Validates state consistency and derives strict, non-contradictory verdict.
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
