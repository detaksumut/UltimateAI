import assert from 'assert';
import fs from 'fs';
import { slideStudioInstance } from '../../server/studio/slide/SlideStudio.mjs';
import { slideDeckPlannerInstance } from '../../server/studio/slide/SlideDeckPlanner.mjs';

async function run() {
  console.log('Testing Cleaned Slide Studio without hardcoded personas...');

  // 1. Deck planning extraction from LLM mock response
  const mockLlmResponse = `
| No | Judul Slide | Archetype | Objektif |
|---|---|---|---|
| 1 | **Transformasi Digital Keuangan Korporasi** | \`title_slide\` | Pembuka |
| 2 | **Tantangan Saat Ini** | \`framework_slide\` | Konteks |
`;
  const plan = slideDeckPlannerInstance.ingestSlidePlan(mockLlmResponse);
  assert.strictEqual(plan.length, 2);
  assert.strictEqual(plan[0].title, 'Transformasi Digital Keuangan Korporasi');
  assert.strictEqual(plan[0].archetype, 'title_slide');

  // Verify no hardcoded persona in any slide title or subtitle
  for (const s of plan) {
    assert.ok(!s.title.includes('Bahkrul'), 'No Bahkrul in title');
    assert.ok(!s.subtitle.includes('Bahkrul'), 'No Bahkrul in subtitle');
  }
  console.log('✓ Dynamic LLM plan ingestion validated without hardcoded personas.');


  // 2. Render Slide 1 (Cover) without presenter
  const resNoPresenter = await slideStudioInstance.createSlide(
    'Transformasi Digital Keuangan Korporasi',
    { forceType: 'title_slide' }
  );
  assert.ok(resNoPresenter.success);
  const svgNoPresenter = fs.readFileSync(resNoPresenter.files.svg.path, 'utf8');
  assert.ok(!svgNoPresenter.includes('Bahkrul'), 'SVG must not have Bahkrul');
  assert.ok(!svgNoPresenter.includes('BKAD'), 'SVG must not have BKAD');
  assert.ok(!svgNoPresenter.includes('Permendagri No. 47'), 'SVG must not have Permendagri');
  console.log('✓ Cover slide without presenter rendered cleanly without mock artifacts.');

  // 3. Render Slide 1 (Cover) with explicit user-provided presenter
  const resWithPresenter = await slideStudioInstance.createSlide(
    'Audit Kinerja dan Akuntabilitas',
    {
      forceType: 'title_slide',
      presenter: {
        name: 'Budi Santoso, S.E., M.Ak.',
        role: 'Auditor Senior',
        institution: 'Inspektorat Jenderal'
      }
    }
  );
  assert.ok(resWithPresenter.success);
  const svgWithPresenter = fs.readFileSync(resWithPresenter.files.svg.path, 'utf8');
  assert.ok(svgWithPresenter.includes('Budi Santoso'), 'SVG must have user presenter name');
  assert.ok(svgWithPresenter.includes('BS'), 'SVG must have dynamic BS initials monogram');
  console.log('✓ Cover slide with custom presenter rendered correctly with dynamic monogram.');

  console.log('ALL CLEANUP CHECKS PASSED!');
}

run().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
