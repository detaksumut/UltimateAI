import fs from 'fs';
import path from 'path';

export function evaluateResponse(testCase, rawResponse) {
  const text = (rawResponse || '').trim();
  const lower = text.toLowerCase();
  const errors = [];
  let score = 'FAIL';
  let notes = '';

  if (!text || text.length === 0) {
    errors.push('E06'); // context loss
    errors.push('E11'); // instruction drift
    return { score: 'FAIL', errors, notes: 'Empty response from model' };
  }

  switch (testCase.category) {
    case 'A_EXACT_EXTRACTION':
      if (testCase.id === 'CASE_A01') {
        if (/SPEC-AT-RQS-2026-V1\.0/i.test(text)) {
          score = 'PASS';
          notes = 'Exact Document ID extracted perfectly';
        } else if (/AT-RQS/i.test(text)) {
          score = 'PARTIAL';
          errors.push('E01');
          notes = 'Mentioned AT-RQS but missed exact specification code';
        } else {
          score = 'FAIL';
          errors.push('E01');
          errors.push('E09');
          notes = 'Failed to extract exact document ID';
        }
      } else if (testCase.id === 'CASE_A02') {
        const hasScore = /SCORE/i.test(text);
        const hasScreen = /SCREEN/i.test(text);
        const hasClue = /CLUE/i.test(text);
        if (hasScore && hasScreen && hasClue) {
          if (lower.includes('structured content') && lower.includes('statistical compliance') && lower.includes('contextual logic')) {
            score = 'PASS';
            notes = 'All 3 acronyms and full names extracted accurately';
          } else {
            score = 'PARTIAL';
            errors.push('E02');
            notes = 'Acronyms present, but expansion mutated or partially missing';
          }
        } else {
          score = 'FAIL';
          errors.push('E01');
          errors.push('E05');
          notes = 'Missing one or more Tri-Source layer acronyms';
        }
      } else if (testCase.id === 'CASE_A03') {
        let count = 0;
        if (/Methodological Coherence/i.test(text)) count++;
        if (/Data Grounding/i.test(text)) count++;
        if (/Inferential Soundness/i.test(text)) count++;
        if (/Statistical Reproducibility/i.test(text)) count++;
        if (/Cross-Source Corroboration/i.test(text)) count++;
        if (count === 5) {
          score = 'PASS';
          notes = 'All 5 AECI pillars extracted with zero errors';
        } else if (count >= 3) {
          score = 'PARTIAL';
          errors.push('E05');
          notes = `Only ${count}/5 AECI pillars identified`;
        } else {
          score = 'FAIL';
          errors.push('E01');
          errors.push('E09');
          notes = `Failed extraction of AECI pillars (${count}/5)`;
        }
      } else if (testCase.id === 'CASE_A04') {
        let matched = 0;
        ['G06F 40/20', 'G06N 3/00', 'G06F 16/30', 'G06F 21/64'].forEach(ipc => {
          if (text.includes(ipc.replace(/\s+/g, '')) || text.includes(ipc)) matched++;
        });
        if (matched >= 3) {
          score = 'PASS';
          notes = `Extracted ${matched}/4 IPC classes accurately`;
        } else if (matched >= 1) {
          score = 'PARTIAL';
          errors.push('E01');
          notes = `Only ${matched}/4 IPC classes identified`;
        } else {
          score = 'FAIL';
          errors.push('E01');
          errors.push('E09');
          notes = 'Failed to extract IPC classes';
        }
      } else if (testCase.id === 'CASE_A05') {
        const hasDate = /24\s+Agustus\s+2026/i.test(text);
        const hasCities = /Jakarta/i.test(text) && /Medan/i.test(text) && /Kuala\s+Lumpur/i.test(text);
        if (hasDate && hasCities) {
          score = 'PASS';
          notes = 'Date and all 3 regional locations extracted';
        } else if (hasDate || hasCities) {
          score = 'PARTIAL';
          errors.push('E01');
          notes = 'Partially extracted date or locations';
        } else {
          score = 'FAIL';
          errors.push('E01');
          notes = 'Failed to extract establishment date and locations';
        }
      }
      break;

    case 'B_STRUCTURED_EXTRACTION':
      if (testCase.id === 'CASE_B01') {
        let weightMatches = 0;
        if (/0\.15|15%/i.test(text)) weightMatches++;
        if (/0\.20|20%/i.test(text)) weightMatches++;
        if (/0\.10|10%/i.test(text)) weightMatches++;
        if (/0\.05|5%/i.test(text)) weightMatches++;
        if (weightMatches >= 3 && (/D1/i.test(text) || /Problem/i.test(text))) {
          score = 'PASS';
          notes = 'BWS dimensions and weight distribution extracted';
        } else if (weightMatches >= 1) {
          score = 'PARTIAL';
          errors.push('E03');
          notes = 'BWS dimensions found but numerical weights inaccurate';
        } else {
          score = 'FAIL';
          errors.push('E01');
          errors.push('E03');
          notes = 'Failed BWS table extraction';
        }
      } else if (testCase.id === 'CASE_B02') {
        const has35 = (text.match(/0\.35|35%/g) || []).length >= 2;
        const has30 = /0\.30|30%/.test(text);
        if (has35 && has30) {
          score = 'PASS';
          notes = 'Layer weights: SCORE 0.35, SCREEN 0.35, CLUE 0.30 correctly matched';
        } else if (has35 || has30) {
          score = 'PARTIAL';
          errors.push('E03');
          notes = 'Partial weight match';
        } else {
          score = 'FAIL';
          errors.push('E03');
          notes = 'Failed layer weights extraction';
        }
      } else if (testCase.id === 'CASE_B03') {
        if (/World\s+Class/i.test(text) && /Sub-Standard|Desk\s+Reject/i.test(text)) {
          score = 'PASS';
          notes = 'Quality tiers extracted accurately';
        } else {
          score = 'PARTIAL';
          errors.push('E05');
          notes = 'Partial tier extraction';
        }
      } else if (testCase.id === 'CASE_B04') {
        if (/SCORE/i.test(text) && /SCREEN/i.test(text) && /CLUE/i.test(text)) {
          score = 'PASS';
          notes = 'Tri-Source components identified';
        } else {
          score = 'FAIL';
          errors.push('E01');
        }
      }
      break;

    case 'C_NUMERICAL_FIDELITY':
      if (testCase.id === 'CASE_C01') {
        const hasLambda = /0\.35/.test(text);
        const hasGamma = /1\.5|1\.50/.test(text);
        if (hasLambda && hasGamma) {
          score = 'PASS';
          notes = 'Lambda=0.35 and Gamma=1.50 exact match';
        } else if (hasLambda || hasGamma) {
          score = 'PARTIAL';
          errors.push('E03');
          notes = 'One parameter matched, one mutated';
        } else {
          score = 'FAIL';
          errors.push('E03');
          notes = 'Both numerical parameters missing or mutated';
        }
      } else if (testCase.id === 'CASE_C02') {
        const hasMin = /0\.65/.test(text);
        const hasMax = /1\.0|1\.00|1\b/.test(text);
        if (hasMin && hasMax) {
          score = 'PASS';
          notes = 'Bounds [0.65, 1.00] exact match';
        } else {
          score = 'FAIL';
          errors.push('E03');
          notes = 'Bounds mutated or incorrect';
        }
      } else if (testCase.id === 'CASE_C03') {
        const has37 = /37\.5|37,5/.test(text);
        const has4 = /4\.2|4,2/.test(text);
        if (has37 && has4) {
          score = 'PASS';
          notes = 'Ablation rates: 37.5% vs 4.2% exact match';
        } else if (has37 || has4) {
          score = 'PARTIAL';
          errors.push('E03');
          notes = 'Only one ablation figure correct';
        } else {
          score = 'FAIL';
          errors.push('E03');
          notes = 'Ablation figures mutated';
        }
      } else if (testCase.id === 'CASE_C04') {
        const has20 = /\b20\b/.test(text);
        const has1_8_15 = /\b1\b/.test(text) && /\b8\b/.test(text) && /\b15\b/.test(text);
        if (has20 && has1_8_15) {
          score = 'PASS';
          notes = 'Total 20 claims and independent claims 1, 8, 15 matched';
        } else {
          score = 'FAIL';
          errors.push('E03');
          notes = 'Claim numbering mutated';
        }
      } else if (testCase.id === 'CASE_C05') {
        const has90 = /90/.test(text);
        const has55 = /55/.test(text);
        if (has90 && has55) {
          score = 'PASS';
          notes = 'Tier thresholds 90 and 55 identified';
        } else {
          score = 'FAIL';
          errors.push('E03');
        }
      }
      break;

    case 'D_FORMULA_FIDELITY':
      if (testCase.id === 'CASE_D01') {
        if (/CF\s*=\s*1(\.0)?\s*-\s*(lambda|0\.35|λ)\s*\*\s*\(1(\.0)?\s*-\s*AECI\)\^?(gamma|1\.5|1\.50|\*\*)/i.test(text) ||
            (text.includes('1') && text.includes('lambda') && text.includes('AECI') && (text.includes('gamma') || text.includes('1.5')))) {
          score = 'PASS';
          notes = 'CF formula structure accurate';
        } else {
          score = 'FAIL';
          errors.push('E04');
          notes = 'Formula mutated or malformed';
        }
      } else if (testCase.id === 'CASE_D02') {
        if (text.includes('S_SCORE') && text.includes('S_SCREEN') && text.includes('S_CLUE') && text.includes('CF')) {
          score = 'PASS';
          notes = 'Master formula variables and CF multiplier matched';
        } else {
          score = 'FAIL';
          errors.push('E04');
        }
      } else if (testCase.id === 'CASE_D03') {
        if (/ARTI\s*=\s*AT_RQS\s*\*\s*sqrt\s*\(\s*AECI\s*\)/i.test(text) || (text.includes('sqrt') && text.includes('AECI'))) {
          score = 'PASS';
          notes = 'ARTI formula accurately retrieved';
        } else {
          score = 'FAIL';
          errors.push('E04');
        }
      } else if (testCase.id === 'CASE_D04') {
        if (text.includes('min') && (text.includes('N_verified') || text.includes('Error_Rate') || text.includes('verified'))) {
          score = 'PASS';
          notes = 'AAC formula retrieved';
        } else {
          score = 'FAIL';
          errors.push('E04');
        }
      } else if (testCase.id === 'CASE_D05') {
        if (/X_norm/i.test(text) && /X_max/i.test(text) && /X_min/i.test(text)) {
          score = 'PASS';
          notes = 'Min-max normalization equation matched';
        } else {
          score = 'FAIL';
          errors.push('E04');
        }
      }
      break;

    case 'E_CROSS_SECTION_CONSISTENCY':
      if (testCase.id === 'CASE_E01') {
        const has1 = /1\.0|1\b/.test(text);
        const has065 = /0\.65/.test(text);
        if (has1 && has065) {
          score = 'PASS';
          notes = 'Correctly derived CF=1.0 at AECI=1 and CF=0.65 at AECI=0';
        } else {
          score = 'FAIL';
          errors.push('E07');
          notes = 'Inconsistent numerical derivation';
        }
      } else if (testCase.id === 'CASE_E02') {
        if (/sistem|aparatus/i.test(text) && /metode/i.test(text) && /media/i.test(text)) {
          score = 'PASS';
          notes = 'Independent claims categorized accurately';
        } else {
          score = 'PARTIAL';
          errors.push('E05');
        }
      } else if (testCase.id === 'CASE_E03') {
        if (/VAL-AT-RQS-2026-B01/i.test(text)) {
          score = 'PASS';
        } else {
          score = 'FAIL';
          errors.push('E01');
        }
      }
      break;

    case 'F_LONG_CONTEXT_COMPREHENSION':
      if (testCase.id === 'CASE_F01') {
        if (/12\s+Bulan/i.test(text) || /DJKI/i.test(text) || /Patent Counsel/i.test(text)) {
          score = 'PASS';
          notes = 'Prosecution status and PCT window recognized';
        } else {
          score = 'FAIL';
          errors.push('E06');
        }
      } else if (testCase.id === 'CASE_F02') {
        if (/ASIA/i.test(text) || /APASIFIC/i.test(text) || /59675598500/i.test(text)) {
          score = 'PASS';
          notes = 'Issuing institution and credentials identified';
        } else {
          score = 'FAIL';
          errors.push('E01');
        }
      } else if (testCase.id === 'CASE_F03') {
        if (/ASIA/i.test(text) || /APASIFIC/i.test(text)) {
          score = 'PASS';
        } else {
          score = 'FAIL';
          errors.push('E01');
        }
      }
      break;

    case 'G_CONTRADICTION_DETECTION':
      if (/salah|false|tidak\s+benar|kontradiksi/i.test(text)) {
        score = 'PASS';
        notes = 'Successfully detected factual contradiction';
      } else {
        score = 'FAIL';
        errors.push('E07'); // Contradiction blindness
        notes = 'Model failed to identify contradiction and accepted falsehood';
      }
      break;

    case 'H_EVIDENCE_GROUNDING':
      if (testCase.id === 'CASE_H01') {
        if (/frekuensi|regresi|linear|retoris/i.test(text)) {
          score = 'PASS';
          notes = 'Prior art deficiency correctly grounded in evidence';
        } else {
          score = 'FAIL';
          errors.push('E12');
        }
      } else if (testCase.id === 'CASE_H02') {
        if (/SHA-256|kriptograf|hashing/i.test(text)) {
          score = 'PASS';
          notes = 'SHA-256 cryptographic locking grounded in evidence';
        } else {
          score = 'FAIL';
          errors.push('E12');
        }
      } else if (testCase.id === 'CASE_H03') {
        if (/statistik|anomali|kepatuhan|reproducibility/i.test(text)) {
          score = 'PASS';
          notes = 'SCREEN evidence grounding verified';
        } else {
          score = 'FAIL';
          errors.push('E12');
        }
      }
      break;

    case 'I_OVERCLAIM_DETECTION':
      if (/overclaim|tidak\s+didukung|salah|bukan\s+jaminan|tidak\s+pernah\s+mengklaim/i.test(text)) {
        score = 'PASS';
        notes = 'Correctly detected overclaim';
      } else {
        score = 'FAIL';
        errors.push('E10'); // Overclaim
        notes = 'Model failed to flag excessive overclaim';
      }
      break;

    case 'J_SELF_CORRECTION':
      if (/koreksi|terbalik|salah|yang\s+benar|seharusnya/i.test(text)) {
        score = 'PASS';
        notes = 'Model executed factual self-correction successfully';
      } else {
        score = 'FAIL';
        errors.push('E08');
        notes = 'Model failed to provide factual correction';
      }
      break;

    default:
      score = 'PARTIAL';
  }

  return { score, errors, notes };
}
