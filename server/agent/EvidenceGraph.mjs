/**
 * EvidenceGraph.mjs
 * Phase 4D: Epistemic Evidence Graph & Claim Verification Tracker.
 * 
 * Tracks:
 *  claim -> evidence -> source -> confidence -> verificationState
 * 
 * Verification States:
 *  - VERIFIED: Directly grounded by reliable primary evidence.
 *  - UNVERIFIED: Plausible but missing verifiable source.
 *  - CONTRADICTED: Direct factual conflict across sources.
 *  - INSUFFICIENT_EVIDENCE: Weak or incomplete grounding.
 */

export const VERIFICATION_STATES = {
  VERIFIED: 'VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  CONTRADICTED: 'CONTRADICTED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
};

export class EvidenceGraph {
  constructor() {
    this.nodes = []; // [{ id, claim, evidence, source, confidence, state, contradictionRef, timestamp }]
  }

  /**
   * Adds an asserted claim with its grounded evidence
   */
  addClaim({ claim, evidence = null, source = 'system', confidence = 0.8, state = VERIFICATION_STATES.UNVERIFIED, contradictionRef = null }) {
    const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Automatically evaluate state if not specified
    let finalState = state;
    if (!evidence && state === VERIFICATION_STATES.VERIFIED) {
      finalState = VERIFICATION_STATES.INSUFFICIENT_EVIDENCE;
    } else if (evidence && confidence >= 0.85) {
      finalState = VERIFICATION_STATES.VERIFIED;
    }

    const node = {
      id,
      claim,
      evidence,
      source,
      confidence,
      state: finalState,
      contradictionRef,
      timestamp: new Date().toISOString()
    };

    this.nodes.push(node);
    return node;
  }

  /**
   * Marks a claim as contradicted by an opposing claim
   */
  markContradicted(claimId, opposingClaimId, reason = 'Factual Disagreement') {
    const node = this.nodes.find(n => n.id === claimId);
    if (node) {
      node.state = VERIFICATION_STATES.CONTRADICTED;
      node.contradictionRef = { opposingClaimId, reason, detectedAt: new Date().toISOString() };
    }
  }

  /**
   * Returns verification audit metrics
   */
  getAuditSummary() {
    const total = this.nodes.length;
    const verified = this.nodes.filter(n => n.state === VERIFICATION_STATES.VERIFIED).length;
    const contradicted = this.nodes.filter(n => n.state === VERIFICATION_STATES.CONTRADICTED).length;
    const unverified = this.nodes.filter(n => n.state === VERIFICATION_STATES.UNVERIFIED || n.state === VERIFICATION_STATES.INSUFFICIENT_EVIDENCE).length;

    return {
      totalClaims: total,
      verifiedCount: verified,
      contradictedCount: contradicted,
      unverifiedCount: unverified,
      evidenceRatio: total > 0 ? (verified / total) : 1.0,
      nodes: [...this.nodes]
    };
  }

  clear() {
    this.nodes = [];
  }
}

export const evidenceGraphInstance = new EvidenceGraph();
export default evidenceGraphInstance;
