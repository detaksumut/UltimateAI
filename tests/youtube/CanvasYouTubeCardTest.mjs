/**
 * CanvasYouTubeCardTest.mjs
 * Verifikasi deteksi video YouTube + pembersihan iframe mentah di CanvasCardRenderer.
 *
 * Masalah asli: <iframe> yang disuntik via dangerouslySetInnerHTML TIDAK memuat
 * kontennya (spesifikasi browser) → area hitam di Canvas, meski audio TTS nyala.
 * Solusi: deteksi videoId → buang <iframe> dari HTML → render via YouTubeNativeEmbed.
 *
 * Run: node tests/youtube/CanvasYouTubeCardTest.mjs
 */
import assert from 'assert';

import {
  extractYouTubeVideoId,
  sanitizeYouTubeHtml
} from '../../src/utils/youtubeCardHelpers.mjs';

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ [FAIL] ${name} — ${err.message}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: CanvasYouTubeCardTest — deteksi video + sanitasi iframe');
console.log('═══════════════════════════════════════════════════════════════════════\n');

console.log('[1] extractYouTubeVideoId');
check('https://www.youtube.com/embed/Tg-Q-Acv4qs', () => {
  assert.strictEqual(extractYouTubeVideoId('https://www.youtube.com/embed/Tg-Q-Acv4qs'), 'Tg-Q-Acv4qs');
});
check('https://www.youtube.com/watch?v=Tg-Q-Acv4qs', () => {
  assert.strictEqual(extractYouTubeVideoId('https://www.youtube.com/watch?v=Tg-Q-Acv4qs'), 'Tg-Q-Acv4qs');
});
check('https://youtu.be/Tg-Q-Acv4qs', () => {
  assert.strictEqual(extractYouTubeVideoId('https://youtu.be/Tg-Q-Acv4qs'), 'Tg-Q-Acv4qs');
});
check('HTML berisi embed iframe', () => {
  const html = '<div>Lagu Nikita</div><iframe src="https://www.youtube.com/embed/Tg-Q-Acv4qs?autoplay=1"></iframe>';
  assert.strictEqual(extractYouTubeVideoId(html), 'Tg-Q-Acv4qs');
});
check('bukan YouTube → null', () => {
  assert.strictEqual(extractYouTubeVideoId('https://example.com/video.mp4'), null);
  assert.strictEqual(extractYouTubeVideoId(''), null);
});

console.log('\n[2] sanitizeYouTubeHtml');
check('iframe YouTube dibuang', () => {
  const html = '<p>Lagu Nikita</p><iframe src="https://www.youtube.com/embed/Tg-Q-Acv4qs?autoplay=1"></iframe>';
  const out = sanitizeYouTubeHtml(html);
  assert.ok(!/<iframe/i.test(out), 'tag <iframe> masih ada setelah sanitasi');
  assert.ok(out.includes('Lagu Nikita'), 'konten teks hilang');
});
check('semua iframe dibuang (bukan hanya YouTube — innerHTML tidak memuat iframe apa pun)', () => {
  const html = '<p>Dokumen biasa</p><iframe src="https://example.com/widget"></iframe>';
  const out = sanitizeYouTubeHtml(html);
  assert.ok(!/<iframe/i.test(out), 'semua <iframe> harus dihapus dari innerHTML');
  assert.ok(out.includes('Dokumen biasa'), 'konten teks tetap ada');
});
check('string kosong aman', () => {
  assert.strictEqual(sanitizeYouTubeHtml(''), '');
  assert.strictEqual(sanitizeYouTubeHtml(null), '');
});

console.log('\n[3] Skema gabungan (CanvasCardRenderer logic)');
const simulateCanvasCard = (htmlContent) => {
  const ytVideoId = extractYouTubeVideoId(htmlContent);
  const sanitizedHtml = ytVideoId ? sanitizeYouTubeHtml(htmlContent) : htmlContent;
  const canvasLabel = ytVideoId ? 'JIN CANVAS // YOUTUBE PLAYER' : 'JIN CONVERSATION CANVAS // LIVE FLYER';
  return { ytVideoId, sanitizedHtml, canvasLabel };
};

check('kartu YouTube → label YouTube PLAYER + iframe dibuang', () => {
  const html = '<p>Lagu Nikita dari YouTube</p><iframe src="https://www.youtube.com/embed/Tg-Q-Acv4qs?autoplay=1"></iframe>';
  const r = simulateCanvasCard(html);
  assert.strictEqual(r.canvasLabel, 'JIN CANVAS // YOUTUBE PLAYER');
  assert.strictEqual(r.ytVideoId, 'Tg-Q-Acv4qs');
  assert.ok(!/<iframe/i.test(r.sanitizedHtml), 'iframe mentah masih akan disuntik (area hitam)');
});

check('kartu bukan YouTube → label LIVE FLYER + HTML utuh', () => {
  const html = '<p>Rangkuman dokumen hukum</p>';
  const r = simulateCanvasCard(html);
  assert.strictEqual(r.canvasLabel, 'JIN CONVERSATION CANVAS // LIVE FLYER');
  assert.strictEqual(r.sanitizedHtml, html);
});

console.log(`\n  RESULT: ${passed}/${passed + failed} Tests Passed.\n`);
if (failed > 0) process.exit(1);
