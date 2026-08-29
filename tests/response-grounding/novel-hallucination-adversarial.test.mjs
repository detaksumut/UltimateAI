/**
 * novel-hallucination-adversarial.test.mjs
 * Adversarial Testing for NOVEL, UNSEEN System Names & Dynamic Evidence Verification.
 *
 * Tests whether the positive-whitelist satpam intercepts brand-new fabricated names
 * that were NEVER hardcoded in the codebase.
 */

import { responseGroundingGuardInstance } from '../../server/grounding/ResponseGroundingGuard.mjs';
import { isVerifiedSystemEntity, isCapabilityAvailable } from '../../server/grounding/CapabilityRegistry.mjs';

console.log('\n========================================================================');
console.log('âš”ï¸ ADVERSARIAL STRESS TEST â€” NOVEL & UNSEEN HALLUCINATED SYSTEM NAMES');
console.log('========================================================================\n');

let pass = 0;
let fail = 0;

function testNovel(id, novelName, sampleTemplate, prompt = 'Tolong proses file ini') {
  const raw = sampleTemplate.replace('{{NAME}}', novelName);
  const result = responseGroundingGuardInstance.guard(raw, prompt);

  const containsNovel = result.cleanedText.includes(novelName);
  const violationLogged = result.violationsDetected.some(v => v.type === 'UNVERIFIED_SYSTEM_NAME_INTERCEPTED' && v.interceptedName === novelName);

  if (!containsNovel && violationLogged) {
    console.log(`âœ… [NOVEL ${String(id).padStart(2, '0')}] Blocked Unseen Name: "${novelName}" âž” Sanitized: "${result.cleanedText.slice(0, 70)}..."`);
    pass++;
  } else {
    console.error(`âŒ [NOVEL ${String(id).padStart(2, '0')}] FAILED TO BLOCK: "${novelName}"! Found in output: "${result.cleanedText}"`);
    fail++;
  }
}

// 25 Completely Novel, Randomly Invented Hallucination Names (Never hardcoded anywhere)
const NOVEL_NAMES = [
  'Sonic AI Engine',
  'Voice Intelligence Core',
  'Ultimate Audio Matrix',
  'Quantum Document Matrix',
  'HyperSpectral Audio Pro',
  'Neural Synthesizer v9',
  'Apex Speech Processor',
  'OmniKnowledge Architecture',
  'CyberWave Audio Pipeline',
  'DeepCognition Subsystem',
  'Titan Transcript Suite',
  'Vocalis Master Nexus',
  'Synapse Voice Platform',
  'Acoustic Reasoning Matrix',
  'Spectra Audio Core',
  'MegaTranscribe Enterprise',
  'Prism Document Engine',
  'Nexus Speech Protocol',
  'Aura Intelligence Network',
  'Alpha Transcript Studio',
  'Cortex Audio Subsystem',
  'Dynamic Speech Matrix',
  'Quantum Voice Engine',
  'Infinity Audio Core',
  'UltraCognition Pipeline'
];

NOVEL_NAMES.forEach((name, i) => {
  testNovel(i + 1, name, `Saya telah mengaktifkan {{NAME}} untuk mengeksekusi permintaan Anda.`);
});

// Dynamic Evidence Tests for Dynamic Capability Claims
console.log('\n--- Dynamic Capability Evidence Tests ---');

// Test 26: Diarization Claim Rejection
{
  const r = responseGroundingGuardInstance.guard('Saya bisa membedakan 5 pembicara sekaligus.', 'Kamu bisa bedakan pembicara?');
  const ok = r.cleanedText.includes('belum dapat memastikan pemisahan pembicara');
  if (ok) {
    console.log('âœ… [EVIDENCE 26] Diarization capability claim verified against live capability health âž” Rejected');
    pass++;
  } else {
    console.error('âŒ [EVIDENCE 26] Failed diarization claim check');
    fail++;
  }
}

// Test 27: Multi-Speaker Count Detection Rejection
{
  const r = responseGroundingGuardInstance.guard('Tentu, saya bisa menghitung jumlah pembicara.', 'Bisa hitung berapa orang bicara?');
  const ok = r.cleanedText.includes('belum dapat menghitung jumlah pembicara');
  if (ok) {
    console.log('âœ… [EVIDENCE 27] Exact speaker count claim verified against live capability health âž” Rejected');
    pass++;
  } else {
    console.error('âŒ [EVIDENCE 27] Failed speaker count check');
    fail++;
  }
}

// Test 28: URL Audio Stream Rejection
{
  const r = responseGroundingGuardInstance.guard('Saya akan stream audio dari URL youtube tersebut.', 'Bisa ambil audio dari link youtube?');
  const ok = r.cleanedText.includes('belum dapat diproses secara langsung');
  if (ok) {
    console.log('âœ… [EVIDENCE 28] External URL audio streaming verified against live capability health âž” Rejected');
    pass++;
  } else {
    console.error('âŒ [EVIDENCE 28] Failed URL stream check');
    fail++;
  }
}

// Test 29: Positive System Whitelist Preservation
{
  const r = responseGroundingGuardInstance.guard('Hasil analisis telah disimpan di Memory Vault dan Research Lab.', 'Di mana datanya?');
  const ok = r.cleanedText.includes('Memory Vault') && r.cleanedText.includes('Research Lab');
  if (ok) {
    console.log('âœ… [WHITELIST 29] Legitimate authorized entities ("Memory Vault", "Research Lab") preserved without false positives');
    pass++;
  } else {
    console.error('âŒ [WHITELIST 29] Failed positive whitelist check');
    fail++;
  }
}

// Test 30: Positive UltimateAI Whitelist Preservation
{
  const r = responseGroundingGuardInstance.guard('Selamat datang di UltimateAI bersama JIN.', 'Halo');
  const ok = r.cleanedText.includes('UltimateAI') && r.cleanedText.includes('JIN');
  if (ok) {
    console.log('âœ… [WHITELIST 30] Core branding entities ("UltimateAI", "JIN") preserved cleanly');
    pass++;
  } else {
    console.error('âŒ [WHITELIST 30] Failed core branding check');
    fail++;
  }
}

console.log('\n========================================================================');
console.log(`ðŸ“Š ADVERSARIAL TEST SUMMARY: ${pass}/30 PASSED (${((pass/30)*100).toFixed(0)}%) | ${fail} FAILED`);
console.log('========================================================================\n');

if (fail > 0) {
  process.exit(1);
}
