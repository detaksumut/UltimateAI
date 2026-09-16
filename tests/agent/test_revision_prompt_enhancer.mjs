import assert from 'assert';
import { RevisionPromptEnhancer } from '../../server/agent/RevisionPromptEnhancer.mjs';

console.log('=== REGRESSION TEST SUITE: RevisionPromptEnhancer (4-Pillar Ideal Formula) ===\n');

// 1. Subject detection & extraction
console.log('[1] Subject detection & phrase extraction:');
assert.strictEqual(RevisionPromptEnhancer.detectSubject('Gambar pesawat tempur di udara melintasi gunung'), 'fighter jet aircraft');
assert.strictEqual(RevisionPromptEnhancer.detectSubject('Foto mobil sport merah di jalan raya'), 'sports car');
assert.strictEqual(RevisionPromptEnhancer.detectSubject('Cityscape pemandangan gedung jakarta'), 'cityscape skyline');
assert.strictEqual(RevisionPromptEnhancer.detectSubject('Pemandangan gunung di pagi hari'), 'mountain');
assert.strictEqual(RevisionPromptEnhancer.detectSubject('Potret seorang wanita tersenyum'), 'woman');
assert.strictEqual(RevisionPromptEnhancer.extractSubjectPhrase('sebuah pesawat terbang melintasi gunung'), 'commercial airliner airplane flying across mountains');
assert.strictEqual(RevisionPromptEnhancer.extractSubjectPhrase('mobil sport melaju'), 'sports car on road');
console.log('  ✓ Subject detection correctly categorizes domains');

// 2. Sunset enhancement (Weighted Tags + Subject Lock + Negative Blue Suppression)
console.log('\n[2] Sunset atmosphere enhancement:');
const sunset = RevisionPromptEnhancer.enhance({
  modification: 'sunset atmosphere',
  originalPrompt: 'sebuah pesawat terbang melintasi langit biru siang hari',
  subject: 'commercial airliner airplane'
});
console.log('  Positive prompt:', sunset.positivePrompt);
console.log('  Negative prompt:', sunset.negativePrompt);

assert(sunset.positivePrompt.includes('((vibrant rich orange sunset sky'));
assert(sunset.positivePrompt.includes(':1.45'));
assert(sunset.positivePrompt.includes('((intact commercial airliner airplane:1.25))'));
assert(sunset.positivePrompt.includes('warm golden-hour rim lighting'));
assert(sunset.negativePrompt.includes('clear blue sky, bright daylight, blue color, midday sun'));
assert(sunset.negativePrompt.includes(':1.4'));
assert.strictEqual(sunset.normalizedModificationKey, 'sunset');
console.log('  ✓ Sunset conditioning strictly matches 4-pillar weighted specification');

// 3. Nighttime enhancement
console.log('\n[3] Nighttime enhancement:');
const night = RevisionPromptEnhancer.enhance({
  modification: 'suasana malam hari yang gelap',
  originalPrompt: 'pemandangan pesawat di angkasa',
  subject: 'commercial airliner airplane'
});
assert(night.positivePrompt.includes('((deep dark nocturnal night sky'));
assert(night.positivePrompt.includes(':1.45'));
assert(night.positivePrompt.includes('((intact commercial airliner airplane:1.25))'));
assert(night.negativePrompt.includes('bright daylight, midday lighting, sunny sky'));
assert(night.negativePrompt.includes(':1.4'));
assert.strictEqual(night.normalizedModificationKey, 'nighttime');
console.log('  ✓ Nighttime conditioning suppresses daytime blue sky and locks subject');

// 4. Rainy enhancement
console.log('\n[4] Rainy enhancement:');
const rainy = RevisionPromptEnhancer.enhance({
  modification: 'hujan deras dan badai',
  originalPrompt: 'pesawat terbang',
  subject: 'commercial airliner airplane'
});
assert(rainy.positivePrompt.includes('((heavy rainstorm'));
assert(rainy.positivePrompt.includes(':1.45'));
assert(rainy.positivePrompt.includes('((intact commercial airliner airplane:1.25))'));
assert(rainy.negativePrompt.includes('dry sunny day, clear blue sky'));
assert(rainy.negativePrompt.includes(':1.4'));
assert.strictEqual(rainy.normalizedModificationKey, 'rainy');
console.log('  ✓ Rainy conditioning properly constructed with wet reflections & dry suppression');

// 5. Golden hour enhancement
console.log('\n[5] Golden hour enhancement:');
const golden = RevisionPromptEnhancer.enhance({
  modification: 'golden hour lighting',
  originalPrompt: 'pesawat komersial mendarat di bandara',
  subject: 'commercial airliner airplane'
});
assert(golden.positivePrompt.includes('((rich golden hour sky'));
assert(golden.positivePrompt.includes(':1.45'));
assert(golden.positivePrompt.includes('((intact commercial airliner airplane:1.25))'));
assert(golden.negativePrompt.includes('harsh midday sun, cool blue sky'));
assert(golden.negativePrompt.includes(':1.4'));
assert.strictEqual(golden.normalizedModificationKey, 'golden_hour');
console.log('  ✓ Golden hour conditioning properly constructed');

// 6. Foggy enhancement
console.log('\n[6] Foggy enhancement:');
const foggy = RevisionPromptEnhancer.enhance({
  modification: 'berkabut tebal',
  originalPrompt: 'danau dengan pesawat terbang',
  subject: 'commercial airliner airplane'
});
assert(foggy.positivePrompt.includes('((dense volumetric fog'));
assert(foggy.positivePrompt.includes(':1.45'));
assert(foggy.positivePrompt.includes('((intact commercial airliner airplane:1.25))'));
assert(foggy.negativePrompt.includes('ultra clear visibility'));
assert(foggy.negativePrompt.includes(':1.4'));
assert.strictEqual(foggy.normalizedModificationKey, 'foggy');
console.log('  ✓ Foggy conditioning properly constructed with mist envelopment & clear sky suppression');

console.log('\n✅ ALL 6 RevisionPromptEnhancer REGRESSION TESTS PASS (6/6)');
