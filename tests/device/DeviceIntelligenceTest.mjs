/**
 * DeviceIntelligenceTest.mjs
 * JIN Device Intelligence — OBSERVE/ANALYZE/DIAGNOSE test suite.
 * Style: plain assert .mjs script (repo backend convention).
 * Run: node tests/device/DeviceIntelligenceTest.mjs
 */

import assert from 'assert';

import { systemSnapshotCollectorInstance } from '../../server/device/system/SystemSnapshotCollector.mjs';
import { memoryMonitorInstance } from '../../server/device/memory/MemoryMonitor.mjs';
import { processMemoryAnalyzerInstance } from '../../server/device/memory/ProcessMemoryAnalyzer.mjs';
import { memoryTrendAnalyzerInstance } from '../../server/device/memory/MemoryTrendAnalyzer.mjs';
import { memoryLeakDetectorInstance } from '../../server/device/memory/MemoryLeakDetector.mjs';
import { ultimateAIRuntimeInspectorInstance } from '../../server/device/memory/UltimateAIRuntimeInspector.mjs';
import { junkClassifierInstance } from '../../server/device/storage/JunkClassifier.mjs';
import { devicePolicyInstance } from '../../server/device/policy/DevicePolicy.mjs';
import { cleanupPolicyInstance } from '../../server/device/policy/CleanupPolicy.mjs';
import { deviceIntelligenceRuntimeInstance } from '../../server/device/DeviceIntelligenceRuntime.mjs';
import { deviceInspectToolInstance } from '../../server/tools/DeviceInspectTool.mjs';
import { toolRegistryInstance } from '../../server/tools/ToolRegistry.mjs';
import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import AgentPlanner from '../../server/agent/AgentPlanner.mjs';
import { baselineInterpreterInstance } from '../../server/device/policy/BaselineInterpreter.mjs';
import { systemIntelligenceMemoryInstance } from '../../server/device/memory/SystemIntelligenceMemory.mjs';
import { deviceIntelligenceJournalInstance } from '../../server/device/journal/DeviceIntelligenceJournal.mjs';
import { jinResponseEngineInstance } from '../../server/agent/JINResponseEngine.mjs';

let passed = 0;
let failed = 0;
const asyncJobs = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`       ${err.message}`);
  }
}

function checkAsync(name, fn) {
  const job = (async () => {
    try {
      await fn();
      passed++;
      console.log(`  PASS: ${name}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL: ${name}`);
      console.error(`       ${err.message}`);
    }
  })();
  asyncJobs.push(job);
  return job;
}

const syntheticProcs = [
  { pid: 1, name: 'node', wsMB: 900, cpuSec: 120, isNode: true, isBrowser: false, isUltimateAI: true, isKnown: true },
  { pid: 2, name: 'chrome', wsMB: 4200, cpuSec: 900, isNode: false, isBrowser: true, isUltimateAI: false, isKnown: true },
  { pid: 3, name: 'svchost', wsMB: 300, cpuSec: 50, isNode: false, isBrowser: false, isUltimateAI: false, isKnown: true },
  { pid: 4, name: 'randomProg', wsMB: 1500, cpuSec: 30, isNode: false, isBrowser: false, isUltimateAI: false, isKnown: false }
];

console.log('\n=== JIN Device Intelligence Test Suite ===\n');

console.log('[1] System snapshot struktur valid');
checkAsync('snapshot berisi timestamp + memory + cpu + disks + summary', async () => {
  const snap = await systemSnapshotCollectorInstance.getSystemSnapshot({ list: syntheticProcs });
  assert.ok(snap.timestamp, 'timestamp wajib ada');
  assert.ok(snap.memory && snap.memory.totalBytes > 0, 'memory.totalBytes > 0');
  assert.ok(snap.cpu && snap.cpu.cores >= 1, 'cpu.cores >= 1');
  assert.ok(Array.isArray(snap.disks), 'disks array');
  assert.ok(snap.processesSummary && snap.processesSummary.total === syntheticProcs.length, 'summary.total cocok');
});

console.log('\n[2] Memory monitor menghasilkan data valid');
checkAsync('snapshot memory penuh', async () => {
  const mem = await memoryMonitorInstance.getMemorySnapshot();
  assert.ok(mem.totalBytes > 0 && mem.usedBytes >= 0 && mem.freeBytes >= 0, 'total/used/free ada');
  assert.ok(mem.percentUsed >= 0 && mem.percentUsed <= 100, 'persen dalam 0..100');
  assert.ok(mem.timestamp, 'timestamp ada');
});

console.log('\n[3] Process analyzer dapat mengurutkan process');
check('topByMemory terurut menurun & agregasi keluarga benar', () => {
  const a = processMemoryAnalyzerInstance.analyze(syntheticProcs);
  assert.strictEqual(a.topByMemory.length, 4, 'semua masuk');
  assert.ok(a.topByMemory[0].name === 'chrome', 'terbesar pertama = chrome');
  assert.strictEqual(a.nodeProcesses, 1, '1 process node');
  assert.strictEqual(a.browserProcesses, 1, '1 process browser');
  assert.strictEqual(a.unknownCount, 1, '1 process tidak dikenal');
});

console.log('\n[4] History bounded');
check('push 30 sampel → history ≤ 24 entri', () => {
  for (let i = 0; i < 30; i++) {
    memoryTrendAnalyzerInstance.push({
      timestamp: new Date().toISOString(),
      totalBytes: 16000000000,
      usedBytes: 8000000000 + i * 1000000,
      freeBytes: 8000000000,
      percentUsed: 50 + i,
      topNodeProcesses: []
    });
  }
  assert.ok(memoryTrendAnalyzerInstance.getHistory().length <= 24, 'history tidak membengkak');
});

console.log('\n[5] Leak detector tidak false-positive dari satu sample');
check('satu sample → NORMAL (bukan SUSPECTED)', () => {
  const result = memoryLeakDetectorInstance.evaluate([
    { timestamp: '2026-01-01T00:00:00Z', usedBytes: 8000 * 1024 * 1024, topNodeProcesses: [] }
  ]);
  assert.strictEqual(result.status, 'NORMAL');
  assert.ok(result.evidence[0].includes('sampel'), 'catatan kurang sampel');
});

check('tren tidak naik konsisten → NORMAL/WATCH (bukan SUSPECTED)', () => {
  const mk = (ts, mb) => ({ timestamp: ts, usedBytes: mb * 1024 * 1024, topNodeProcesses: [] });
  const result = memoryLeakDetectorInstance.evaluate([
    mk('2026-01-01T00:00:00Z', 8000),
    mk('2026-01-01T00:05:00Z', 7950),
    mk('2026-01-01T00:10:00Z', 8010),
    mk('2026-01-01T00:15:00Z', 7980)
  ]);
  assert.notStrictEqual(result.status, 'SUSPECTED');
});

check('kenaikan konsisten antar sample → SUSPECTED', () => {
  const mk = (ts, mb) => ({ timestamp: ts, usedBytes: mb * 1024 * 1024, topNodeProcesses: [] });
  const result = memoryLeakDetectorInstance.evaluate([
    mk('2026-01-01T00:00:00Z', 8000),
    mk('2026-01-01T00:05:00Z', 8400),
    mk('2026-01-01T00:10:00Z', 8800),
    mk('2026-01-01T00:15:00Z', 9200)
  ]);
  assert.strictEqual(result.status, 'SUSPECTED');
});

console.log('\n[6] Policy mencegah tindakan destruktif');
check('guard scan diizinkan, destroy/cleanup ditolak', () => {
  assert.strictEqual(devicePolicyInstance.guard('scan').allowed, true);
  assert.strictEqual(devicePolicyInstance.guard('destructive_cleanup').allowed, false);
  assert.strictEqual(devicePolicyInstance.guard('delete_user_files').allowed, false);
  assert.strictEqual(devicePolicyInstance.guard('cleanup_whitelisted_temp').allowed, false);
  assert.strictEqual(devicePolicyInstance.describe().currentLevel, 'OBSERVE_ONLY');
});

check('CleanupPolicy tidak menghasilkan plan yang dieksekusi', () => {
  const plan = cleanupPolicyInstance.buildPlan([
    { path: 'C:\\Users\\a\\AppData\\Local\\Temp\\x.tmp', sizeBytes: 1024, category: 'SAFE', reason: 'tmp' },
    { path: 'C:\\Windows\\System32\\a.exe', sizeBytes: 5000, category: 'PROTECTED', reason: 'system' }
  ]);
  assert.ok(plan.executionBlocked === true, 'menunggu fase lanjutan');
  assert.ok(plan.plan.every(p => p.action === 'delete_whitelisted_tmp'), 'plan hanya label masa depan');
});

console.log('\n[7] Protected path tidak diklasifikasikan SAFE');
check('Windows / Documents / .git / .env → PROTECTED; temp → SAFE; zip lama → REVIEW', () => {
  assert.strictEqual(junkClassifierInstance.classifyPath('C:\\Windows\\System32\\a.exe').category, 'PROTECTED');
  assert.strictEqual(junkClassifierInstance.classifyPath('C:\\Program Files\\App\\a.exe').category, 'PROTECTED');
  assert.strictEqual(junkClassifierInstance.classifyPath(process.env.USERPROFILE + '\\Documents\\laporan.docx').category, 'PROTECTED');
  assert.strictEqual(junkClassifierInstance.classifyPath('D:\\proyek\\.git\\objects\\x').category, 'PROTECTED');
  assert.strictEqual(junkClassifierInstance.classifyPath('D:\\proyek\\.env').category, 'PROTECTED');
  assert.strictEqual(junkClassifierInstance.classifyPath('C:\\Users\\a\\AppData\\Local\\Temp\\temp123.tmp').category, 'SAFE');
  assert.strictEqual(junkClassifierInstance.classifyPath(process.env.USERPROFILE + '\\Downloads\\setup_2020.zip').category, 'REVIEW');
});

console.log('\n[8] UltimateAI runtime inspector tidak crash jika layanan down');
checkAsync('detect() → status valid, services array, no throw', async () => {
  const report = await ultimateAIRuntimeInspectorInstance.detect();
  assert.ok(['ACTIVE', 'PARTIAL', 'DOWN'].includes(report.status), 'status valid');
  assert.ok(Array.isArray(report.services) && report.services.length >= 5, 'ada ≥5 service runtime');
  assert.ok(Array.isArray(report.portRows), 'portRows array');
  for (const s of report.services) {
    assert.ok(['RUNNING', 'DOWN'].includes(s.state), `state ${s.name} valid`);
  }
});

console.log('\n[9] DeviceInspectTool terdaftar & dapat dieksekusi read-only');
check('toolRegistry punya device.inspect READ_ONLY', () => {
  const tool = toolRegistryInstance.get('device.inspect');
  assert.ok(tool, 'terdaftar');
  assert.strictEqual(tool.permissionLevel, 'READ_ONLY');
});
checkAsync('execute scope=dokter diagnosis → text + recommendations', async () => {
  const out = await deviceInspectToolInstance.execute({ scope: 'diagnosis' }, null);
  assert.ok(Array.isArray(out.recommendations), 'rekomendasi array');
  assert.ok(out.policy && out.policy.currentLevel === 'OBSERVE_ONLY', 'policy hadir');
});

console.log('\n[10] Runtime diagnosis ringkas');
checkAsync('runDiagnosis() → anomalies + recommendations + policy', async () => {
  const d = await deviceIntelligenceRuntimeInstance.runDiagnosis();
  assert.ok(Array.isArray(d.anomalies) && Array.isArray(d.recommendations), 'list ada');
  assert.ok(d.runtimeStatus, 'runtime status');
  assert.ok(d.policy.currentLevel === 'OBSERVE_ONLY', 'OBSERVE_ONLY');
});

console.log('\n[11] Bahasa natural memetakan ke device.inspect (JIN langkah: "kondisi komputer saya")');
const offlineDecision = (phrase) => semanticIntentEngineInstance._offlineContextualReasoning(phrase, {}, {});
check('"JIN, bagaimana kondisi komputer saya?" → DEVICE_INSPECTION/overview', () => {
  const d = offlineDecision('JIN, bagaimana kondisi komputer saya?');
  assert.strictEqual(d.intent, 'DEVICE_INSPECTION');
  assert.ok(d.toolsNeeded.includes('device.inspect'));
  assert.strictEqual(d.scope, 'overview');
});
check('"JIN, cek penggunaan RAM" → scope memory', () => {
  assert.strictEqual(offlineDecision('JIN, cek penggunaan RAM').scope, 'memory');
});
check('"proses apa yang paling banyak menggunakan memory?" → scope process', () => {
  assert.strictEqual(offlineDecision('proses apa yang paling banyak menggunakan memory?').scope, 'process');
});
check('"kondisi UltimateAI sekarang" → scope runtime', () => {
  assert.strictEqual(offlineDecision('JIN, bagaimana kondisi UltimateAI sekarang?').scope, 'runtime');
});
check('"apa yang membuat komputer saya berat?" → scope diagnosis', () => {
  assert.strictEqual(offlineDecision('apa yang membuat komputer saya berat?').scope, 'diagnosis');
});
check('"cek storage komputer" → scope storage', () => {
  assert.strictEqual(offlineDecision('cek storage komputer').scope, 'storage');
});
check('"JIN, periksa memory" → scope memory', () => {
  assert.strictEqual(offlineDecision('JIN, periksa memory').scope, 'memory');
});
check('"JIN, cek proses yang berjalan" → scope process', () => {
  const d = offlineDecision('JIN, cek proses yang berjalan');
  assert.strictEqual(d.scope, 'process');
});
check('"JIN, periksa penyimpanan" → scope storage', () => {
  assert.strictEqual(offlineDecision('JIN, periksa penyimpanan').scope, 'storage');
});
check('"JIN, cek proses yang berat" → scope process', () => {
  assert.strictEqual(offlineDecision('JIN, cek proses yang berat').scope, 'process');
});
check('negatif: "proses dokumen laporan ini" TIDAK device.inspect', () => {
  const d = offlineDecision('tolong proses dokumen laporan ini untuk saya');
  assert.notStrictEqual(d.intent, 'DEVICE_INSPECTION');
  assert.ok(!d.toolsNeeded.includes('device.inspect'));
});
check('negatif: "periksa proses dokumen" TIDAK device.inspect', () => {
  const d = offlineDecision('periksa proses dokumen itu');
  assert.notStrictEqual(d.intent, 'DEVICE_INSPECTION');
});
check('AgentPlanner structural fallback meneruskan scope ke params.device.inspect', () => {
  const d = offlineDecision('JIN, cek penggunaan RAM');
  const plan = AgentPlanner._structuralFallbackPlan('goal-x', 'cek ram', d, {}, { selectedEngine: 't', selectedPool: 'POOL_1' });
  const devStep = plan.steps.find(s => s.tool === 'device.inspect');
  assert.ok(devStep, 'ada step device.inspect');
  assert.strictEqual(devStep.params.scope, 'memory');
});

console.log('\n[12] FASE 1A — Planner LLM-path scope enforcement (deterministik)');
check('_applyDeviceScope mengisi scope meski LLM lupa', () => {
  const steps = AgentPlanner._applyDeviceScope(
    [{ tool: 'device.inspect', params: {} }, { tool: 'web.search', params: {} }],
    { scope: 'memory', goal: 'cek RAM' }
  );
  assert.strictEqual(steps[0].params.scope, 'memory');
  assert.strictEqual(steps[1].params.scope, undefined, 'tool lain tidak disentuh');
});

console.log('\n[13] FASE 1A — Action Journal field lengkap (E)');
checkAsync('aktivitas device → record dengan semua field + confirmationState NOT_REQUIRED', async () => {
  await deviceIntelligenceRuntimeInstance.getMemoryReport({
    userIntent: 'JIN, cek penggunaan RAM',
    action: 'INSPECT_MEMORY',
    scope: 'memory'
  });
  const latest = deviceIntelligenceJournalInstance.getRecent(1)[0];
  assert.ok(latest.type === 'DEVICE_ACTION', 'type DEVICE_ACTION');
  assert.ok(latest.timestamp && latest.userIntent && latest.action && latest.scope, 'timestamp/userIntent/action/scope');
  assert.ok(latest.result && typeof latest.result === 'object', 'result ada');
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(latest.riskLevel), 'riskLevel valid');
  assert.strictEqual(latest.confirmationState, 'NOT_REQUIRED', 'OBSERVE_ONLY → NOT_REQUIRED');
  assert.ok(latest.policyLevel === 'OBSERVE_ONLY', 'policyLevel');
});
checkAsync('attachArtifactReference mengikat artifact ke record terbaru', async () => {
  const ref = `art-test-${Date.now()}`;
  const { attached } = await deviceIntelligenceRuntimeInstance.attachArtifactReference(ref);
  assert.ok(attached, 'terikat');
  const latest = deviceIntelligenceJournalInstance.getRecent(10).find(e => e.artifactReference === ref);
  assert.ok(latest, 'record memuat artifactReference');
});

console.log('\n[14] FASE 1A — Baseline System Intelligence (D)');
const fixedBase = { capturedAt: new Date().toISOString(), samples: 6, norm: { ramPercentAvg: 50, ramPercentP90: 60, ramPercentMax: 66 } };
const originalEnsure = baselineInterpreterInstance.ensureBaseline;
const withEnsure = (fn, result) => {
  baselineInterpreterInstance.ensureBaseline = () => result;
  try {
    fn();
  } finally {
    baselineInterpreterInstance.ensureBaseline = originalEnsure;
  }
};
check('tanpa baseline & sampel minim → UNKNOWN (tidak mengklaim anomali)', () => {
  withEnsure(() => {
    const b = baselineInterpreterInstance.evaluate({ memoryPercent: 88 });
    assert.strictEqual(b.status, 'UNKNOWN');
    assert.strictEqual(b.limited, true);
    assert.ok(!b.reason.includes('anomali'), 'tidak ada klaim anomali tanpa pembanding');
  }, null);
});
check('dengan baseline & delta kecil → NORMAL', () => {
  withEnsure(() => {
    const b = baselineInterpreterInstance.evaluate({ memoryPercent: 55 });
    assert.strictEqual(b.status, 'NORMAL');
  }, { ...fixedBase });
});
check('delta ≥ 25 → ANOMALY_SUSPECTED', () => {
  withEnsure(() => {
    const b = baselineInterpreterInstance.evaluate({ memoryPercent: 78 });
    assert.strictEqual(b.status, 'ANOMALY_SUSPECTED');
  }, { ...fixedBase });
});
check('delta 10-24 → ABOVE_BASELINE', () => {
  withEnsure(() => {
    const b = baselineInterpreterInstance.evaluate({ memoryPercent: 63 });
    assert.strictEqual(b.status, 'ABOVE_BASELINE');
  }, { ...fixedBase });
});

console.log('\n[15] FASE 1A — Memory integration adapter (C)');
check('record/g etMemories + bounded + tanpa secret', () => {
  systemIntelligenceMemoryInstance.record({
    type: 'OPERATIONAL',
    insight: 'Analisis RAM selesai',
    action: { type: 'ANALYZE_MEMORY', scope: 'memory' },
    context: { refresh_token: 'should-be-dropped', apiKey: 'should-be-dropped', safeNote: 'ok' }
  });
  const mems = systemIntelligenceMemoryInstance.getMemories({ type: 'OPERATIONAL', limit: 3 });
  assert.ok(mems[0].insight === 'Analisis RAM selesai', 'insight tersimpan');
  assert.strictEqual(mems[0].refresh_token, undefined, 'secret key di-scrub');
  assert.strictEqual(mems[0].apiKey, undefined, 'apikey di-scrub');
  assert.strictEqual(mems[0].context.safeNote, 'ok', 'field aman dipertahankan');
  assert.ok(systemIntelligenceMemoryInstance.count() <= 60, 'bounded');
});
check('tipe memory tidak dikenal ditolak', () => {
  let threw = false;
  try {
    systemIntelligenceMemoryInstance.record({ type: 'BOGUS', insight: 'x' });
  } catch {
    threw = true;
  }
  assert.ok(threw, 'throw untuk tipe tidak dikenal');
});

console.log('\n[16] FASE 1A — Policy memblokir semua jalur destruktif (G)');
check('delete/recursive/cleanup/registry/uninstall/process-kill/service-stop semua diblokir', () => {
  const blocked = [
    'delete_file', 'recursive_delete', 'system_cleanup', 'destructive_cleanup',
    'registry_modify', 'uninstall_software', 'process_kill', 'service_stop', 'delete_user_files'
  ];
  for (const a of blocked) {
    assert.strictEqual(devicePolicyInstance.guard(a).allowed, false, `${a} harus diblokir`);
  }
  assert.strictEqual(devicePolicyInstance.guard('scan').allowed, true, 'scan tetap diizinkan');
  assert.strictEqual(devicePolicyInstance.guard('analyze').allowed, true, 'analyze tetap diizinkan');
});

console.log('\n[17] FASE 1A — Sintesis respons JIN memakai angka nyata (A)');
checkAsync('naturalVoiceSpeech memuat fakta konkret device.inspect', async () => {
  const out = await jinResponseEngineInstance.synthesizeFactDrivenOutcome(
    'JIN, cek penggunaan RAM',
    { intent: 'DEVICE_INSPECTION' },
    [{
      step: { tool: 'device.inspect', params: { scope: 'memory' } },
      stepResult: {
        success: true,
        result: {
          scope: 'memory',
          current: { percentUsed: 62, totalBytes: 16000000000, usedBytes: 9900000000, freeBytes: 6100000000 },
          leak: { status: 'NORMAL' },
          historySamples: 5,
          text: 'KONDISI DEVICE\n\nRAM: 62% terpakai (status memori: NORMAL)'
        }
      }
    }],
    null,
    { isSatisfied: true },
    {}
  );
  assert.strictEqual(out.responseMode, 'GROUNDED_OUTCOME');
  assert.ok(/62|NORMAL/.test(out.naturalVoiceSpeech), 'angka nyata di respons');
  assert.ok(out.evidenceRefs.length === 1 && out.evidenceRefs[0].sourceType === 'COMPUTED');
});

(async () => {
  await Promise.all(asyncJobs);
  console.log('\n=== Hasil: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed > 0) {
    console.error('ADA GAGAL: perbaiki sebelum melanjutkan.');
    process.exit(1);
  }
  console.log('SEMUA LULUS.');
  process.exit(0);
})();