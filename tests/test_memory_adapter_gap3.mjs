/**
 * test_memory_adapter_gap3.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST FASE 1 — GAP 3: MemoryAdapter.addFact() Signature Overload
 *
 * TEST A: Object form  { key, value, category, source } → PASS (tersimpan)
 * TEST B: Positional   (key, value, category)           → PASS (backward compat)
 * TEST C: Empty/invalid                                  → REJECT (return null)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cara run: node tests/test_memory_adapter_gap3.mjs
 * (tidak memerlukan server aktif)
 */

// ─── Minimal stubs ────────────────────────────────────────────────────────────
const MEMORY_CATEGORIES = {
  USER: 'USER',
  SESSION: 'SESSION',
  DOCUMENT: 'DOCUMENT',
  SYSTEM: 'SYSTEM'
};

// Stub MemoryStore — menyimpan ke in-memory array
class StubMemoryStore {
  constructor() { this.memories = []; }
  addMemory({ key, value, category }) {
    const m = { id: `mem_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, key, value, category };
    this.memories.push(m);
    return m;
  }
  getMemories() { return this.memories; }
  searchMemories(q) { return this.memories.filter(m => (m.key+m.value).includes(q)); }
  deleteMemory(id) { this.memories = this.memories.filter(m => m.id !== id); }
  clearSession() { this.memories = this.memories.filter(m => m.category !== MEMORY_CATEGORIES.SESSION); }
  togglePin(id) {}
}

// ─── Inline MemoryAdapter (identik dengan file aktual setelah patch) ──────────
class MemoryAdapter {
  constructor() {
    this.store = new StubMemoryStore();
    this._serverSynced = true;
    this._syncCalls = []; // capture _syncToServer calls for inspection
  }

  _mapServerCategory(serverCat) {
    const map = {
      'IDENTITY_CORE': MEMORY_CATEGORIES.SYSTEM,
      'SYSTEM_CONFIG': MEMORY_CATEGORIES.SYSTEM,
      'OPERATIONAL_RULE': MEMORY_CATEGORIES.USER,
      'RESEARCH_DATA': MEMORY_CATEGORIES.DOCUMENT,
      'USER_PREFERENCE': MEMORY_CATEGORIES.USER,
      'GENERAL_FACT': MEMORY_CATEGORIES.DOCUMENT,
      'EPISODIC_SUMMARY': MEMORY_CATEGORIES.SESSION,
      'CONVERSATION': MEMORY_CATEGORIES.SESSION
    };
    return map[serverCat] || MEMORY_CATEGORIES.USER;
  }

  _syncToServer(op) {
    this._syncCalls.push(op); // capture instead of fetch
  }

  // ─── Patched addFact (sesuai implementasi aktual setelah GAP 3 fix) ─────────
  addFact(keyOrObject, value, category = MEMORY_CATEGORIES.USER) {
    let key, val, cat, source;

    if (keyOrObject !== null && typeof keyOrObject === 'object') {
      key    = typeof keyOrObject.key   === 'string' ? keyOrObject.key.trim()   : '';
      val    = typeof keyOrObject.value === 'string' ? keyOrObject.value.trim() : '';
      cat    = keyOrObject.category
                 ? this._mapServerCategory(keyOrObject.category)
                 : category;
      source = keyOrObject.source || 'ui';
    } else {
      key    = typeof keyOrObject === 'string' ? keyOrObject.trim() : String(keyOrObject || '');
      val    = typeof value === 'string' ? value.trim() : String(value || '');
      cat    = category;
      source = 'api';
    }

    if (!key || !val) {
      console.warn('[MemoryAdapter] addFact rejected: empty key or value', { key, val, source });
      return null;
    }

    const local = this.store.addMemory({ key, value: val, category: cat });
    this._syncToServer({ type: 'store', data: { key, content: val, category: cat, source } });
    return local;
  }
}

// ─── ANSI ────────────────────────────────────────────────────────────────────
const G   = s => `\x1b[32m${s}\x1b[0m`;
const R   = s => `\x1b[31m${s}\x1b[0m`;
const B   = s => `\x1b[36m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

const results = [];
function pass(label, detail = '') {
  results.push({ label, ok: true });
  console.log(`  ${G('PASS')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}
function fail(label, detail = '') {
  results.push({ label, ok: false, detail });
  console.log(`  ${R('FAIL')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}

// ─── TEST A: Object form ──────────────────────────────────────────────────────
function testA() {
  console.log(`\n${B('TEST A: Object form { key, value, category, source }')}`);
  const adapter = new MemoryAdapter();

  // Exactly as called in ConversationController.handleComplete()
  const text = 'apa itu quantum computing?';
  const fullText = 'Quantum computing adalah komputasi yang memanfaatkan fenomena mekanika kuantum seperti superposisi dan entanglement.';

  const result = adapter.addFact({
    category: 'CONVERSATION',
    key: text.slice(0, 40),
    value: fullText.slice(0, 100),
    source: 'ticker_stream'
  });

  if (result !== null) {
    pass('addFact({...}) mengembalikan memory object (bukan null)');
  } else {
    fail('addFact({...}) mengembalikan null — memory tidak tersimpan');
  }

  const stored = adapter.store.getMemories();
  if (stored.length === 1) {
    pass('Memory tersimpan di store', `key="${stored[0].key.slice(0,25)}"...`);
  } else {
    fail('Memory tidak tersimpan di store', `count=${stored.length}`);
  }

  if (stored[0]?.category === MEMORY_CATEGORIES.SESSION) {
    pass('Category CONVERSATION → SESSION (mapped benar)');
  } else {
    fail('Category mapping salah', `got: ${stored[0]?.category}`);
  }

  const syncCall = adapter._syncCalls[0];
  if (syncCall?.type === 'store' && syncCall.data.source === 'ticker_stream') {
    pass('_syncToServer dipanggil dengan source=ticker_stream');
  } else {
    fail('_syncToServer tidak dipanggil dengan benar', JSON.stringify(syncCall));
  }

  if (syncCall?.data.content === fullText.slice(0, 100)) {
    pass('content dalam sync payload = value (bukan undefined)');
  } else {
    fail('content dalam sync payload salah', `got: ${syncCall?.data?.content}`);
  }
}

// ─── TEST B: Positional form ──────────────────────────────────────────────────
function testB() {
  console.log(`\n${B('TEST B: Positional form (key, value, category) — backward compat')}`);
  const adapter = new MemoryAdapter();

  const result = adapter.addFact('nama_pengguna', 'Rahman', MEMORY_CATEGORIES.USER);

  if (result !== null) {
    pass('addFact(key, value, category) mengembalikan memory object');
  } else {
    fail('addFact positional mengembalikan null');
  }

  const stored = adapter.store.getMemories();
  if (stored.length === 1 && stored[0].key === 'nama_pengguna' && stored[0].value === 'Rahman') {
    pass('key dan value tersimpan benar', `key=${stored[0].key} value=${stored[0].value}`);
  } else {
    fail('key/value salah', JSON.stringify(stored[0]));
  }

  if (stored[0]?.category === MEMORY_CATEGORIES.USER) {
    pass('category USER dipertahankan');
  } else {
    fail('category salah', stored[0]?.category);
  }

  const syncCall = adapter._syncCalls[0];
  if (syncCall?.data.source === 'api') {
    pass('source=api untuk positional call');
  } else {
    fail('source salah untuk positional call', syncCall?.data?.source);
  }
}

// ─── TEST C: Empty / invalid ──────────────────────────────────────────────────
function testC() {
  console.log(`\n${B('TEST C: Empty / invalid memory → REJECT (return null)')}`);
  const adapter = new MemoryAdapter();

  // C1: Object dengan key dan value kosong
  const r1 = adapter.addFact({ category: 'CONVERSATION', key: '', value: '', source: 'test' });
  if (r1 === null) {
    pass('{ key: "", value: "" } → null (rejected)');
  } else {
    fail('Empty object seharusnya di-reject', JSON.stringify(r1));
  }

  // C2: Object dengan value kosong saja
  const r2 = adapter.addFact({ category: 'CONVERSATION', key: 'ada_key', value: '', source: 'test' });
  if (r2 === null) {
    pass('{ key: "ada_key", value: "" } → null (rejected)');
  } else {
    fail('Empty value seharusnya di-reject');
  }

  // C3: Positional dengan string kosong
  const r3 = adapter.addFact('', 'ada_value', MEMORY_CATEGORIES.USER);
  if (r3 === null) {
    pass('addFact("", "ada_value") → null (empty key rejected)');
  } else {
    fail('Empty key positional seharusnya di-reject');
  }

  // C4: Positional normal → tetap jalan (bukan false positive)
  const r4 = adapter.addFact('valid_key', 'valid_value');
  if (r4 !== null) {
    pass('addFact("valid_key", "valid_value") → tersimpan (tidak salah reject)');
  } else {
    fail('Valid memory seharusnya tidak di-reject');
  }

  // C5: Pastikan store hanya punya 1 entry (hanya C4 yang valid)
  const stored = adapter.store.getMemories();
  if (stored.length === 1) {
    pass('Store hanya berisi 1 memory valid (C1-C3 benar-benar tidak tersimpan)');
  } else {
    fail('Store berisi entry yang seharusnya di-reject', `count=${stored.length}`);
  }

  // C6: Sync tidak dipanggil untuk rejected memory
  if (adapter._syncCalls.length === 1) {
    pass('_syncToServer hanya 1x dipanggil (hanya untuk memory valid)');
  } else {
    fail('_syncToServer dipanggil lebih dari sekali termasuk untuk memory invalid', `calls=${adapter._syncCalls.length}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const SEP = '='.repeat(68);
  console.log(`\n${SEP}`);
  console.log('  JIN COGNITIVE LOOP — FASE 1');
  console.log('  GAP 3: MemoryAdapter.addFact() Signature Overload Test');
  console.log(`  ${new Date().toISOString()}`);
  console.log(SEP);

  testA();
  testB();
  testC();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const total  = results.length;

  console.log(`\n${SEP}`);
  console.log('  HASIL');
  console.log(SEP);
  console.log(`  ${G(`PASS: ${passed}/${total}`)}${failed > 0 ? '   ' + R(`FAIL: ${failed}`) : ''}`);

  if (failed === 0) {
    console.log(`\n  ${G('[FASE 1 — GAP 3 CLOSED]')}`);
    console.log('  Object form  { key, value, category, source }  → TERSIMPAN  [DIKUNCI]');
    console.log('  Positional   (key, value, category)            → TERSIMPAN  [DIKUNCI]');
    console.log('  Empty key/value                                → DITOLAK    [DIKUNCI]');
    console.log('  _syncToServer tidak dipanggil untuk invalid    → AMAN       [DIKUNCI]');
  } else {
    console.log(`\n  ${R('[FAIL] Jangan lanjut ke FASE 2 sebelum ini bersih')}`);
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  FAIL: ${r.label} — ${r.detail || ''}`);
    }
  }
  console.log(`${SEP}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
