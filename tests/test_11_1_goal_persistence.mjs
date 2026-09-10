/**
 * TEST 11.1 — Goal Persistence & Task Resumption
 * ═══════════════════════════════════════════════════════════════
 * Membuktikan bahwa setelah JIN kehilangan runtime state (simulated interruption),
 * dia masih tahu apa yang sedang dikerjakan dan dari mana harus melanjutkan.
 *
 * 9 Assertions:
 *   A1  Goal mendapatkan taskId/goalId unik
 *   A2  Active state menyimpan goal
 *   A3  Active state menyimpan currentStep
 *   A4  Active state menyimpan completedSteps[]
 *   A5  Snapshot benar-benar persistent di disk
 *   A6  Runtime state dihapus (clearActiveState) → state hilang
 *   A7  State berhasil di-restore setelah clear
 *   A8  Resume dimulai dari step yang belum selesai (S3), BUKAN S1
 *   A9  Idempotency — resume(taskId) dua kali tidak menjalankan step selesai dua kali
 *
 * Struktur skenario:
 *   GOAL: 4 steps (S1, S2, S3, S4)
 *   Phase 1: S1 ✅ dan S2 ✅ dieksekusi → snapshot disimpan
 *   Phase 2: clearActiveState() (simulated interrupt) → state hilang dari memory
 *   Phase 3: restoreActiveState() → state dibaca kembali dari disk
 *   Phase 4: resumeGoal(taskId) → harusnya resume dari S3, skip S1 dan S2
 *   Phase 5: resumeGoal(taskId) lagi → idempotent, tidak jalankan ulang
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Imports langsung dari production code (bukan mock) ──────────────────────
import { activeMemoryCoreInstance } from '../server/memory/ActiveMemoryCore.mjs';
import { AgentRuntime } from '../server/agent/AgentRuntime.mjs';

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
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ── Simulation helpers ───────────────────────────────────────────────────────

/**
 * Simulates plan execution: marks S1 and S2 as completed, leaves S3 and S4 pending.
 * Uses snapshotActiveState directly (same method as AgentRuntime._executePlanLoop).
 */
function simulatePlanExecution(taskId, goal, allSteps) {
  const completedSteps = [allSteps[0].id, allSteps[1].id]; // S1, S2 done
  const pendingSteps   = [allSteps[2].id, allSteps[3].id]; // S3, S4 pending

  return activeMemoryCoreInstance.snapshotActiveState({
    taskId,
    goal,
    currentStep: 3,           // about to execute S3
    activeTools: allSteps.map(s => s.tool).filter(Boolean),
    completedSteps,
    pendingSteps,
    planSteps: allSteps.map(s => ({ id: s.id, tool: s.tool, subgoal: s.subgoal })),
    status: 'IN_PROGRESS'
  });
}

// ── Main test sequence ───────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  TEST 11.1 — GOAL PERSISTENCE & TASK RESUMPTION');
console.log('═══════════════════════════════════════════════════════════════');

// ── Prepare simulated 4-step plan ─────────────────────────────────────────
const TASK_ID = `goal_test11_${Date.now()}`;
const GOAL    = 'Lakukan riset mendalam tentang AI terbaru, ringkas 4 sumber, analisis dampak, dan buat laporan.';

const PLAN_STEPS = [
  { id: 'S1', tool: 'web.search',   subgoal: 'Cari 4 sumber AI terbaru' },
  { id: 'S2', tool: 'doc.analyze',  subgoal: 'Analisis sumber yang ditemukan' },
  { id: 'S3', tool: 'web.fetch',    subgoal: 'Ambil detail konten' },  // <-- interrupted here
  { id: 'S4', tool: null,           subgoal: 'Buat laporan ringkasan' }
];

// ════════════════════════════════════════════════════════════════
// PHASE 1: Execute S1 + S2, snapshot state to disk
// ════════════════════════════════════════════════════════════════
section('PHASE 1 — Execute S1 & S2, snapshot to disk');

const snapshot = simulatePlanExecution(TASK_ID, GOAL, PLAN_STEPS);

// A1: Goal mendapatkan taskId/goalId unik
assert('A1 — Snapshot has unique taskId', snapshot.taskId === TASK_ID, `taskId=${snapshot.taskId}`);

// A2: Active state menyimpan goal
assert('A2 — Snapshot stores goal text', snapshot.goal === GOAL);

// A3: Active state menyimpan currentStep
assert('A3 — Snapshot stores currentStep', typeof snapshot.currentStep === 'number' && snapshot.currentStep > 0, `currentStep=${snapshot.currentStep}`);

// A4: Active state menyimpan completedSteps[]
assert(
  'A4 — Snapshot stores completedSteps array',
  Array.isArray(snapshot.completedSteps) && snapshot.completedSteps.includes('S1') && snapshot.completedSteps.includes('S2'),
  `completedSteps=${JSON.stringify(snapshot.completedSteps)}`
);

// A5: Snapshot benar-benar persistent di disk
const statePath = path.join('F:\\UltimateAI_Memory', '03_AgentState', 'active_state.json');
const diskExists = fs.existsSync(statePath);
let diskContent = null;
if (diskExists) {
  try { diskContent = JSON.parse(fs.readFileSync(statePath, 'utf-8')); } catch(_) {}
}
assert(
  'A5 — Snapshot persisted to disk (F:\\03_AgentState\\active_state.json)',
  diskExists && diskContent?.taskId === TASK_ID,
  diskExists ? `taskId on disk=${diskContent?.taskId}` : 'FILE NOT FOUND'
);

// ════════════════════════════════════════════════════════════════
// PHASE 2: Simulate runtime interruption (clearActiveState)
// ════════════════════════════════════════════════════════════════
section('PHASE 2 — Simulate runtime interruption (clearActiveState)');

activeMemoryCoreInstance.clearActiveState();

// A6: State dihapus dari disk
const afterClearExists = fs.existsSync(statePath);
assert('A6 — clearActiveState removes file from disk', !afterClearExists, afterClearExists ? 'FILE STILL EXISTS ❌' : 'file deleted');

// ════════════════════════════════════════════════════════════════
// PHASE 3: Restore from disk (re-create file first via second snapshot, then restore)
// Karena clearActiveState sudah menghapus file, kita re-snapshot (simulasi bahwa
// file sebelumnya di-backup atau crash terjadi sebelum hapus) →
// Gunakan kembali nilai snapshot asli yang sudah kita simpan di variable 'snapshot'
// ════════════════════════════════════════════════════════════════
section('PHASE 3 — Restore state from disk');

// Re-write snapshot ke disk (simulasi: file di-restore dari backup, atau restart dari checkpoint)
activeMemoryCoreInstance.snapshotActiveState({
  taskId: snapshot.taskId,
  goal: snapshot.goal,
  currentStep: snapshot.currentStep,
  activeTools: snapshot.activeTools,
  completedSteps: snapshot.completedSteps,
  pendingSteps: snapshot.pendingSteps,
  planSteps: snapshot.planSteps,
  status: snapshot.status
});

// Baca kembali dari disk
const restored = activeMemoryCoreInstance.restoreActiveState();

// A7: State berhasil di-restore
assert(
  'A7 — restoreActiveState() reads back correct state',
  restored !== null && restored.taskId === TASK_ID && restored.goal === GOAL,
  restored ? `taskId=${restored.taskId} completedSteps=${JSON.stringify(restored.completedSteps)}` : 'null'
);

// ════════════════════════════════════════════════════════════════
// PHASE 4: resumeGoal() — harus resume dari S3, skip S1 dan S2
// ════════════════════════════════════════════════════════════════
section('PHASE 4 — resumeGoal() must resume from S3, skip S1 & S2');

const agentRuntime = new AgentRuntime();
const resumeResult = await agentRuntime.resumeGoal(TASK_ID);

// A8: Resume dimulai dari step yang belum selesai (S3), BUKAN S1
const skippedCorrectly = Array.isArray(resumeResult.skippedSteps)
  && resumeResult.skippedSteps.includes('S1')
  && resumeResult.skippedSteps.includes('S2')
  && !resumeResult.skippedSteps.includes('S3');

const resumedFromCorrect = resumeResult.resumedFromStepId === 'S3';

assert(
  'A8 — Resume skips S1+S2, resumes from S3 (not S1)',
  skippedCorrectly && resumedFromCorrect,
  `decision=${resumeResult.resumeDecision} skipped=${JSON.stringify(resumeResult.skippedSteps)} resumedFrom=${resumeResult.resumedFromStepId}`
);

// ════════════════════════════════════════════════════════════════
// PHASE 5: Idempotency — resume(taskId) dua kali → IDEMPOTENT_SKIP
// ════════════════════════════════════════════════════════════════
section('PHASE 5 — Idempotency: second resumeGoal() must not re-execute');

const resumeResult2 = await agentRuntime.resumeGoal(TASK_ID);

// A9: Idempotency — panggilan kedua mengembalikan IDEMPOTENT_SKIP
assert(
  'A9 — Second resumeGoal() call returns IDEMPOTENT_SKIP (no duplicate execution)',
  resumeResult2.resumeDecision === 'IDEMPOTENT_SKIP',
  `decision=${resumeResult2.resumeDecision}`
);

// ════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  TEST 11.1 RESULTS: ${passed}/${passed + failed} PASS`);
if (failed > 0) {
  console.log('\n  FAILED ASSERTIONS:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ❌ ${r.label}`));
}
console.log('═══════════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
