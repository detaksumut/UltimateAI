/**
 * DomainIsolationTest.mjs — FASE 0
 * Satu JIN utuh, domain berdiri sendiri: doc.read tidak dicampuri image/music/web.
 */
import assert from 'assert';
import fs from 'fs';

const parserSrc = fs.readFileSync('server/tools/DocumentParser.mjs', 'utf8');
assert(!/ImageGeneration|QwenVisualPlanner|MusicPlayer|WebSearch/i.test(parserSrc),
  'DocumentParser tercemar import domain lain');
console.log('OK: DocumentParser mandiri (doc.read)');

const { parseDocument } = await import('../../server/tools/DocumentParser.mjs');
const okRes = await parseDocument(
  Buffer.from('Peraturan RKP test: pasal 1 mengatur perencanaan. Cukup panjang agar lolos threshold lima puluh karakter minimum.', 'utf-8'),
  'rkp.txt', 'text/plain'
);
assert.strictEqual(okRes.status, 'OK', 'teks valid harus OK');
const emptyRes = await parseDocument(Buffer.alloc(0), 'x.pdf', 'application/pdf');
assert.strictEqual(emptyRes.status, 'EMPTY', 'buffer kosong harus EMPTY');
// PDF biner rusak -> FAILED yang jujur (bukan '' diam)
const badRes = await parseDocument(Buffer.from('%PDF-1.4 rusak', 'utf-8'), 'scan.pdf', 'application/pdf');
assert(['NEED_OCR', 'FAILED'].includes(badRes.status), 'PDF rusak harus NEED_OCR/FAILED');
assert(badRes.error, 'harus ada alasan eksplisit');
console.log('OK: kontrak doc.read jujur:', okRes.status, '/', emptyRes.status, '/', badRes.status);

// False-OK: penanda halaman "-- N of M --" bukan teks (kasus PDF scan nyata:
// PSN_Perpres RKP.pdf = 47 halaman, 833 char marker, nol isi -> dulu OK palsu).
assert(parserSrc.includes('contentChars'), 'parseDocument wajib buang penanda halaman sebelum menilai OK');
// Dead-code NUL check kini hidup: biner -> NEED_OCR, bukan OK. Sentinel DI:
// provider OCR TIDAK BOLEH dipanggil untuk biner non-PDF (deterministik, tanpa
// jaringan) — jika boundary regresi, sentinel "OK"-nya langsung membongkar false-OK.
const sentinelOcr = async () => ({ status: 'OK', text: 'karangan provider yang tidak boleh diterima', meta: {}, error: null });
const binTextRes = await parseDocument(
  Buffer.from([0x61, 0x62, 0x63, 0x00, 0x64, 0x65, 0x66]),
  'bin.txt', 'text/plain',
  { ocrFromBuffer: sentinelOcr, renderPages: sentinelOcr, ocrPages: sentinelOcr }
);
assert.strictEqual(binTextRes.status, 'NEED_OCR', 'berkas biner (NUL) harus NEED_OCR, bukan OK');
assert.strictEqual(binTextRes.meta?.source, 'binary-reject', 'biner non-PDF harus ditolak di boundary, bukan lewat provider OCR');
console.log('OK: anti false-OK (marker scan + biner NUL)');

const { DOMAIN_STATUS, assertDomainResult } = await import('../../server/agent/contracts/DomainContract.mjs');
assertDomainResult({ status: DOMAIN_STATUS.OK, data: {} }, 'doc.read');
console.log('OK: DomainContract valid');

const ccSrc = fs.readFileSync('src/services/conversation/ConversationController.js', 'utf8');
assert(ccSrc.includes('STATUS DOKUMEN'), 'ConversationController harus meneruskan status jujur NEED_OCR');
console.log('OK: ConversationController anti-halusinasi');

const routerSrc = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
assert(routerSrc.includes('perception-honest'), 'DOCUMENT_PIPELINE harus punya jalur jujur NEED_OCR');
console.log('OK: LocalRouterServer DOCUMENT_PIPELINE mandiri');

// FASE 3 — Kontinuitas lampiran lintas giliran (anti "baca tapi buta")
assert(ccSrc.includes('.docContexts = docContexts'), 'teks dokumen wajib disimpan ke riwayat pesan');
assert(ccSrc.includes('diekstrak ulang otomatis dari lampiran giliran sebelumnya'),
  'giliran lanjutan tanpa lampiran wajib re-inject konteks dokumen');
assert(ccSrc.includes('endpoint /api/files/parse tidak merespons'),
  'parse gagal/sunyi wajib jatuh ke status FAILED jujur (bukan diam tanpa konten)');
assert(ccSrc.includes('currentTurnDocContexts'), 'guard harvest tidak boleh terpicu oleh konteks riwayat');
assert(routerSrc.includes('kesimpul\\w*'), 'gerbang intent harus mengenali "buat kesimpulannya"');
assert(routerSrc.includes('--- [Konteks Dokumen'), 'gerbang intent harus mengenali marker konteks dokumen');
console.log('OK: kontinuitas lampiran lintas giliran + gerbang intent');
console.log('FASE 0+1+3 PASS');
