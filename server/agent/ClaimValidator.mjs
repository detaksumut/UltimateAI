/**
 * ClaimValidator.mjs
 * Evidence-First Fact Extractor & Proposition Validator.
 * Extracts candidate facts directly from verified evidence, validates predicates,
 * and produces strict ApprovedFacts where every proposition is mathematically grounded.
 */

import { EvidenceResolver } from './EvidenceResolver.mjs';

export class ClaimValidator {
  /**
   * Extracts and validates facts directly from evidence context
   * @param {Array} candidatePropositions - [{ factKey, claim, evidenceRef, predicate: { field, equals, notEmpty, minLength } }]
   * @param {Object} context - { artifact, executionHistory, verification, provenance }
   * @returns {Object} { approvedFacts: Array, approvedClaims: Array, rejectedPropositions: Array, isValid: boolean }
   */
  static validatePropositions(candidatePropositions = [], context = {}) {
    const approvedFacts = [];
    const approvedClaims = [];
    const rejectedPropositions = [];

    for (const prop of candidatePropositions) {
      if (!prop || !prop.factKey || !prop.evidenceRef) {
        rejectedPropositions.push({ factKey: prop?.factKey || 'unknown', reason: 'Missing factKey or evidenceRef' });
        continue;
      }

      // 1. Resolve Evidence Ref
      const resolution = EvidenceResolver.resolve(prop.evidenceRef, context);
      if (!resolution.resolved || resolution.value === null || resolution.value === undefined) {
        rejectedPropositions.push({
          factKey: prop.factKey,
          evidenceRef: prop.evidenceRef,
          reason: `Unresolvable evidence: ${resolution.error || 'Value is null/undefined'}`
        });
        continue;
      }

      // 2. Strict Predicate Validation
      if (prop.predicate) {
        let predicatePassed = true;
        let predicateError = null;

        if (prop.predicate.field && typeof resolution.value === 'object') {
          const targetValue = resolution.value[prop.predicate.field];
          if (prop.predicate.equals !== undefined && targetValue !== prop.predicate.equals) {
            predicatePassed = false;
            predicateError = `Predicate mismatch on ${prop.predicate.field}: expected ${prop.predicate.equals}, got ${targetValue}`;
          }
          if (prop.predicate.notEmpty && (!targetValue || targetValue.length === 0)) {
            predicatePassed = false;
            predicateError = `Predicate failed: ${prop.predicate.field} is empty`;
          }
        } else if (prop.predicate.equals !== undefined && resolution.value !== prop.predicate.equals) {
          predicatePassed = false;
          predicateError = `Predicate mismatch: expected ${prop.predicate.equals}, got ${resolution.value}`;
        } else if (prop.predicate.notEmpty && (!resolution.value || resolution.value.length === 0)) {
          predicatePassed = false;
          predicateError = 'Predicate failed: value is empty';
        }

        if (!predicatePassed) {
          rejectedPropositions.push({
            factKey: prop.factKey,
            evidenceRef: prop.evidenceRef,
            reason: predicateError
          });
          continue;
        }
      }

      // 3. Approved Fact Record with Proposition Grounding
      const factRecord = {
        factKey: prop.factKey,
        claim: prop.claim,
        evidenceRef: prop.evidenceRef,
        verifiedValue: resolution.value,
        verifiedSource: resolution.source,
        speechAllowed: true
      };

      approvedFacts.push(factRecord);
      approvedClaims.push(prop.claim);
    }

    return {
      approvedFacts,
      approvedClaims,
      rejectedPropositions,
      isValid: approvedFacts.length > 0
    };
  }
}

export default ClaimValidator;
