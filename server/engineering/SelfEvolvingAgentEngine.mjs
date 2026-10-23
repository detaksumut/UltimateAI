/**
 * SelfEvolvingAgentEngine.mjs
 * Supervised self-improvement proposal engine for JINI.
 *
 * This module records candidate rules from failure analysis. It DOES NOT apply
 * source-code patches, execute scripts, run a test suite, or re-deploy runtime
 * code. Candidate rules stay PROPOSED until a separate controlled workflow
 * validates them with repeatable tests and explicit approval.
 */

import fs from 'fs';
import path from 'path';
import { nineRouterChatAdapterInstance } from '../providers/NineRouterChatAdapter.mjs';
import { incidentMemoryInstance } from './memory/IncidentMemory.mjs';
import { gitCheckpointManagerInstance } from './checkpoint/GitCheckpointManager.mjs';
import { policyGateInstance } from './policy/PolicyGate.mjs';
import { IncidentStatus, RiskClassification } from './types/IncidentTypes.mjs';

const MEMORY_VAULT_PATH = path.resolve(process.cwd(), 'server', 'data', 'memory-vault.json');

// Sinyal komplain atau koreksi dari user bahwa permintaan sebelumnya tidak terpenuhi dengan benar
const CORRECTION_SIGNALS = [
  /\b(?:tidak\s+berfungsi|tak\s+berfungsi|nggak\s+fungsi|gak\s+fungsi)\b/i,
  /\b(?:masih\s+tidak\s+bisa|masih\s+tak\s+bisa|masih\s+nggak\s+bisa|masih\s+gak\s+bisa)\b/i,
  /\b(?:suaranya\s+keluar\s+tapi|suara\s+ada\s+tapi|videonya\s+tak\s+ada|video\s+hilang|layar\s+hitam)\b/i,
  /\b(?:bukan\s+ini|bukan\s+itu|bukan\s+yang\s+ini|bukan\s+yang\s+saya\s+maksud)\b/i,
  /\b(?:kok\s+salah|masih\s+salah|salah\s+lagu|salah\s+jawaban|keliru)\b/i,
  /\b(?:kenapa\s+tidak\s+bisa|kenapa\s+tak\s+bisa|mengapa\s+gagal)\b/i,
  /\b(?:kenapa\s+ribet|ngapain\s+buat\s+player\s+baru|ribet\s+kali)\b/i,
  /\b(?:koreksi\s+diri|perbaiki\s+diri|perbaiki\s+script|koreksi\s+script|evolusi\s+diri)\b/i,
  /\b(?:rusak|error|bug|macet|hang|tidak\s+jalan|gagal\s+baca)\b/i
];

export class SelfEvolvingAgentEngine {
  constructor() {
    this.nineRouter = nineRouterChatAdapterInstance;
    this.memory = incidentMemoryInstance;
    this.checkpointMgr = gitCheckpointManagerInstance;
    this.policy = policyGateInstance;
    this.isEvolving = false;
  }

  /**
   * Mendeteksi apakah prompt user saat ini merupakan koreksi atas kegagalan sebelumnya
   */
  detectUserCorrection(prompt = '', messages = []) {
    const text = String(prompt || '').trim();
    if (text.length < 3) return false;

    // Explicit source-repair commands may start a supervised repair even
    // without a prior failed assistant response. Ordinary complaints still
    // require conversational history to prevent accidental repair triggering.
    const explicitRepair = /\\b(?:perbaiki|perbaikan|koreksi|fix|repair|patch|evolusi)\\b[^.]{0,60}\\b(?:kode|script|skrip|source|file|bug|error|jini|diri|sistem|runtime|software)\\b/i.test(text);
    if (explicitRepair) return true;

    const hasHistory = Array.isArray(messages) && messages.length >= 2;
    const matchesSignal = CORRECTION_SIGNALS.some((pattern) => pattern.test(text));
    return matchesSignal && hasHistory;
  }

  /**
   * Ekstraksi konteks kegagalan dari riwayat pesan
   */
  extractFailureContext(currentPrompt, messages = []) {
    let lastUserPrompt = '';
    let lastAssistantResponse = '';

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!lastAssistantResponse && (msg.role === 'assistant' || msg._agent)) {
        lastAssistantResponse = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      } else if (!lastUserPrompt && msg.role === 'user') {
        lastUserPrompt = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      }
      if (lastUserPrompt && lastAssistantResponse) break;
    }

    return {
      userComplaint: currentPrompt,
      lastUserPrompt: lastUserPrompt || 'Tidak terdeteksi',
      lastAssistantResponse: lastAssistantResponse ? lastAssistantResponse.slice(0, 1500) : 'Tidak terdeteksi'
    };
  }

  /**
   * Analisis Root Cause Analysis (RCA) & Rancangan Solusi menggunakan 9Router
   */
  async introspectWithNineRouter({ userComplaint, lastUserPrompt, lastAssistantResponse }) {
    console.log(`🧠 [SelfEvolvingAgentEngine] Initiating 9Router Root Cause Analysis & Self-Correction...`);

    const systemPrompt = [
      'Kamu adalah 9Router Self-Correction & Autonomous Evolution Kernel untuk JINI.',
      'JINI adalah agen AI cerdas multimodal (UltimateAI).',
      'User baru saja menyatakan bahwa permintaannya TIDAK TERPENUHI DENGAN BENAR atau mengalami kegagalan.',
      'Tugasmu:',
      '1. Analisis mengapa permintaan user gagal (Root Cause Analysis).',
      '2. Identifikasi SATU file sumber konkret dengan path relatif repository, misalnya server/agent/AgentRuntime.mjs. Jangan menebak path. Jika target tidak dapat dipastikan, targetSubsystem harus UNKNOWN.',
      '3a. Field targetSubsystem harus hanya berisi satu path file relatif konkret, tanpa penjelasan atau nomor baris.'
      '3. Rumuskan KANDIDAT aturan koreksi yang bisa diuji, bukan klaim bahwa kode sudah diubah.',
      '4. Jelaskan validasi yang masih diperlukan. Dilarang mengklaim patch diterapkan, tes lulus, atau masalah selesai jika belum ada bukti.',
      '',
      'KEMBALIKAN OUTPUT HANYA DALAM FORMAT JSON BERSIH TANPA KATA-KATA LAIN:',
      '{',
      '  "identifiedFailure": "Deskripsi singkat kegagalan yang dialami user",',
      '  "rootCause": "Akar penyebab teknis/semantik kegagalan",',
      '  "targetSubsystem": "Nama file/modul/fitur yang relevan",',
      '  "evolvedRule": "Aturan permanen yang harus dipatuhi JINI ke depan",',
      '  "actionCategory": "SCRIPT_REFINEMENT" | "DYNAMIC_RULE" | "EXECUTION_RETRY",',
      '  "remediationSummary": "Langkah perbaikan konkret yang diambil",',
      '  "suggestedOutput": "Respons atau tindakan perbaikan langsung untuk user"',
      '}'
    ].join('\n');

    const userPrompt = [
      `=== KONTEKS KEGAGALAN JINI ===`,
      `Permintaan User Sebelumnya: "${lastUserPrompt}"`,
      `Respons/Tindakan JINI Sebelumnya: "${lastAssistantResponse}"`,
      `Keluhan/Koreksi User Sekarang: "${userComplaint}"`,
      `==============================`,
      `Analisis sekarang dan rumuskan kandidat aturan perbaikan yang belum diuji:`
    ].join('\n');

    try {
      const resultText = await this.nineRouter.sendChat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: process.env.NINEROUTER_CHAT_MODEL || 'gh/gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 2048
      });

      // Parse JSON from 9Router response
      const jsonMatch = String(resultText).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const asText = (value, fallback) => typeof value === 'string' && value.trim()
          ? value.trim().slice(0, 3000)
          : fallback;
        return {
          identifiedFailure: asText(parsed.identifiedFailure, 'Failure reported by user; details need review.'),
          rootCause: asText(parsed.rootCause, 'Root cause remains a hypothesis until verified.'),
          targetSubsystem: asText(parsed.targetSubsystem, 'Unknown subsystem; manual review required.'),
          evolvedRule: asText(parsed.evolvedRule, 'Create a testable candidate rule after examining logs and source.'),
          actionCategory: ['SCRIPT_REFINEMENT', 'DYNAMIC_RULE', 'EXECUTION_RETRY'].includes(parsed.actionCategory)
            ? parsed.actionCategory
            : 'DYNAMIC_RULE',
          remediationSummary: asText(parsed.remediationSummary, 'Candidate analysis only; no code patch applied and no tests run.'),
          suggestedOutput: asText(parsed.suggestedOutput, 'A candidate correction rule was recorded for review.'),
          validationStatus: 'NOT_TESTED',
          analysisSource: 'NINEROUTER_CANDIDATE_ANALYSIS'
        };
      }
    } catch (err) {
      console.warn(`[SelfEvolvingAgentEngine] 9Router introspection warning:`, err.message);
    }

    // Heuristic fallback is a hypothesis only; it must never claim that a repair ran.
    return {
      identifiedFailure: `Permintaan user tidak terpenuhi: "${String(userComplaint || '').slice(0, 1000)}"`,
      rootCause: 'Hipotesis awal: ketidaksesuaian antara intent yang diharapkan dan hasil eksekusi; belum diverifikasi lewat log/test.',
      targetSubsystem: 'Unknown — needs log and source review',
      evolvedRule: 'Capture a reproducible failing case, write a focused regression test, and validate a proposed fix before promotion.',
      actionCategory: 'DYNAMIC_RULE',
      remediationSummary: 'Only a heuristic candidate was drafted because 9Router analysis was unavailable. No code patch applied; no tests run.',
      suggestedOutput: 'Kandidat perbaikan dicatat untuk ditinjau. Kode runtime belum diubah dan masalah belum dinyatakan selesai.',
      validationStatus: 'NOT_TESTED',
      analysisSource: 'HEURISTIC_FALLBACK'
    };
  }

  /**
   * Resolve an LLM-proposed target to an existing repository source file.
   * Candidate paths are only hints until checked against the local checkout.
   */
  validateRepairTarget(rawTarget) {
    const target = String(rawTarget || '').trim().replace(/^["'\`]|["'\`]$/g, '');
    if (!target || /^unknown\b/i.test(target) || target.includes('\n') || target.includes(':') || target.length > 240) return null;
    const relative = target.replace(/\\/g, '/').replace(/^\.\//, '');
    if (relative.startsWith('/') || relative.split('/').some(part => !part || part === '.' || part === '..')) return null;
    if (!['src/', 'server/', 'api/'].some(prefix => relative.startsWith(prefix))) return null;
    if (/(^|\/)(\.git|node_modules|\.env(?:\.|$)|credentials?|secrets?|tokens?|\.ssh|vault|policy)(\/|$)/i.test(relative) ||
        /(?:^|\/)(package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json|\.npmrc)$/i.test(relative) ||
        relative.startsWith('.github/') || relative.startsWith('scripts/')) return null;

    const root = path.resolve(process.cwd());
    const absolute = path.resolve(root, ...relative.split('/'));
    const rel = path.relative(root, absolute);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
    try {
      const targetStat = fs.lstatSync(absolute);
      if (!targetStat.isFile() || targetStat.isSymbolicLink() || targetStat.size > 32 * 1024) return null;
      let current = root;
      for (const segment of relative.split('/').slice(0, -1)) {
        current = path.join(current, segment);
        if (fs.lstatSync(current).isSymbolicLink()) return null;
      }
    } catch {
      return null;
    }
    return relative;
  }

  /** Persist an untested candidate rule; do not promote it to validated knowledge. */
  async persistToMemoryVault(analysis) {
    try {
      const record = {
        id: `EVOLVE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        key: `CANDIDATE_RULE_${analysis.targetSubsystem || 'GLOBAL'}`.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase(),
        content: `[UNVERIFIED CANDIDATE RULE] Failure: ${analysis.identifiedFailure} | Candidate: ${analysis.evolvedRule}`,
        tier: 'CANDIDATE_RULE',
        confidence: 0.55,
        status: 'PROPOSED',
        validationStatus: 'NOT_TESTED',
        provenance: analysis.analysisSource || 'NINEROUTER_CANDIDATE_ANALYSIS',
        createdAt: new Date().toISOString(),
        metadata: {
          targetSubsystem: analysis.targetSubsystem,
          rootCause: analysis.rootCause,
          actionCategory: analysis.actionCategory,
          validationStatus: 'NOT_TESTED',
          codePatchApplied: false,
          testsRun: false
        }
      };

      let vault = [];
      if (fs.existsSync(MEMORY_VAULT_PATH)) {
        try {
          const current = JSON.parse(fs.readFileSync(MEMORY_VAULT_PATH, 'utf8'));
          if (Array.isArray(current)) vault = current;
        } catch (parseError) {
          // Preserve the corrupted vault for manual recovery; do not overwrite it.
          console.error('[SelfEvolvingAgentEngine] Memory Vault is invalid JSON; refusing to overwrite it:', parseError.message);
          return null;
        }
      }
      vault.unshift(record);
      const tempPath = MEMORY_VAULT_PATH + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(vault.slice(0, 1000), null, 2), 'utf8');
      fs.renameSync(tempPath, MEMORY_VAULT_PATH);

      // Keep untested candidates in the PROPOSED lifecycle state.
      this.memory.proposePattern({
        category: 'AUTONOMOUS_EVOLUTION_CANDIDATE',
        targetComponent: analysis.targetSubsystem,
        symptoms: analysis.identifiedFailure,
        rootCause: analysis.rootCause,
        candidateStrategy: analysis.evolvedRule,
        validationEvidence: 'NOT_TESTED'
      });

      console.log(`[SelfEvolvingAgentEngine] Stored candidate rule for review (${record.id}); no source code was changed.`);
      return record;
    } catch (e) {
      console.error('[SelfEvolvingAgentEngine] Failed to persist candidate rule:', e.message);
      return null;
    }
  }

  async evolve({ userComplaint, messages }) {
    if (this.isEvolving) {
      return { status: 'BUSY', message: 'Candidate analysis already in progress' };
    }
    this.isEvolving = true;

    try {
      const context = this.extractFailureContext(userComplaint, messages);
      console.log('[SelfEvolvingAgentEngine] Analysing correction and checking supervised-repair eligibility.');

      const analysis = await this.introspectWithNineRouter(context);
      const memoryRecord = await this.persistToMemoryVault(analysis);

      // General complaints never authorize a code change. An explicit request
      // to fix code/system is required, and the proposed repository path must
      // exist locally and pass the path safety check before a repair is queued.
      const complaint = String(userComplaint || '');
      const explicitRepairIntent =
        /\b(perbaiki|perbaikan|koreksi|fix|repair|patch)\b/i.test(complaint) &&
        /\b(kode|script|skrip|source|file|bug|error|jini|diri|sistem|runtime|software|perangkat lunak|ini)\b/i.test(complaint);
      let repairIncident = null;
      let repairQueueError = null;
      let validatedTarget = null;

      if (explicitRepairIntent) {
        validatedTarget = this.validateRepairTarget(analysis.targetSubsystem);
        if (!validatedTarget) {
          repairQueueError = 'Tidak ada file sumber konkret yang terverifikasi; permintaan disimpan sebagai kandidat saja.';
        } else {
          try {
            // Importing EngineeringRuntime activates its listener before the
            // queue emits incident_enqueued. Production is not modified here.
            const [{ engineeringRuntimeInstance }, { incidentQueueInstance }, incidentTypes] = await Promise.all([
              import('./EngineeringRuntime.mjs'),
              import('./queue/IncidentQueue.mjs'),
              import('./types/IncidentTypes.mjs')
            ]);
            const ticket = incidentTypes.createIncidentTicket({
              source: 'self-evolving-agent',
              category: 'CODE_REPAIR_REQUEST',
              errorMessage: String(analysis.identifiedFailure || complaint || 'User-requested code repair').slice(0, 1500),
              targetComponent: validatedTarget,
              severity: incidentTypes.IncidentSeverity.LOW,
              metadata: {
                explicitSelfRepair: true,
                candidateFiles: [validatedTarget],
                rootCause: String(analysis.rootCause || '').slice(0, 1500),
                evolvedRule: String(analysis.evolvedRule || '').slice(0, 1500),
                candidateMemoryId: memoryRecord ? memoryRecord.id : null
              }
            });
            void engineeringRuntimeInstance;
            repairIncident = incidentQueueInstance.enqueue(ticket);
            if (!repairIncident) throw new Error('Incident queue rejected the repair request.');
          } catch (err) {
            repairQueueError = String(err && err.message || err).slice(0, 1000);
          }
        }
      }

      const queued = Boolean(repairIncident);
      const responseMarkdown = [
        '⚙️ **[JINI SELF-IMPROVEMENT // SUPERVISED REPAIR]**',
        'Analisis kegagalan telah dibuat dan kandidat aturan disimpan untuk ditinjau.',
        '',
        '* **Masalah:** ' + String(analysis.identifiedFailure || ''),
        '* **Hipotesis akar masalah:** ' + String(analysis.rootCause || ''),
        '* **File target terverifikasi:** ' + String(validatedTarget || analysis.targetSubsystem || 'UNKNOWN'),
        '* **Kandidat aturan:** ' + String(analysis.evolvedRule || ''),
        '* **Catatan memori:** ' + String(memoryRecord && memoryRecord.id || 'Tidak tersimpan'),
        queued ? '* **ID insiden perbaikan:** ' + repairIncident.incidentId : '',
        queued ? '* **Status:** QUEUED — diagnosis, sandbox, tes regresi, dan build sedang dijadwalkan oleh runtime.' : '',
        repairQueueError ? '* **Tidak dijadwalkan:** ' + repairQueueError : '',
        '',
        '**Batas keselamatan:** kode utama tidak diubah otomatis. Patch dibuat di Git worktree terpisah. Jika tes regresi dan build lulus, siklus berhenti di AWAITING_APPROVAL. Penggabungan memerlukan persetujuan eksplisit dan identitas reviewer; deployment tetap langkah terpisah.',
        '',
        'Status validasi saat respons dibuat: ' + (queued ? 'QUEUED_NOT_YET_VERIFIED' : 'NOT_TESTED') + '.',
        'Saran analisis: ' + String(analysis.suggestedOutput || '')
      ].filter(Boolean).join('\n');

      return {
        status: queued ? 'REPAIR_QUEUED' : (memoryRecord ? 'RULE_PROPOSED' : 'RULE_PROPOSAL_NOT_PERSISTED'),
        analysis,
        memoryRecord,
        repairIncidentId: repairIncident ? repairIncident.incidentId : null,
        repairQueued: queued,
        repairQueueError,
        validationStatus: queued ? 'QUEUED_NOT_YET_VERIFIED' : 'NOT_TESTED',
        runtimePatched: false,
        testsRun: false,
        responseMarkdown
      };
    } finally {
      this.isEvolving = false;
    }
  }
}

export const selfEvolvingAgentEngineInstance = new SelfEvolvingAgentEngine();
export default SelfEvolvingAgentEngine;
