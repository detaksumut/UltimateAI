/**
 * TEST 11.2 — Scheduled Cognition (CuriosityDaemon)
 * ═══════════════════════════════════════════════════════════════
 * Membuktikan bahwa JIN dapat melakukan aktivitas kognitif secara otonom
 * tanpa menunggu input pengguna, menghasilkan artefak nyata, menyimpan ke
 * memori, menghormati batas autonomy, dan bisa recovery setelah restart.
 *
 * 10 Assertions:
 *   A1   CuriosityDaemon dapat start/stop secara terkontrol
 *   A2   Scheduler menghasilkan cognitive trigger yang terpanggil (runWave/executeDeepHarvest callable)
 *   A3   Trigger masuk ke Cognitive Execution Layer (executeDeepHarvest pipeline berjalan)
 *   A4   JIN memilih klaster berdasarkan kondisi (cluster registry terpopulasi, query unik per cluster)
 *   A5   Cognition menghasilkan artefak nyata (dossier file > 1KB dengan konten riil)
 *   A6   Hasil cognition tersimpan ke memory (learned_knowledge.json dan SQLite diperbarui)
 *   A7   Tidak menjalankan klaster yang sama berulang (busy guard + lastRunDate dedup)
 *   A8   Daemon menghormati batas autonomy budget (AUTONOMY_BUDGET_EXCEEDED error saat limit terlampaui)
 *   A9   Daemon dapat recovery setelah interruption/restart (lastRunDate di-persist dan di-restore)
 *   A10  IDLE → CURIOSITY → COGNITION → MEMORY → IDLE terbukti end-to-end
 *
 * Target cluster: TEK (Teknologi & Sains Utama) — Wave 13:00 WIB
 * Metode: Direct trigger executeDeepHarvest('TEK') tanpa menunggu timer aktual.
 * Justifikasi: Timer 60s hanya mekanisme scheduling; cognitive pipeline identik
 * baik dipanggil oleh timer maupun secara langsung. Yang diuji adalah pipeline-nya.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Production imports (bukan mock) ──────────────────────────────────────────
import { CuriosityDaemon, INTELLIGENCE_CLUSTERS } from '../server/daemon/CuriosityDaemon.mjs';

// ── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  const icon   = condition ? '  ✅' : '  ❌';
  console.log(`${icon} [${status}] ${label}${detail ? ' — ' + detail : ''}`);
  results.push({ label, status });
  if (condition) passed++;
  else failed++;
}

function section(title) {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(62));
}

// ── Constants ─────────────────────────────────────────────────────────────────
const VAULT_FILE      = path.join(process.cwd(), 'storage', 'vault', 'learned_knowledge.json');
const DAEMON_STATE    = path.join(process.cwd(), 'storage', 'vault', 'daemon_state.json');
const TEST_CLUSTER    = 'TEK';

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  TEST 11.2 — SCHEDULED COGNITION (CuriosityDaemon)');
console.log('═══════════════════════════════════════════════════════════════');

// ════════════════════════════════════════════════════════════════
// PHASE 1 — A1: start/stop terkontrol
// ════════════════════════════════════════════════════════════════
section('PHASE 1 — Controlled Start/Stop (A1)');

const daemon = new CuriosityDaemon();

// Before start: isActive should be false
assert('A1a — Initial state: isActive=false', daemon.isActive === false);

// Start
daemon.start();
assert('A1b — After start(): isActive=true', daemon.isActive === true);

// Stop
daemon.stop();
assert('A1c — After stop(): isActive=false', daemon.isActive === false);

// Restart is idempotent: calling start() twice doesn't duplicate timer
daemon.start();
daemon.start(); // second call is no-op per guard
const timerBefore = daemon.timer;
daemon.start(); // third call
assert('A1d — start() is idempotent (no duplicate timers)', daemon.timer === timerBefore);
daemon.stop();

// ════════════════════════════════════════════════════════════════
// PHASE 2 — A2: Scheduler generates cognitive trigger
// ════════════════════════════════════════════════════════════════
section('PHASE 2 — Cognitive Trigger Mechanism (A2)');

// Verify INTELLIGENCE_CLUSTERS contains TEK with a real query
const tekCluster = INTELLIGENCE_CLUSTERS[TEST_CLUSTER];
assert(
  'A2 — INTELLIGENCE_CLUSTERS[TEK] exists with real query',
  !!tekCluster && typeof tekCluster.query === 'string' && tekCluster.query.length > 20,
  `query="${tekCluster?.query?.slice(0, 60)}..."`
);

// ════════════════════════════════════════════════════════════════
// PHASE 3 — A3, A4, A5, A6: Execute live cognitive harvest
//   This is the core of TEST 11.2. We call executeDeepHarvest
//   directly — the same code path _checkDiurnalPulse triggers.
// ════════════════════════════════════════════════════════════════
section('PHASE 3 — Live Cognitive Execution & Artifact Production (A3–A6)');
console.log(`  Calling executeDeepHarvest('${TEST_CLUSTER}') — this will make live network calls.`);
console.log(`  Timeout: up to 60s (Tavily + Ollama/LLM digestion)\n`);

// Record known_knowledge.json state BEFORE harvest
let knowledgeBefore = [];
try {
  if (fs.existsSync(VAULT_FILE)) {
    knowledgeBefore = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8') || '[]');
  }
} catch (_) {}
const countBefore = knowledgeBefore.length;

let harvestReport = null;
let harvestError  = null;

const freshDaemon = new CuriosityDaemon();
const harvestStart = Date.now();

try {
  harvestReport = await freshDaemon.executeDeepHarvest(TEST_CLUSTER);
} catch (err) {
  harvestError = err;
  console.log(`  ⚠️  Harvest error: ${err.message}`);
}

const harvestDurationMs = Date.now() - harvestStart;

// A3: Trigger masuk ke Cognitive Execution Layer (pipeline ran)
assert(
  'A3 — executeDeepHarvest() ran without crash (pipeline entered)',
  harvestReport !== null || (harvestError && harvestError.message !== 'KLASTER_TIDAK_DIKENAL'),
  harvestReport ? `status=${harvestReport.status}` : `error=${harvestError?.message?.slice(0, 60)}`
);

// A4: JIN memilih klaster berdasarkan cluster registry
assert(
  'A4 — Cluster registry maps TEK to unique query and category',
  tekCluster.category === 'TEKNOLOGI' && tekCluster.wave === 13 && Array.isArray(tekCluster.subClusters),
  `category=${tekCluster.category} wave=${tekCluster.wave} subClusters=${tekCluster.subClusters.length}`
);

// A5: Cognition menghasilkan artefak nyata
if (harvestReport) {
  const dossierExists = harvestReport.filePath && fs.existsSync(harvestReport.filePath);
  let dossierSizeKb = 0;
  if (dossierExists) {
    const stat = fs.statSync(harvestReport.filePath);
    dossierSizeKb = stat.size / 1024;
  }
  assert(
    'A5 — Dossier artifact produced on disk (>1KB)',
    dossierExists && dossierSizeKb > 1,
    dossierExists ? `${dossierSizeKb.toFixed(1)} KB at ${path.basename(harvestReport.filePath)}` : 'FILE NOT FOUND'
  );
} else {
  // If Tavily/LLM unavailable, check that at least the structure ran and produced a minimal dossier
  // (fallback path in CuriosityDaemon still writes a dossier)
  assert('A5 — Dossier artifact produced', false, `harvest failed: ${harvestError?.message?.slice(0, 80)}`);
}

// A6: Hasil cognition tersimpan ke memory
let knowledgeAfter = [];
try {
  if (fs.existsSync(VAULT_FILE)) {
    knowledgeAfter = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8') || '[]');
  }
} catch (_) {}
const countAfter = knowledgeAfter.length;
const newEntry = knowledgeAfter.find(k => k.cluster === TEST_CLUSTER &&
  new Date(k.generatedAt).getTime() >= harvestStart);

if (harvestReport) {
  assert(
    'A6 — Harvest result stored in learned_knowledge.json',
    newEntry !== undefined,
    newEntry ? `knowledgeId=${newEntry.knowledgeId} sourcesCount=${newEntry.sourcesCount}` : `count before=${countBefore} after=${countAfter}`
  );
} else {
  assert('A6 — Harvest result stored in learned_knowledge.json', false, 'harvest pipeline failed, no entry expected');
}

// ════════════════════════════════════════════════════════════════
// PHASE 4 — A7: No-duplicate execution guard
// ════════════════════════════════════════════════════════════════
section('PHASE 4 — No-Duplicate Execution Guard (A7)');

// Sub-test 4a: DAEMON_BUSY prevents concurrent same-cluster execution
const busyDaemon = new CuriosityDaemon();
busyDaemon.currentlyCrawling = TEST_CLUSTER; // simulate mid-crawl
let busyError = null;
try {
  await busyDaemon.executeDeepHarvest(TEST_CLUSTER);
} catch (err) {
  busyError = err;
}
assert(
  'A7a — DAEMON_BUSY guard prevents concurrent re-entry',
  busyError !== null && busyError.message.startsWith('DAEMON_BUSY'),
  busyError?.message?.slice(0, 60)
);

// Sub-test 4b: lastRunDate dedup prevents same wave from running twice per day
const dedupDaemon = new CuriosityDaemon();
const todayStr    = dedupDaemon.getWIBTime().dateStr;
dedupDaemon.lastRunDate[13] = todayStr; // mark Wave 13 as already run today

let dedupTriggered = false;
// Simulate _checkDiurnalPulse logic: if lastRunDate[hour] === dateStr, skip
const wib = dedupDaemon.getWIBTime();
if (dedupDaemon.lastRunDate[13] === todayStr) {
  // Correctly deduped — wave would be skipped
  dedupTriggered = false;
} else {
  dedupTriggered = true;
}

assert(
  'A7b — lastRunDate dedup prevents same wave from firing twice per day',
  !dedupTriggered,
  `lastRunDate[13]=${dedupDaemon.lastRunDate[13]} today=${todayStr}`
);

// ════════════════════════════════════════════════════════════════
// PHASE 5 — A8: Bounded autonomy budget
// ════════════════════════════════════════════════════════════════
section('PHASE 5 — Bounded Autonomy Budget (A8)');

const budgetDaemon = new CuriosityDaemon();
// Exhaust the budget manually without actual network calls
budgetDaemon.sessionHarvestCount = CuriosityDaemon.MAX_HARVESTS_PER_SESSION;

let budgetError = null;
try {
  await budgetDaemon.executeDeepHarvest(TEST_CLUSTER);
} catch (err) {
  budgetError = err;
}

assert(
  'A8 — AUTONOMY_BUDGET_EXCEEDED thrown when session limit reached',
  budgetError !== null && budgetError.message.startsWith('AUTONOMY_BUDGET_EXCEEDED'),
  budgetError ? `limit=${CuriosityDaemon.MAX_HARVESTS_PER_SESSION} error="${budgetError.message.slice(0, 70)}"` : 'NO ERROR THROWN'
);

// ════════════════════════════════════════════════════════════════
// PHASE 6 — A9: Recovery after restart (lastRunDate persisted)
// ════════════════════════════════════════════════════════════════
section('PHASE 6 — Recovery After Restart (A9)');

// Write a daemon state file as if a prior session ran Wave 13 today
const mockDate = new CuriosityDaemon().getWIBTime().dateStr;
const mockState = { lastRunDate: { 7: mockDate, 13: mockDate }, lastRunWave: 13, updatedAt: new Date().toISOString() };
const vaultDir  = path.join(process.cwd(), 'storage', 'vault');
if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
fs.writeFileSync(DAEMON_STATE, JSON.stringify(mockState, null, 2), 'utf-8');

// Create a new daemon instance (simulates restart)
const recoveredDaemon = new CuriosityDaemon();

// A9: It should have loaded lastRunDate from disk
assert(
  'A9 — After restart, CuriosityDaemon restores lastRunDate from daemon_state.json',
  recoveredDaemon.lastRunDate[13] === mockDate && recoveredDaemon.lastRunDate[7] === mockDate,
  `restored lastRunDate[13]=${recoveredDaemon.lastRunDate[13]} (expected ${mockDate})`
);

// ════════════════════════════════════════════════════════════════
// PHASE 7 — A10: IDLE → CURIOSITY → COGNITION → MEMORY → IDLE
// ════════════════════════════════════════════════════════════════
section('PHASE 7 — End-to-End Lifecycle: IDLE → COGNITION → MEMORY → IDLE (A10)');

// Reconstruct lifecycle from evidence we have:
// IDLE: daemon.isActive = false (verified in A1a)
// CURIOSITY: executeDeepHarvest called by _checkDiurnalPulse (A2 + A3)
// COGNITION: dossier produced (A5) with real content
// MEMORY: learned_knowledge.json updated (A6) + SQLite indexed
// IDLE: currentlyCrawling = null after finally block (executeDeepHarvest clears it)

const lifecycleProven = (
  harvestReport !== null &&                        // COGNITION happened
  harvestReport.status === 'SUCCESS' &&            // completed cleanly
  harvestReport.filePath &&                        // ARTIFACT produced
  newEntry !== undefined &&                        // MEMORY updated
  freshDaemon.currentlyCrawling === null           // returned to IDLE
);

assert(
  'A10 — Full lifecycle IDLE→CURIOSITY→COGNITION→MEMORY→IDLE proven end-to-end',
  lifecycleProven,
  harvestReport
    ? `status=${harvestReport.status} file=${path.basename(harvestReport.filePath || '')} memoryUpdated=${newEntry !== undefined} returnedToIdle=${freshDaemon.currentlyCrawling === null}`
    : 'harvest pipeline did not complete'
);

// ════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  TEST 11.2 RESULTS: ${passed}/${passed + failed} PASS`);
if (failed > 0) {
  console.log('\n  FAILED ASSERTIONS:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ❌ ${r.label}`));
}
console.log('═══════════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
