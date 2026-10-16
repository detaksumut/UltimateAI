/**
 * tests/agent/test_negative_prompt_sanitizer.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression tests for ImageGeneration._sanitizeNegativePrompt.
 *
 * The original bug: a negative containing "no plane" / "no aircraft" /
 * "partial plane" cancelled the positive prompt, so the requested subject
 * vanished from every mode.
 *
 * The second bug (found while fixing the first): the fix over-corrected and
 * stripped any negative token that merely MENTIONED the subject. Composition
 * guards such as "tiny distant aircraft", "view over a wing" and
 * "airplane wing crossing the frame" were thrown away, which left the
 * foreground-wing / cropped-subject framing mistakes unopposed.
 *
 * Contract under test:
 *   - a token whose whole meaning is "forbid the subject"  -> STRIPPED
 *   - a token that describes a defect or framing mistake
 *     of the subject                                       -> KEPT
 *   - generic texture terms                                  -> KEPT
 */

import assert from 'assert';
import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';

const sanitize = (neg, pos) => imageGenerationInstance._sanitizeNegativePrompt(neg, pos);

const POS_AIRCRAFT = 'photorealistic aviation photography of a commercial passenger airliner airplane flying in mid-air';
const POS_CAR = 'a red sports car parked on a street';

let failures = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`  \x1b[32mPASS\x1b[0m ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}\n       ${err.message}`);
  }
};

console.log('negative prompt sanitizer — subject conflict rules');

check('strips "no plane" (original bug)', () => {
  const out = sanitize('no plane, blurry', POS_AIRCRAFT);
  assert.ok(!/(^|, )no plane(,|$)/.test(out), `still present: ${out}`);
  assert.ok(out.includes('blurry'), `unrelated token lost: ${out}`);
});

check('strips "no aircraft"', () => {
  const out = sanitize('no aircraft, blurry', POS_AIRCRAFT);
  assert.ok(!/no aircraft/.test(out), `still present: ${out}`);
});

check('strips "partial plane"', () => {
  const out = sanitize('partial plane, blurry', POS_AIRCRAFT);
  assert.ok(!/partial plane/.test(out), `still present: ${out}`);
});

check('strips bare "airplane"', () => {
  const out = sanitize('airplane, blurry', POS_AIRCRAFT);
  assert.ok(!/(^|, )airplane(,|$)/.test(out), `still present: ${out}`);
});

check('strips "no car" for a car subject', () => {
  const out = sanitize('no car, blurry', POS_CAR);
  assert.ok(!/no car/.test(out), `still present: ${out}`);
});

console.log('negative prompt sanitizer — composition/quality guards must survive');

check('keeps "tiny distant aircraft" (framing guard)', () => {
  const out = sanitize('tiny distant aircraft, blurry', POS_AIRCRAFT);
  assert.ok(out.includes('tiny distant aircraft'), `stripped: ${out}`);
});

check('keeps "airplane wing crossing the frame"', () => {
  const out = sanitize('airplane wing crossing the frame, blurry', POS_AIRCRAFT);
  assert.ok(out.includes('airplane wing crossing the frame'), `stripped: ${out}`);
});

check('keeps "view from inside an aircraft"', () => {
  const out = sanitize('view from inside an aircraft, blurry', POS_AIRCRAFT);
  assert.ok(out.includes('view from inside an aircraft'), `stripped: ${out}`);
});

check('keeps "deformed aircraft" (defect guard)', () => {
  const out = sanitize('deformed aircraft, blurry', POS_AIRCRAFT);
  assert.ok(out.includes('deformed aircraft'), `stripped: ${out}`);
});

check('keeps "warped plane body"', () => {
  const out = sanitize('warped plane body, blurry', POS_AIRCRAFT);
  assert.ok(out.includes('warped plane body'), `stripped: ${out}`);
});

check('keeps "landing gear down"', () => {
  const out = sanitize('landing gear down, blurry', POS_AIRCRAFT);
  assert.ok(out.includes('landing gear down'), `stripped: ${out}`);
});

console.log('negative prompt sanitizer — non-subject tokens untouched');

check('never strips generic texture terms', () => {
  const out = sanitize('blurry, low quality, watermark, jpeg artifacts', POS_AIRCRAFT);
  assert.strictEqual(out, 'blurry, low quality, watermark, jpeg artifacts', `got: ${out}`);
});

check('leaves the negative alone when the subject is absent from the positive prompt', () => {
  const out = sanitize('no plane, blurry', 'a bowl of fruit on a table');
  assert.ok(out.includes('no plane'), `stripped: ${out}`);
});

check('handles empty / falsy input', () => {
  assert.strictEqual(sanitize('', POS_AIRCRAFT), '');
  assert.strictEqual(sanitize(null, POS_AIRCRAFT), '');
  assert.strictEqual(sanitize(undefined, POS_AIRCRAFT), '');
});

check('does not duplicate tokens', () => {
  const out = sanitize('blurry, blurry, no plane', POS_AIRCRAFT);
  assert.ok(!/, blurry, blurry,/.test(out), `duplicate kept: ${out}`);
});

console.log('CLIP 77-token budget composer');

check('keeps the highest-priority clauses and drops the tail', () => {
  const many = Array.from({ length: 60 }, (_, i) => `filler clause number ${i} with padding`);
  const out = imageGenerationInstance._joinWithinClipBudget(many, 'test');
  assert.ok(out.startsWith('filler clause number 0'), `head lost: ${out.slice(0, 40)}`);
  assert.ok(!out.includes('number 59'), 'tail was not dropped');
  assert.ok(Math.ceil(out.length / 4) <= 74, `over budget: ~${Math.ceil(out.length / 4)}`);
});

check('the framing guard placed first survives truncation', () => {
  const subject = Array.from({ length: 40 }, (_, i) => `long subject clause ${i}`).join(', ');
  const out = imageGenerationInstance._joinWithinClipBudget(
    [['wide establishing shot, nothing cropped'], subject.split(', ')],
    'test'
  );
  assert.ok(out.includes('wide establishing shot, nothing cropped'), `lost: ${out.slice(0, 60)}`);
});

check('returns an empty string for empty input', () => {
  assert.strictEqual(imageGenerationInstance._joinWithinClipBudget([], 'test'), '');
  assert.strictEqual(imageGenerationInstance._joinWithinClipBudget(['', '  '], 'test'), '');
});

check('accepts a single flat array or nested arrays', () => {
  assert.strictEqual(imageGenerationInstance._joinWithinClipBudget(['a', 'b'], 'test'), 'a, b');
  assert.strictEqual(imageGenerationInstance._joinWithinClipBudget([['a'], ['b']], 'test'), 'a, b');
});

check('every clause that fits is preserved in the supplied order', () => {
  const out = imageGenerationInstance._joinWithinClipBudget(
    [['one', 'two', 'three']], 'test'
  );
  assert.strictEqual(out, 'one, two, three');
});

if (failures > 0) {
  console.log(`\n\x1b[31m${failures} test(s) failed\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mall tests passed\x1b[0m');
