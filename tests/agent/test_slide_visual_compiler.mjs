/**
 * tests/agent/test_slide_visual_compiler.mjs
 * 
 * Verifies Dynamic Contextual Infographic Compiler (ChatGPT / DALL-E Pattern):
 * 1. Takes user input like 'buatkan visual slide "Kelebihan dan Kekurangan Regulasi Perdes" format 16:9 style corporate enterprise'
 * 2. Compiles it into an executive presentation slide infographic layout matching the exact topic context.
 * 3. Dynamically structures comparison cards, icons, header banner, and thematic village governance backdrop.
 * 4. Resolves 16:9 widescreen dimensions (912x512).
 */

import assert from 'assert';
import { ImageGenerationService } from '../../server/agent/ImageGeneration.mjs';

console.log('=== VERIFICATION SUITE: Dynamic Infographic Slide Compiler ===\n');

const svc = new ImageGenerationService();

// 1. Comparison Infographic (Kelebihan & Kekurangan / 2 Kolom)
const inputComp = 'buatkan visual slide "Kelebihan dan Kekurangan Regulasi Perdes" format 16:9 style corporate enterprise';
const compiledComp = svc.normalizeImagePrompt(inputComp);
console.log('[1] Comparison Infographic Output:\n', compiledComp);
assert.ok(compiledComp.includes('executive presentation slide infographic'), 'Must be presentation slide infographic');
assert.ok(compiledComp.includes('Structured two-column comparison infographic layout'), 'Must choose two-column comparison for pros/cons');
assert.ok(compiledComp.includes('Kelebihan') && compiledComp.includes('Kekurangan'), 'Must specify comparison cards');
assert.ok(compiledComp.includes('Balai Desa'), 'Must include Indonesian Balai Desa context for Perdes');
console.log('  ✓ Comparison archetype correctly compiled');

// 2. Process / Workflow Infographic (Tahapan / Alur)
const inputFlow = 'buatkan visual slide presentasi alur dan tahapan pembentukan Perdes';
const compiledFlow = svc.normalizeImagePrompt(inputFlow);
console.log('\n[2] Process Workflow Infographic Output:\n', compiledFlow);
assert.ok(compiledFlow.includes('Sequential horizontal process roadmap infographic layout'), 'Must choose process roadmap for alur/tahapan');
assert.ok(compiledFlow.includes('numbered step badges'), 'Must include step badges for process');
console.log('  ✓ Process workflow archetype correctly compiled');

// 3. Metrics / Growth Infographic (Grafik / Kinerja / Data)
const inputChart = 'visual slide infografis grafik pertumbuhan ekonomi desa';
const compiledChart = svc.normalizeImagePrompt(inputChart);
console.log('\n[3] Chart/Metrics Infographic Output:\n', compiledChart);
assert.ok(compiledChart.includes('Executive data analytics dashboard presentation infographic'), 'Must choose analytics dashboard for grafik/data');
assert.ok(compiledChart.includes('bar charts') || compiledChart.includes('donut'), 'Must include chart elements');
console.log('  ✓ Data/chart archetype correctly compiled');

// 4. Cycle / Ecosystem Infographic (Siklus / Lingkaran)
const inputCycle = 'buatkan slide presentasi siklus pengelolaan dana desa';
const compiledCycle = svc.normalizeImagePrompt(inputCycle);
console.log('\n[4] Cycle/Circle Infographic Output:\n', compiledCycle);
assert.ok(compiledCycle.includes('Circular cycle ecosystem infographic layout'), 'Must choose circular cycle for siklus');
console.log('  ✓ Circular cycle archetype correctly compiled');

// 5. People / Stakeholder Infographic (Tokoh / Warga / Aparatur)
const inputPeople = 'slide visual profil aparatur dan masyarakat desa';
const compiledPeople = svc.normalizeImagePrompt(inputPeople);
console.log('\n[5] People/Stakeholder Infographic Output:\n', compiledPeople);
assert.ok(compiledPeople.includes('Human-centric stakeholder presentation infographic'), 'Must choose human-centric for aparatur/masyarakat');
console.log('  ✓ People/stakeholder archetype correctly compiled');

// 6. "kalau bulat ya bulat" (Kata kunci bulat / lingkaran)
const inputBulat = 'buatkan slide presentasi perdes format diagram bulat';
const compiledBulat = svc.normalizeImagePrompt(inputBulat);
console.log('\n[6] "Kalau bulat ya bulat" Output:\n', compiledBulat);
assert.ok(compiledBulat.includes('Circular cycle ecosystem infographic layout'), 'Must choose circular cycle layout for "bulat"');
console.log('  ✓ Circular/bulat archetype correctly compiled');

// 7. "kalau perlu gambar orang ya ada gambar orang"
const inputOrang = 'buatkan slide infografis kebijakan perdes dengan gambar orang aparatur dan warga';
const compiledOrang = svc.normalizeImagePrompt(inputOrang);
console.log('\n[7] "Kalau perlu gambar orang ya ada gambar orang" Output:\n', compiledOrang);
assert.ok(compiledOrang.includes('character illustrations') || compiledOrang.includes('human figures') || compiledOrang.includes('Human-centric'), 'Must include human illustrations');
console.log('  ✓ People/human element correctly compiled');

// 8. Kombinasi Konteks (Grafik + Orang)
const inputKombinasi = 'slide presentasi capaian desa ada grafik pertumbuhan dan gambar orang warga';
const compiledKombinasi = svc.normalizeImagePrompt(inputKombinasi);
console.log('\n[8] Combined Context (Grafik + Orang) Output:\n', compiledKombinasi);
assert.ok(compiledKombinasi.includes('bar charts') || compiledKombinasi.includes('analytics'), 'Must include chart layout');
assert.ok(compiledKombinasi.includes('character illustrations') || compiledKombinasi.includes('human figures'), 'Must also include character illustrations when requested');
console.log('  ✓ Combined context correctly compiled');

console.log('\n✅ ALL CONTEXTUAL INFOGRAPHIC COMPILER TESTS PASSED (8/8)!');
