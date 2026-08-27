/**
 * ClaimValidator.mjs
 * Validates candidate claims against physical evidence references and predicates.
 * Produces structured Approved Facts for generative natural speech realization.
 */

import { EvidenceResolver } from './EvidenceResolver.mjs';

export class ClaimValidator {
  /**
   * Validates a list of candidate claims against execution context and predicates
   * @param {Array} candidateClaims - [{ factKey, claim, evidenceRef, predicate: { field, equals, notEmpty } }]
   * @param {Object} context - { artifact, executionHistory, verification, provenance }
   * @returns {Object} { approvedFacts: Array, approvedClaims: Array, rejectedClaims: Array, isValid: boolean }
   */
  static validateClaims(candidateClaims = [], context = {}) {
    const approvedFacts = [];
    const approvedClaims = [];
    const rejectedClaims = [];

    for (const c of candidateClaims) {
      if (!c || !c.claim || !c.evidenceRef) {
        rejectedClaims.push({ claim: c?.claim || 'Unnamed', reason: 'Missing claim text or evidenceRef' });
        continue;
      }

      // 1. Resolve Evidence Ref
      const resolution = EvidenceResolver.resolve(c.evidenceRef, context);
      if (!resolution.resolved || resolution.value === null || resolution.value === undefined) {
        rejectedClaims.push({ claim: c.claim, evidenceRef: c.evidenceRef, reason: `Unresolvable evidence: ${resolution.error || 'Value is null/undefined'}` });
        continue;
      }

      // 2. Validate Predicate if defined
      if (c.predicate) {
        let predicatePassed = true;
        let predicateError = null;

        if (c.predicate.field && typeof resolution.value === 'object') {
          const targetValue = resolution.value[c.predicate.field];
          if (c.predicate.equals !== undefined && targetValue !== c.predicate.equals) {
            predicatePassed = false;
            predicateError = `Predicate mismatch on ${c.predicate.field}: expected ${c.predicate.equals}, got ${targetValue}`;
          }
          if (c.predicate.notEmpty && (!targetValue || targetValue.length === 0)) {
            predicatePassed = false;
            predicateError = `Predicate failed: ${c.predicate.field} is empty`;
          }
        } else if (c.predicate.equals !== undefined && resolution.value !== c.predicate.equals) {
          predicatePassed = false;
          predicateError = `Predicate mismatch: expected ${c.predicate.equals}, got ${resolution.value}`;
        }

        if (!predicatePassed) {
          rejectedClaims.push({ claim: c.claim, evidenceRef: c.evidenceRef, reason: predicateError });
          continue;
        }
      }

      // 3. Approved Fact Record
      const factRecord = {
        factKey: c.factKey || c.claim,
        claim: c.claim,
        evidenceRef: c.evidenceRef,
        verifiedValue: resolution.value,
        verifiedSource: resolution.source
      };

      approvedFacts.push(factRecord);
      approvedClaims.push(c.claim);
    }

    return {
      approvedFacts,
      approvedClaims,
      rejectedClaims,
      isValid: approvedFacts.length > 0 && rejectedClaims.length === 0
    };
  }
}

export default ClaimValidator;
