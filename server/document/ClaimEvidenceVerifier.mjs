/**
 * ClaimEvidenceVerifier.mjs
 * PHASE 4 â€” Evidence/Claim Verifier: gerbang keamanan terakhir sebelum
 * jawaban JIN keluar. Verifikasi PER CLAIM (bukan per-answer).
 * PHASE 6 â€” lapisan klaim: FACT / ANALYSIS / INFERENCE.
 *
 * Foundation reused: DocumentEvidenceStore.checkClaim() state semantics
 * digambar ulang di sini agar provenance chain per-claim kaya.
 *
 * States: VERIFIED | CONTRADICTED | INSUFFICIENT_EVIDENCE | REJECT
 *   - evidence type CONFLICT / contradiction flag     -> CONTRADICTED
 *   - confidence < 0.5 (lemah)                        -> INSUFFICIENT_EVIDENCE
 *   - evidenceId kosong / tidak dikenal               -> REJECT (boundary violation)
 *
 * PHASE 6 kind rules (claim.kind, default FACT bila absen):
 *   FACT      â€” aturan FASE 4 penuh (bisa VERIFIED).
 *   ANALYSIS  â€” evidenceIds wajib; tanpa evidence -> REJECT;
 *               max VERIFIED bila evidence kuat (pola antar-evidence).
 *   INFERENCE â€” TIDAK PERNAH VERIFIED; tanpa evidence -> INSUFFICIENT_EVIDENCE
 *               berlabel "Inferensi JIN" (bukan REJECT agar tidak hilang diam-diam,
 *               tapi tidak disajikan sebagai fakta).
 *
 * Provenance chain: CLAIM -> evidenceId -> blockId -> page -> documentId
 */
import { CLAIM_STATES, DocumentEvidenceStore } from './DocumentEvidence.mjs';

export const VERIFIER_VERSION = 'claim-evidence-verifier-v2';
export const CLAIM_KINDS = Object.freeze({
  FACT: 'FACT',
  ANALYSIS: 'ANALYSIS',
  INFERENCE: 'INFERENCE'
});
const INFERENCE_PREFIX = 'Inferensi JIN';

function provenanceFor(evidence, documentId) {
  if (!evidence) return null;
  return {
    evidenceId: evidence.evidenceId,
    blockId: evidence.blockId,
    page: evidence.page,
    documentId: evidence.documentId || documentId,
    type: evidence.type,
    source: evidence.source,
    confidence: evidence.confidence
  };
}

function withInferenceLabel(text = '') {
  const t = String(text || '');
  return /^inferensi\s+jin\s*:/i.test(t.trim()) ? t : `${INFERENCE_PREFIX}: ${t}`;
}

export class ClaimEvidenceVerifier {
  constructor(store) {
    if (!(store instanceof DocumentEvidenceStore)) {
      throw new Error('[ClaimEvidenceVerifier] wajib menerima DocumentEvidenceStore (9Router evidence boundary).');
    }
    this.store = store;
    this.version = VERIFIER_VERSION;
  }

  verifyClaim(claim = {}) {
    const evidenceIds = Array.isArray(claim.evidenceIds) ? claim.evidenceIds : [];
    const documentId = claim.documentId || null;
    const kind = CLAIM_KINDS[String(claim.kind || 'FACT').toUpperCase()] || CLAIM_KINDS.FACT;

    // PHASE 6 â€” INFERENCE tidak pernah VERIFIED: interpretasi JIN, bukan fakta.
    // Tanpa evidence: INSUFFICIENT berlabel (bukan REJECT â€” tidak hilang diam-diam).
    // Dengan evidence: CONTRADICTED bila konflik, selain itu INSUFFICIENT berlabel
    // (evidence pendukung dicatat di provenance, tapi status tetap non-fakta).
    if (kind === CLAIM_KINDS.INFERENCE) {
      if (evidenceIds.length > 0) {
        const missing = evidenceIds.filter((id) => !this.store.has(id));
        if (missing.length > 0) {
          return {
            claim: claim.text || '', kind, state: CLAIM_STATES.UNVERIFIED, code: 'REJECT',
            evidenceIds,
            reason: `INFERENCE dengan evidenceId tidak dikenal: ${missing.join(', ')} -> REJECT.`,
            provenance: missing.map((id) => ({ evidenceId: id, missing: true }))
          };
        }
        const linked = evidenceIds.map((id) => this.store.get(id));
        const conflict = linked.find((e) => e.type === 'CONFLICT' || e.contradiction);
        if (conflict) {
          return {
            claim: claim.text || '', kind, state: CLAIM_STATES.CONTRADICTED, code: 'CONTRADICTED',
            evidenceIds,
            reason: 'INFERENCE bertentangan dengan evidence.',
            provenance: linked.map((e) => provenanceFor(e, documentId))
          };
        }
        return {
          claim: withInferenceLabel(claim.text), kind, state: CLAIM_STATES.INSUFFICIENT_EVIDENCE, code: 'INSUFFICIENT_EVIDENCE',
          evidenceIds,
          reason: `${INFERENCE_PREFIX} â€” interpretasi, bukan fakta dokumen; tidak di-VERIFIED.`,
          provenance: linked.map((e) => provenanceFor(e, documentId))
        };
      }
      return {
        claim: withInferenceLabel(claim.text), kind, state: CLAIM_STATES.INSUFFICIENT_EVIDENCE, code: 'INSUFFICIENT_EVIDENCE',
        evidenceIds: [],
        reason: `${INFERENCE_PREFIX} tanpa kutipan evidence â€” interpretasi, bukan fakta.`,
        provenance: []
      };
    }

    if (evidenceIds.length === 0) {
      return {
        claim: claim.text || '', kind, state: CLAIM_STATES.UNVERIFIED, code: 'REJECT',
        evidenceIds: [],
        reason: `Claim ${kind} tanpa evidenceId -> REJECT.`, provenance: []
      };
    }
    const missing = evidenceIds.filter((id) => !this.store.has(id));
    if (missing.length > 0) {
      return {
        claim: claim.text || '', kind, state: CLAIM_STATES.UNVERIFIED, code: 'REJECT',
        evidenceIds,
        reason: `evidenceId tidak dikenal: ${missing.join(', ')} -> REJECT.`,
        provenance: missing.map((id) => ({ evidenceId: id, missing: true }))
      };
    }

    const linked = evidenceIds.map((id) => this.store.get(id));

    const conflict = linked.find((e) => e.type === 'CONFLICT' || e.contradiction);
    if (conflict) {
      return {
        claim: claim.text || '', kind, state: CLAIM_STATES.CONTRADICTED, code: 'CONTRADICTED',
        evidenceIds,
        reason: 'Evidence menunjukkan konflik/penentangan.',
        provenance: linked.map((e) => provenanceFor(e, documentId))
      };
    }

    const minConf = Math.min(...linked.map((e) => Number(e.confidence) || 0));
    if (minConf < 0.5) {
      return {
        claim: claim.text || '', kind, state: CLAIM_STATES.INSUFFICIENT_EVIDENCE, code: 'INSUFFICIENT_EVIDENCE',
        evidenceIds,
        reason: `Confidence terendah ${minConf} < 0.5 â€” evidence tidak cukup kuat.`,
        provenance: linked.map((e) => provenanceFor(e, documentId))
      };
    }

    return {
      claim: claim.text || '', kind, state: CLAIM_STATES.VERIFIED, code: 'VERIFIED',
      evidenceIds,
      reason: kind === CLAIM_KINDS.ANALYSIS
        ? 'ANALYSIS didukung evidence yang valid dan cukup kuat (pola antar-evidence).'
        : 'Claim didukung evidence yang valid dan cukup kuat.',
      provenance: linked.map((e) => provenanceFor(e, documentId))
    };
  }

  verifyClaims(claims = []) {
    const decisions = (claims || []).map((c) => this.verifyClaim(c));
    const pick = (code) => decisions.filter((d) => d.code === code);
    const verified = pick('VERIFIED');
    const contradicted = pick('CONTRADICTED');
    const insufficient = pick('INSUFFICIENT_EVIDENCE');
    const rejected = pick('REJECT');
    return {
      verified, contradicted, insufficient, rejected, decisions,
      version: this.version,
      summary: {
        total: decisions.length,
        verified: verified.length,
        contradicted: contradicted.length,
        insufficient: insufficient.length,
        rejected: rejected.length
      }
    };
  }

  /**
   * PHASE 4 spec: verifier bukan sekadar filter â€” hasil adalah verification
   * report permanen yang menempel pada jawaban (bukan hanya log internal).
   * report = { version, summary, claims:[{text,status,evidenceIds,provenance,reason}] }
   */
  buildReport(verification = {}) {
    const decisions = verification.decisions || [];
    return {
      version: verification.version || this.version,
      summary: verification.summary || {},
      claims: decisions.map((d) => ({
        text: d.claim,
        kind: d.kind || 'FACT',
        status: d.code,
        state: d.state,
        evidenceIds: d.evidenceIds || [],
        provenance: (d.provenance || []).map((p) => ({
          evidenceId: p.evidenceId,
          blockId: p.blockId || null,
          page: p.page ?? null,
          documentId: p.documentId || null,
          missing: Boolean(p.missing)
        })),
        reason: d.reason
      }))
    };
  }

  composeVerifiedAnswer(originalAnswer = '', verification = {}) {
    const v = verification.summary || { verified: 0, contradicted: 0, insufficient: 0, rejected: 0 };
    const byKind = (list = [], kind) => list.filter((d) => (d.kind || 'FACT') === kind);
    const factLines = byKind(verification.verified || [], 'FACT').map((d) => d.claim).filter(Boolean);
    const analysisLines = byKind(verification.verified || [], 'ANALYSIS').map((d) => d.claim).filter(Boolean);
    const lines = [...factLines];
    if (analysisLines.length) {
      lines.push('ANALISIS JIN (pola antar-evidence, terverifikasi):');
      for (const aX of analysisLines) lines.push('[ANALYSIS] ' + aX);
    }
    const pagesOf = (d) => (d.provenance || []).map((p) => p?.page).filter((p) => Number.isFinite(p));
    const caveats = [];
    // INFERENCE tidak disajikan sebagai fakta: selalu di bawah label, dengan halaman pendukung bila ada.
    for (const d of (verification.insufficient || []).filter((x) => (x.kind || 'FACT') === 'INFERENCE')) {
      const pg = pagesOf(d);
      caveats.push(`${d.claim}${pg.length ? ` (terkait halaman ${pg.join(', ')})` : ''} â€” ${INFERENCE_PREFIX}, bukan fakta dokumen.`);
    }
    // Klaim tidak-verified TIDAK dihapus diam-diam: tetap disebut dengan
    // status + halaman buktinya, agar evidence chain bagian dari jawaban.
    for (const d of (verification.insufficient || [])) {
      const pg = pagesOf(d);
      caveats.push(`Untuk "${d.claim}", evidence yang tersedia belum cukup${pg.length ? ` (halaman ${pg.join(', ')})` : ''}.`);
    }
    for (const d of (verification.contradicted || [])) {
      const pg = pagesOf(d);
      caveats.push(`Klaim "${d.claim}" bertentangan dengan evidence${pg.length ? ` pada halaman ${pg.join(', ')}` : ''} dan tidak disajikan sebagai fakta.`);
    }
    if (v.rejected > 0) {
      const notes = (verification.rejected || []).map((d) => d.claim).filter(Boolean);
      caveats.push(`Tidak ditemukan evidence yang mendukung: ${notes.join(' | ')} (REJECT).`);
    }
    if (lines.length === 0 && caveats.length === 0) {
      return {
        text: originalAnswer,
        status: 'NO_CLAIMS',
        note: 'Tidak ada klaim ber-evidence untuk verifikasi; jawaban legacy dipertahankan tanpa klaim terverifikasi.'
      };
    }
    if (lines.length === 0) {
      return {
        text: `Saya tidak menemukan dasar pernyataan yang cukup dalam dokumen untuk disajikan sebagai fakta.\n\n${caveats.join('\n')}`,
        status: 'ALL_CLAIMS_BLOCKED', note: caveats.join(' ')
      };
    }
    const text = `${lines.join('\n')}${caveats.length ? `\n\n${caveats.join('\n')}` : ''}`;
    return { text, status: caveats.length ? 'PARTIAL' : 'FULL', note: caveats.join(' ') };
  }
}

export default ClaimEvidenceVerifier;

