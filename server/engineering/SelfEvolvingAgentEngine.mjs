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

    // Harus ada riwayat pesan sebelumnya agar bisa disebut 'koreksi atas kegagalan sebelumnya'
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
      '2. Identifikasi subsistem/script target yang bermasalah (contoh: YouTubeSongSearch.mjs, documentReader.js, DocumentPipelineAdapter, SemanticIntentEngine, UI Canvas, Player Embed).',
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
      console.log(`[SelfEvolvingAgentEngine] Preparing an unverified correction candidate for: "${userComplaint}"`);

      const analysis = await this.introspectWithNineRouter(context);
      const memoryRecord = await this.persistToMemoryVault(analysis);

      const responseMarkdown = [
        '⚙️ **[JINI SELF-IMPROVEMENT // CANDIDATE PROPOSAL]**',
        'Saya telah menyusun kandidat aturan berdasarkan laporan kegagalan dan menyimpannya untuk ditinjau.',
        '',
        `* **Masalah yang dilaporkan:** ${analysis.identifiedFailure}`,
        `* **Hipotesis akar masalah:** ${analysis.rootCause}`,
        `* **Subsistem yang perlu diperiksa:** ${analysis.targetSubsystem}`,
        `* **Kandidat aturan:** ${analysis.evolvedRule}`,
        `* **Status validasi:** ${analysis.validationStatus || 'NOT_TESTED'}`,
        `* **Catatan memori:** ${memoryRecord?.id || 'Tidak tersimpan'}`,
        '',
        '**Penting:** siklus ini tidak mengubah kode, tidak menjalankan tes, dan tidak membuktikan masalah telah diperbaiki. Kandidat harus diuji dan disetujui melalui alur perbaikan yang terkontrol sebelum dipromosikan menjadi aturan tervalidasi.',
        '',
        `Saran lanjutan (belum dieksekusi): ${analysis.suggestedOutput}`
      ].join('\n');

      return {
        status: memoryRecord ? 'RULE_PROPOSED' : 'RULE_PROPOSAL_NOT_PERSISTED',
        analysis,
        memoryRecord,
        validationStatus: 'NOT_TESTED',
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
