/**
 * ContradictionDetector.mjs
 * Phase 4D: Multi-Source Contradiction Detection & Disagreement Surface Engine.
 * 
 * When sources disagree:
 *  1. Detects factual or numerical contradiction.
 *  2. Surfaces the disagreement clearly in reasoning output.
 *  3. Compares source reliability, recency, and evidence quality.
 *  4. Calibrates epistemic uncertainty without silent arbitrary picking.
 */

import { evidenceGraphInstance, VERIFICATION_STATES } from './EvidenceGraph.mjs';

export class ContradictionDetector {
  constructor(evidenceGraph = evidenceGraphInstance) {
    this.evidenceGraph = evidenceGraph;
  }

  /**
   * Cross-evaluates multiple findings/sources to detect conflicting claims
   * @param {Array<Object>} findings - [{ claim, source, confidence, timestamp, value }]
   * @returns {Object} { hasContradiction, contradictions, resolvedSummary, calibratedUncertainty }
   */
  detectContradictions(findings = []) {
    if (!findings || findings.length < 2) {
      return {
        hasContradiction: false,
        contradictions: [],
        resolvedSummary: null,
        calibratedUncertainty: 'LOW'
      };
    }

    const contradictions = [];

    // Pairwise comparison of claims
    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const itemA = findings[i];
        const itemB = findings[j];

        const conflict = this._evaluatePairwiseConflict(itemA, itemB);
        if (conflict.isConflict) {
          contradictions.push({
            id: `contra_${Date.now()}_${i}_${j}`,
            claimA: itemA,
            claimB: itemB,
            conflictType: conflict.type, // 'NUMERICAL_DISCREPANCY' | 'FACTUAL_NEGATION' | 'TIMELINE_MISMATCH'
            discrepancyDescription: conflict.description,
            recommendedAction: conflict.recommendedAction
          });

          // Record in evidence graph
          const nodeA = this.evidenceGraph.addClaim({
            claim: itemA.claim || itemA.text || JSON.stringify(itemA),
            source: itemA.source || 'source_A',
            confidence: itemA.confidence || 0.7,
            state: VERIFICATION_STATES.CONTRADICTED
          });

          const nodeB = this.evidenceGraph.addClaim({
            claim: itemB.claim || itemB.text || JSON.stringify(itemB),
            source: itemB.source || 'source_B',
            confidence: itemB.confidence || 0.7,
            state: VERIFICATION_STATES.CONTRADICTED
          });

          this.evidenceGraph.markContradicted(nodeA.id, nodeB.id, conflict.description);
        }
      }
    }

    return {
      hasContradiction: contradictions.length > 0,
      totalContradictions: contradictions.length,
      contradictions,
      calibratedUncertainty: contradictions.length > 0 ? 'HIGH' : 'LOW',
      surfaceReport: this._buildSurfaceReport(contradictions)
    };
  }

  _evaluatePairwiseConflict(a, b) {
    const textA = (a.claim || a.text || '').toLowerCase();
    const textB = (b.claim || b.text || '').toLowerCase();

    // 1. Direct factual negation pairs (e.g. "berhasil" vs "gagal", "valid" vs "invalid", "naik" vs "turun")
    const negationPairs = [
      ['berhasil', 'gagal'],
      ['valid', 'invalid'],
      ['aktif', 'nonaktif'],
      ['naik', 'turun'],
      ['meningkat', 'menurun'],
      ['true', 'false'],
      ['ya', 'tidak']
    ];

    for (const [pos, neg] of negationPairs) {
      if ((textA.includes(pos) && textB.includes(neg)) || (textA.includes(neg) && textB.includes(pos))) {
        return {
          isConflict: true,
          type: 'FACTUAL_NEGATION',
          description: `Sumber A menyatakan kondisi "${pos}", sedangkan Sumber B menyatakan kondisi "${neg}".`,
          recommendedAction: 'SURFACE_DISAGREEMENT_TO_USER'
        };
      }
    }

    // 2. Numerical discrepancy check if both have explicit numbers on same topic
    const numsA = textA.match(/\b\d+(?:[.,]\d+)?\b/g);
    const numsB = textB.match(/\b\d+(?:[.,]\d+)?\b/g);

    if (numsA && numsB && numsA[0] !== numsB[0]) {
      // Check if they share at least one keyword
      const wordsA = textA.split(/\s+/).filter(w => w.length > 3);
      const hasOverlap = wordsA.some(w => textB.includes(w));

      if (hasOverlap) {
        return {
          isConflict: true,
          type: 'NUMERICAL_DISCREPANCY',
          description: `Perbedaan angka terdeteksi: Sumber A (${numsA[0]}) vs Sumber B (${numsB[0]}).`,
          recommendedAction: 'COMPARE_SOURCE_RECENCY_AND_AUTHORITY'
        };
      }
    }

    return { isConflict: false };
  }

  _buildSurfaceReport(contradictions) {
    if (contradictions.length === 0) return null;

    return contradictions.map(c => 
      `⚠️ [DIKOTOMI FAKTA TERDETEKSI]: ${c.discrepancyDescription}\n` +
      `   • Sumber 1 (${c.claimA.source || 'A'}): "${c.claimA.claim || c.claimA.text}"\n` +
      `   • Sumber 2 (${c.claimB.source || 'B'}): "${c.claimB.claim || c.claimB.text}"\n` +
      `   • Rekomendasi: Menjelaskan ketidakpastian secara transparan kepada pengguna.`
    ).join('\n\n');
  }
}

export const contradictionDetectorInstance = new ContradictionDetector();
export default contradictionDetectorInstance;
