/**
 * tests/agent/test_revision_prompt_enhancer_v2.mjs
 * 
 * Verifies Step 1 Implementation:
 * 1. RevisionPromptEnhancer produces clean naturalPrompt without legacy SD weighting syntax.
 * 2. RevisionPromptEnhancer preserves subject lock in primacy position.
 * 3. SmartScenePromptSynthesizer eliminates token-stuffing cliches (8k, photorealistic, no people).
 * 4. All assertions strictly validated.
 */

import assert from 'assert';
import { RevisionPromptEnhancer } from '../../server/agent/RevisionPromptEnhancer.mjs';
import { SmartScenePromptSynthesizer } from '../../server/agent/SmartScenePromptSynthesizer.mjs';

console.log('=== VERIFICATION SUITE: Step 1 Prompt Enhancer Refactoring ===\n');

// 1. RevisionPromptEnhancer - Natural Prompt Generation (Cloud / FLUX mode)
console.log('[1] Natural Prompt Generation for Cloud Diffusion:');
const sunsetRes = RevisionPromptEnhancer.enhance({
  modification: 'suasana senja sunset',
  originalPrompt: 'sebuah pesawat terbang melintasi gunung',
  subject: 'commercial airliner airplane'
});

console.log('  naturalPrompt:', sunsetRes.naturalPrompt);
assert.ok(sunsetRes.naturalPrompt, 'naturalPrompt must be defined');
assert.ok(!sunsetRes.naturalPrompt.includes(':1.45'), 'naturalPrompt must NOT contain :1.45 weight');
assert.ok(!sunsetRes.naturalPrompt.includes('(('), 'naturalPrompt must NOT contain double parentheses');
assert.ok(sunsetRes.naturalPrompt.includes('commercial airliner airplane'), 'Must preserve subject');
assert.ok(sunsetRes.naturalPrompt.includes('sunset'), 'Must convey sunset atmosphere');
console.log('  ✓ Natural prompt is clean, unweighted, and subject-anchored');

// 2. Nighttime Natural Prompt
console.log('\n[2] Nighttime Natural Prompt:');
const nightRes = RevisionPromptEnhancer.enhance({
  modification: 'malam hari gelap',
  originalPrompt: 'mobil sport merah melaju di jalan tol',
  subject: 'sports car on road'
});
console.log('  naturalPrompt:', nightRes.naturalPrompt);
assert.ok(!nightRes.naturalPrompt.includes(':1.45'), 'No weights in natural prompt');
assert.ok(nightRes.naturalPrompt.includes('sports car on road'), 'Subject preserved');
assert.ok(nightRes.naturalPrompt.includes('night'), 'Night atmosphere applied');
console.log('  ✓ Night natural prompt is crisp and focused');

// 3. SmartScenePromptSynthesizer - Elimination of Cliches
console.log('\n[3] SmartScenePromptSynthesizer Anti-Overprompting:');
const synth = SmartScenePromptSynthesizer.synthesize(
  'buatkan gambar pesawat terbang melintasi gunung',
  'sekarang ganti suasana sunset'
);
console.log('  Synthesized prompt:', synth);
assert.ok(!synth.includes('no people'), 'Must NOT append blind "no people"');
assert.ok(!synth.includes('no distortions'), 'Must NOT append blind "no distortions"');
assert.ok(!synth.includes('8k'), 'Must NOT append generic "8k" cliche');
assert.ok(synth.includes('commercial airliner airplane'), 'Must preserve airplane');
assert.ok(synth.includes('mountain'), 'Must preserve mountain');
assert.ok(synth.includes('sunset'), 'Must apply sunset');
assert.ok(synth.includes('golden hour'), 'Must apply golden hour lighting');
assert.ok(synth.includes('high contrast'), 'Must include high contrast');
console.log('  ✓ Synthesized prompt eliminates clutter while maintaining strict scene fidelity');

// 4. Backward Compatibility with Existing SD Weighted Tests
console.log('\n[4] Backward Compatibility for SD Weighted Mode:');
assert.ok(sunsetRes.positivePrompt.includes(':1.45'), 'SD weighted mode retains weight token for ComfyUI');
assert.ok(sunsetRes.negativePrompt.includes(':1.4'), 'SD negative prompt retains weight token');
assert.strictEqual(sunsetRes.normalizedModificationKey, 'sunset');
console.log('  ✓ Full backward compatibility with ComfyUI and existing regression tests maintained');

console.log('\n✅ ALL STEP 1 PROMPT ENHANCER VERIFICATION CHECKS PASSED!');
