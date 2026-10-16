/**
 * YouTubeSongSearchGateTest.mjs
 * Gerbang kebenaran judul lagu (anti-nyasar anti "karya salah").
 *
 * Jaminan:
 *  - extractSongQuery membersihkan prompt "judulnya X" jadi X.
 *  - titleGate loloskan judul relevan, tolak judul nyasar (kasus asli:
 *    query "NIKITA Elton John" tak boleh loloskan video "Kim Wilde & 80s";
 *    query "Hau Lai" tak boleh pasangkan judul ke videoId drama).
 *  - Guards discovery (scrape) memakai titleGate sehingga kandidat
 *    tak relevan gugur SEBELUM verifikasi.
 *
 * Run: node tests/youtube/YouTubeSongSearchGateTest.mjs
 */
import assert from 'assert';
import fs from 'fs';

import {
  extractSongQuery,
  expandDiscoveryQueries,
  titleGate,
  verifyCandidate,
  pickVerified,
  YT_SONG_STATUS
} from '../../server/tools/YouTubeSongSearch.mjs';

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
console.log('  TEST: YouTubeSongSearchGateTest — anti-nyasar & anti karya salah');
console.log('═══════════════════════════════════════════════════════════════════════\n');

console.log('[1] Query extraction');
check('prompt "judulnya NIKITA Elton John" -> "NIKITA Elton John"', () => {
  assert.strictEqual(extractSongQuery('carikan lagu di youteube judulnya NIKITA Elton John'), 'NIKITA Elton John');
});
check('expandDiscoveryQueries memuat varian "lagu X" dan "X official"', () => {
  const q = expandDiscoveryQueries('NIKITA Elton John');
  assert.ok(q.some(x => x.startsWith('lagu ')));
  assert.ok(q.some(x => x.endsWith('official')));
});

console.log('\n[2] titleGate — kasus nyata (Nikita) & kasus regresi (Hau Lai)');
check('judul benar lolos STRONG', () => {
  assert.strictEqual(titleGate('NIKITA Elton John', 'Elton John - Nikita'), 'STRONG');
});
check('judul ARTIS/LAGU LAIN ditolak (Kim Wilde tidak lolos query Nikita)', () => {
  assert.strictEqual(titleGate('NIKITA Elton John', 'Kim Wilde - Cambodia (1982)'), 'NO_MATCH');
});
check('query "Hau Lai" tidak loloskan judul video drama (regresi Tl-mneAoSV0)', () => {
  assert.strictEqual(titleGate('Hau Lai', 'Tl-mneAoSV0 random drama'), 'NO_MATCH');
});
check('verifyCandidate menolak kandidat nyasar tapi menerima kandidat benar', () => {
  const wrong = verifyCandidate('NIKITA Elton John',
    { videoId: 'AAAAAAAAAAA', title: 'Kim Wilde - Cambodia', channel: 'SomeChannel', source: 'test' }
  );
  // Kontrol: satu kandidat gagal 1 gate = REJECT (fail-closed, tanpa fallback).
  assert.strictEqual(wrong.status, 'REJECT');
  assert.strictEqual(wrong.reason, 'TITLE_MISMATCH');
  const right = pickVerified(['NIKITA Elton John'], [
    { videoId: 'BBBBBBBBBBB', title: 'Kim Wilde - Cambodia', channel: 'x', source: 'test' },
    { videoId: 'Tg-Q-Acv4qs', title: 'Elton John - Nikita', channel: 'EltonJohnVEVO', source: 'test' }
  ]);
  assert.strictEqual(right.status, YT_SONG_STATUS.VERIFIED);
  assert.strictEqual(right.candidate.videoId, 'Tg-Q-Acv4qs');
});

console.log('\n[3] Guards discovery terpasang di source (anti-nyasar tetap hidup)');
const src = fs.readFileSync('server/tools/YouTubeSongSearch.mjs', 'utf8');
check('scrape_json memakai titleGate sebelum push kandidat', () => {
  assert.ok(src.includes("titleGate(query, title) !== 'NO_MATCH'"), 'guard scrape_json hilang');
});
check('fallback regex memakai titleGate sebelum push kandidat', () => {
  assert.ok(src.includes("if (titleGate(query, title) === 'NO_MATCH') return;"), 'guard scrape_regex hilang');
});
check('LocalRouter memverifikasi channel sebelum klaim "karya ..."', () => {
  const routerSrc = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
  assert.ok(routerSrc.includes('channelTrusted'), 'klaim karya channel tanpa gate');
});

console.log(`\n  RESULT: ${passed}/${passed + failed} Tests Passed.\n`);
if (failed > 0) process.exit(1);
