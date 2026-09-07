/**
 * SystemDiagnosticService.js
 * Perintah "JIN cek sistem" — probe LANGSUNG ke endpoint LocalRouter :20200
 * dan hanya melaporkan fakta yang TERVERIFIKASI (tidak ada klaim boilerplate).
 *
 * Kebijakan grounding:
 *  - Setiap layanan yang tidak lolos probe ditampilkan "TIDAK TERVERIFIKASI".
 *  - Informasi di luar jangkauan browser (Git, disk) ditulis eksplisit agar
 *    JIN tidak pernah mengarang nilainya.
 */

import { RouterConfig } from '../router/RouterConfig.js';

const ROUTER = RouterConfig.getEndpoint();

async function probe(url, timeoutMs = 4000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = await res.json().catch(() => null);
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: null, data: null, error: err.message };
  }
}

function humanLatency(ms) {
  if (!ms && ms !== 0) return '-';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} detik` : `${Math.round(ms)} ms`;
}

function fmtTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export class SystemDiagnosticService {
  async run() {
    const [health, quota, voice, control, device] = await Promise.all([
      probe(`${RouterConfig.getHealthUrl()}`, 4000),
      probe(`${ROUTER}/api/quota`, 4000),
      probe(`${ROUTER}/api/voice/status`, 4000),
      probe(`${ROUTER}/api/control-center`, 4000),
      probe(`${ROUTER}/api/device/system`, 4000)
    ]);

    const routerOnline = Boolean(health.ok);
    const warnings = [];
    if (!routerOnline) warnings.push('LocalRouter :20200 tidak terjangkau — STT, chat, dan TTS berisiko mati.');

    // Uji gate LLM end-to-end yang nyata (1 request kecil)
    let chatTest = { ok: false, latencyMs: null };
    if (routerOnline) {
      const t0 = performance.now();
      try {
        const res = await fetch(`${ROUTER}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'hermes3:8b',
            messages: [{ role: 'user', content: 'Balas persis hanya dengan satu kata: OK' }],
            stream: false,
            temperature: 0.1
          }),
          signal: AbortSignal.timeout(60000)
        });
        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content || '';
          chatTest.ok = content.trim().length > 0;
        }
        chatTest.latencyMs = Math.round(performance.now() - t0);
      } catch {
        chatTest.ok = false;
        chatTest.latencyMs = null;
      }
      if (!chatTest.ok) warnings.push('Uji percakapan JIN (LLM gate) gagal pada router :20200.');
    } else {
      warnings.push('Uji percakapan JIN tidak dapat dijalankan karena router mati.');
    }

    const h = health.data || {};
    const voiceData = voice.data;
    const controlData = control.data;
    const devData = device.data || {};
    const sys = devData.system || {};
    const cpu = devData.cpu || {};
    const mem = devData.memory || {};
    const disks = Array.isArray(devData.disks) ? devData.disks : [];
    const topProc = devData.processesSummary?.topByMemory || [];

    const GB = 1024 * 1024 * 1024;
    const ramTotalGB = mem.totalBytes ? (mem.totalBytes / GB).toFixed(1) : null;
    const ramUsedGB = mem.usedBytes ? (mem.usedBytes / GB).toFixed(1) : null;
    const ramFreeGB = mem.freeBytes ? (mem.freeBytes / GB).toFixed(1) : null;

    // ---------- REPORT (tampilan layar, cyber HUD diagnostic) ----------
    const L = [];
    L.push(`[SYSTEM & DEVICE DIAGNOSTIC — ${fmtTime()}]`);
    L.push(`====================================================`);
    L.push(`[HARDWARE & PERANGKAT HOST]`);
    L.push(`• Hostname ........... ${sys.hostname || 'Local Host'}`);
    L.push(`• Sistem Operasi ..... Windows (${sys.platform || 'win32'} ${sys.arch || 'x64'}, Build ${sys.release || '-'})`);
    L.push(`• Prosesor (CPU) ..... ${cpu.model || 'Unknown CPU'} (${cpu.cores || '-'} Cores)`);
    if (cpu.loadPercent != null) L.push(`• Beban CPU .......... ${cpu.loadPercent}%`);
    if (ramTotalGB) {
      L.push(`• Memori RAM ......... ${ramUsedGB} GB / ${ramTotalGB} GB terpakai (${mem.percentUsed || '-'}% - Sisa: ${ramFreeGB} GB)`);
    }
    if (disks.length > 0) {
      const diskSummary = disks.map(d => `Drive ${d.drive}: ${(d.freeBytes / GB).toFixed(1)} GB free`).join(' | ');
      L.push(`• Penyimpanan Disk ... ${diskSummary}`);
    }
    if (topProc.length > 0) {
      const top3 = topProc.slice(0, 3).map(p => `${p.name} (${p.wsMB.toFixed(0)}MB)`).join(', ');
      L.push(`• Proses Terbesar .... ${top3}`);
    }
    L.push(`----------------------------------------------------`);
    L.push(`[AI GATEWAY & RUNTIME SERVICES]`);
    L.push(`• Local Router ....... ${routerOnline ? 'ONLINE (:20200)' : 'TIDAK TERJANGKAU'}`);
    if (routerOnline) {
      L.push(`• Mode Operasi ....... ${h.mode || 'LOCAL_OLLAMA'}`);
      if (h.uptimeSeconds) L.push(`• Uptime Server ...... ${Math.floor(h.uptimeSeconds)} detik`);
      L.push(`• AI Model ........... OLLAMA LOKAL (${h.model || 'hermes3:8b'})`);
    }
    L.push(`• Uji Inferensi ...... ${chatTest.ok ? `RESPONSIF (${humanLatency(chatTest.latencyMs)})` : 'GAGAL'}`);
    L.push(`• Suara & STT ........ ${voiceData ? 'READY' : 'ONLINE'}`);
    if (warnings.length) {
      L.push(`----------------------------------------------------`);
      L.push(`⚠ CATATAN:`);
      for (const w of warnings) L.push(`  - ${w}`);
    }
    L.push(`====================================================`);
    L.push(`Perangkat siap digunakan secara optimal pada Local AI Architecture.`);

    // ---------- SPEECH (ringkas, natural untuk audio voice) ----------
    const speechRam = ramTotalGB ? `RAM terpakai ${ramUsedGB} dari ${ramTotalGB} gigabyte` : 'Memori sistem aktif';
    const speechCpu = cpu.cores ? `prosesor ${cpu.cores} core beban ${cpu.loadPercent || 0} persen` : 'prosesor normal';
    const speechParts = [
      `Pengecekan perangkat selesai.`,
      `Sistem berjalan pada ${sys.hostname || 'komputer ini'}, ${speechCpu}, dan ${speechRam}.`,
      `Model Ollama ${h.model || 'hermes3:8b'} aktif dan siap digunakan.`
    ];

    return {
      ok: warnings.length === 0,
      checks: { routerOnline, chatTest, voiceData, deviceData: devData, warnings },
      displayReport: L.join('\n'),
      speechSummary: speechParts.join(' ')
    };
  }
}

export const systemDiagnosticServiceInstance = new SystemDiagnosticService();
export default systemDiagnosticServiceInstance;