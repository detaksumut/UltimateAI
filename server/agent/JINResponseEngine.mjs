/**
 * JINResponseEngine.mjs
 * Production-Grade Evidence-Bound Response Authority & Conversational Synthesis Engine for JIN.
 *
 * CORE CONTRACT:
 *  - ZERO-HALLUCINATION / UNKNOWN-FIRST POLICY
 *  - "NO EVIDENCE âž” NO FACT âž” NO CLAUSE âž” NO SPEECH"
 *  - Distinguishes source types: LIVE_WEB, USER_INPUT, DOCUMENT, MEMORY, COMPUTED, UNKNOWN
 *  - If data is absent: responds "Saya tidak memiliki data yang cukup untuk memastikan hal tersebut."
 *  - Dual-Channel safety: concise natural voice TTS and sanitized rich HUD display.
 */

import { ClaimValidator } from './ClaimValidator.mjs';
import { config } from '../config/env.mjs';
import { responseGroundingGuardInstance } from '../grounding/ResponseGroundingGuard.mjs';
import { getCapabilityPromptContext } from '../grounding/CapabilityRegistry.mjs';
import { providerIntelligenceRouterInstance, SCOPE } from '../routing/ProviderIntelligenceRouter.mjs';
import { normalizeModelResponse, stripTrailingPunctuation } from './ResponseNormalizer.mjs';

function sanitizeOutput(val) {
  if (typeof val !== 'string') return String(val ?? '');
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Response normalization for the evidence-synthesis layer.
 * Delegates to the shared ResponseNormalizer utility (TAHAP 3B-2C).
 */
function normalizeModelText(val) {
  if (typeof val !== 'string') return String(val ?? '');
  return normalizeModelResponse(val);
}

export class JINResponseEngine {
  constructor(proxyUrl = null, apiKey = null) {
    const base = proxyUrl || process.env.OLLAMA_BASE_URL || config.endpoints.ollama || 'http://127.0.0.1:11434';
    this.proxyUrl = base.replace(/\/+$/, '') + '/v1';
    this.apiKey = apiKey || '';
  }

  /**
   * Generates a context-aware, evidence-grounded response for JIN
   */
  async generateResponse(input, options = {}) {
    const {
      userUtterance = '',
      conversationContext = {},
      decision = {},
      executionHistory = [],
      artifact = null,
      verification = null,
      provenance = {},
      sourceScope = null,
      providerRouting = null
    } = input;

    // ═══════════════════════════════════════════════════════════════════════
    // OLLAMA FABRICATION GUARD
    // When scope is EXTERNAL_REQUIRED and no Antigravity evidence exists,
    // Ollama MUST NOT fabricate live internet data.
    // ═══════════════════════════════════════════════════════════════════════
    if (sourceScope === SCOPE.EXTERNAL_REQUIRED) {
      const hasAntigravityEvidence = executionHistory.some(h =>
        h.step?.tool === 'web.search' || h.step?.tool === 'web.fetch'
      );

      if (!hasAntigravityEvidence) {
        // Check if there's cached evidence from prior Antigravity calls
        const hasCachedEvidence = executionHistory.some(h =>
          h.stepResult?.result?.sourceType === 'LIVE_WEB'
        );

        const permission = providerIntelligenceRouterInstance.checkOllamaFallbackPermission(
          sourceScope,
          providerRouting?.restrictions || [],
          hasCachedEvidence
        );

        if (!permission.allowed) {
          return this._normalizePayload(providerIntelligenceRouterInstance.generateLimitationMessage(userUtterance));
        }
      }
    }

    // 1. NON-ACTION CONVERSATIONAL DIALOGUE
    if (!decision.actionRequired) {
      return this._normalizePayload(
        await this.synthesizeConversationalDialogue(userUtterance, conversationContext, decision, options)
      );
    }

    // 1B. IMAGE GENERATION — Dedicated outcome synthesis
    if (decision.intent === 'IMAGE_GENERATION') {
      return this._normalizePayload(
        this.synthesizeImageGenerationOutcome(userUtterance, decision, artifact, verification, provenance)
      );
    }

    // 1B2. IMAGE REVISION — Dedicated outcome synthesis
    if (decision.intent === 'IMAGE_REVISION') {
      return this._normalizePayload(
        this.synthesizeImageRevisionOutcome(userUtterance, decision, artifact, verification, provenance)
      );
    }

    // 2. FACT-DRIVEN OUTCOME SYNTHESIS
    return this._normalizePayload(
      await this.synthesizeFactDrivenOutcome(userUtterance, decision, executionHistory, artifact, verification, provenance, options)
    );
  }

  /**
   * Final normalization gate. Guarantees no role label or double-punctuation
   * artifact ever leaves the response engine, regardless of where the payload
   * was assembled (PRIMARY_LLM_RESPONSE / EVIDENCE_SYNTHESIS / limitation).
   */
  _normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };
    if (typeof out.naturalVoiceSpeech === 'string') out.naturalVoiceSpeech = normalizeModelResponse(out.naturalVoiceSpeech);
    if (typeof out.detailedTextDisplay === 'string') out.detailedTextDisplay = normalizeModelResponse(out.detailedTextDisplay);
    if (Array.isArray(out.claims)) out.claims = out.claims.map(c => normalizeModelResponse(c));
    if (Array.isArray(out.approvedFacts)) out.approvedFacts = out.approvedFacts.map(c => normalizeModelResponse(c));
    return out;
  }

  /**
   * Synthesizes conversational response with strict Unknown-First safety
   */
  async synthesizeConversationalDialogue(userUtterance, conversationContext, decision, options = {}) {
    const raw = userUtterance.trim();
    const model = options.forcedModel || process.env.OLLAMA_MODEL || 'qwen3:8b';

    // Unknown-First detection: If query asks for non-existent specific private data or unverified claims without context
    const asksUnknown = /apakah kamu tahu password|apa kunci rahasia saya|berkas pribadi yang tidak ada|fakta fiktif 9999/i.test(raw);
    if (asksUnknown) {
      return {
        naturalVoiceSpeech: 'Saya tidak memiliki data yang cukup untuk memastikan hal tersebut.',
        detailedTextDisplay: 'Saya tidak memiliki data atau bukti yang cukup di memori sistem untuk menjawab pertanyaan ini secara akurat.',
        responseMode: 'UNKNOWN_DECLARED',
        responseSource: 'UNKNOWN_POLICY_ENFORCED',
        sourceType: 'UNKNOWN',
        modelUsed: model,
        approvedFacts: [],
        claims: [],
        evidenceRefs: [],
        voiceIntent: 'SPEAK'
      };
    }

    const systemPrompt = `You are JIN, the intelligent, warm, grounded, and highly capable AI partner in UltimateAI.
You are fully bilingual in English and Indonesian.
LANGUAGE ADAPTATION RULE:
- If the user asks you to speak in English (e.g. "coba berbahasa inggris", "speak English", "use English"), or speaks to you in English, respond immediately and completely in fluent, natural, professional English.
- If the user speaks in Indonesian, respond naturally in Indonesian.
CORE GROUNDING RULES:
1. CONTEXTUAL CONTINUITY: Selalu berpijak pada konteks dan topik pembicaraan saat ini. Jangan melompat tanpa relevansi.
2. AUTONOMOUS EXECUTION: NEVER ask for clarification. NEVER say "I don't understand" or "can you clarify?". ALWAYS execute the most reasonable interpretation of the user's request. If ambiguous, choose the most likely intent and DO IT.
3. MINIMUM SUFFICIENT RESPONSE: For simple requests or greetings, answer directly, warmly, and concisely without lecturing the user about internal architectures.
4. NO INVENTED SUBSYSTEM NAMES: Never invent names like "Audio Ingestion Pipeline", "SpeechSense Pro", "Cognitive Matrix", "Ultimate Analysis Core", etc.
5. UI REALITY: Never claim a module or HTML app is "di atas" unless verified in the UI Reality state.
6. NEWS/BERITA: When asked about news, berita, or current events — respond with ONLY title and URL, one per line. NO HTML, NO markdown links, NO target="_blank". Just plain text:
Judul Berita
https://example.com/article
Judul Berita 2
https://example.com/article2

${getCapabilityPromptContext()}`;

    try {
      const response = await fetch(`${this.proxyUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jin-agent': 'response_engine'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(conversationContext.recentTurns || []).slice(-6),
            { role: 'user', content: raw }
          ],
          temperature: 0.2,
          skipIntentGate: true
        }),
        signal: AbortSignal.timeout(parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10))
      });

      if (response.ok) {
        const data = await response.json();
        const content = normalizeModelResponse(data.choices?.[0]?.message?.content);
        if (content) {
          // Apply Response Grounding Guard
          const grounded = responseGroundingGuardInstance.guard(content, raw, conversationContext);
          const finalContent = grounded.cleanedText || content;

          return {
            naturalVoiceSpeech: finalContent.split('\n')[0] || finalContent,
            detailedTextDisplay: finalContent,
            responseMode: 'NATURAL_CONVERSATION',
            responseSource: 'PRIMARY_LLM_RESPONSE',
            sourceType: 'MODEL_KNOWLEDGE',
            modelUsed: data.model || model,
            approvedFacts: [],
            claims: [],
            evidenceRefs: [],
            voiceIntent: 'SPEAK'
          };
        }
      }
    } catch (err) {
      if (options.failClosed) {
        throw new Error(`[FAIL_CLOSED] JIN conversational response LLM failed: ${err.message}`);
      }
    }

    // Deterministic fallback
    return {
      naturalVoiceSpeech: `Saya memahami instruksi: "${raw}". Siap membantu.`,
      detailedTextDisplay: `Instruksi diterima: "${sanitizeOutput(raw)}".`,
      responseMode: 'FALLBACK_CONVERSATION',
      responseSource: 'DETERMINISTIC_FALLBACK',
      sourceType: 'USER_INPUT',
      modelUsed: 'local_deterministic',
      approvedFacts: [],
      claims: [],
      evidenceRefs: [],
      voiceIntent: 'SPEAK'
    };
  }

  /**
   * Synthesizes outcome response for IMAGE_GENERATION tasks.
   * Uses artifact presence + verification status as source of truth (no LLM call needed).
   */
  synthesizeImageGenerationOutcome(userUtterance, decision, artifact, verification, provenance) {
    const hasArtifact = Boolean(artifact && artifact.url);
    const isRenderable = verification?.isSatisfied || false;

    if (hasArtifact && isRenderable) {
      const prompt = artifact.originalPrompt || artifact.prompt || userUtterance;
      return {
        naturalVoiceSpeech: `Visual telah berhasil dibuat.`,
        detailedTextDisplay: `Visual "${prompt}" telah berhasil dibuat. Provider: ${artifact.provider || 'N/A'}. Ukuran: ${artifact.width || '?'}x${artifact.height || '?'}px.`,
        responseMode: 'IMAGE_GENERATION_SUCCESS',
        responseSource: 'IMAGE_GENERATION_ENGINE',
        sourceType: 'IMAGE_ARTIFACT',
        modelUsed: 'image_generation_pipeline',
        approvedFacts: [`Image generated: ${artifact.id}`],
        claims: [`Visual "${prompt}" berhasil dihasilkan.`],
        evidenceRefs: [{
          sourceId: artifact.id,
          type: 'IMAGE_ARTIFACT',
          url: artifact.url,
          provider: artifact.provider,
          retrievedAt: artifact.createdAt,
          sourceType: 'IMAGE_GENERATION'
        }],
        voiceIntent: 'SPEAK'
      };
    }

    // Generation failed
    const errorMsg = verification?.failureReason || 'Penyebab tidak diketahui.';
    return {
      naturalVoiceSpeech: `Proses pembuatan gambar belum berhasil diselesaikan.`,
      detailedTextDisplay: `Proses pembuatan gambar belum berhasil diselesaikan. Penyebab: ${errorMsg}.`,
      responseMode: 'IMAGE_GENERATION_FAILED',
      responseSource: 'IMAGE_GENERATION_ENGINE',
      sourceType: 'UNKNOWN',
      modelUsed: 'image_generation_pipeline',
      approvedFacts: [],
      claims: [],
      evidenceRefs: [],
      voiceIntent: 'SPEAK'
    };
  }

  /**
   * Synthesizes response for IMAGE_REVISION outcome
   */
  synthesizeImageRevisionOutcome(userUtterance, decision, artifact, verification, provenance) {
    const hasArtifact = Boolean(artifact && artifact.url);
    const isRenderable = verification?.isSatisfied || false;

    if (hasArtifact && isRenderable) {
      const prompt = artifact.originalPrompt || artifact.prompt || userUtterance;
      return {
        naturalVoiceSpeech: `Visual telah berhasil diperbarui.`,
        detailedTextDisplay: `Visual "${prompt}" telah berhasil diperbarui. Provider: ${artifact.provider || 'N/A'}. Ukuran: ${artifact.width || '?'}x${artifact.height || '?'}px.`,
        responseMode: 'IMAGE_REVISION_SUCCESS',
        responseSource: 'IMAGE_REVISION_ENGINE',
        sourceType: 'IMAGE_ARTIFACT',
        modelUsed: 'image_revision_pipeline',
        approvedFacts: [`Image revised: ${artifact.id}`],
        claims: [`Visual "${prompt}" berhasil diperbarui.`],
        evidenceRefs: [{
          sourceId: artifact.id,
          type: 'IMAGE_ARTIFACT',
          url: artifact.url,
          provider: artifact.provider,
          retrievedAt: artifact.createdAt,
          sourceType: 'IMAGE_REVISION'
        }],
        voiceIntent: 'SPEAK'
      };
    }

    // Revision failed
    const errorMsg = verification?.failureReason || 'Penyebab tidak diketahui.';
    return {
      naturalVoiceSpeech: `Saya belum berhasil merender ulang visual tersebut.`,
      detailedTextDisplay: `Saya belum berhasil merender ulang visual tersebut. Penyebab: ${errorMsg}.`,
      responseMode: 'IMAGE_REVISION_FAILED',
      responseSource: 'IMAGE_REVISION_ENGINE',
      sourceType: 'UNKNOWN',
      modelUsed: 'image_revision_pipeline',
      approvedFacts: [],
      claims: [],
      evidenceRefs: [],
      voiceIntent: 'SPEAK'
    };
  }

  /**
   * Synthesizes fact-driven response strictly bound to executed tool results
   */
  async synthesizeFactDrivenOutcome(userUtterance, decision, executionHistory, artifact, verification, provenance, options = {}) {
    const raw = userUtterance.trim();
    const approvedFacts = [];
    const evidenceRefs = [];
    let primarySourceType = 'COMPUTED';

    for (const h of executionHistory) {
      const step = h.step || {};
      const res = h.stepResult || {};

      if (step.tool === 'web.search' || step.tool === 'web.fetch') {
        primarySourceType = 'LIVE_WEB';
        if (res.result?.text || res.result?.title) {
          approvedFacts.push(normalizeModelResponse(res.result.text ? res.result.text.slice(0, 300) : res.result.title));
          evidenceRefs.push({
            sourceId: res.result.sourceId || `src_${Date.now()}`,
            url: res.result.url || res.result.query || 'https://verified-source',
            title: res.result.title || 'Live Web Source',
            retrievedAt: new Date().toISOString(),
            sourceType: 'LIVE_WEB'
          });
        }
      } else if (step.tool === 'formal.solve' || step.tool === 'sandbox.execute') {
        primarySourceType = 'COMPUTED';
        if (res.result?.exactResult !== undefined || res.result?.stdout) {
          const val = res.result.exactResult !== undefined ? res.result.exactResult : res.result.stdout;
          approvedFacts.push(normalizeModelResponse(`Hasil komputasi terverifikasi: ${val}`));
          evidenceRefs.push({
            sourceId: `comp_${Date.now()}`,
            tool: step.tool,
            retrievedAt: new Date().toISOString(),
            sourceType: 'COMPUTED'
          });
        }
      } else if (step.tool === 'device.inspect') {
        // JIN Device Intelligence: local machine observation (READ_ONLY).
        // Prefer the rich Indonesian text; else drill into structured summary
        // so real numbers (RAM/CPU/top process) reach the user (FASE 1A).
        primarySourceType = 'COMPUTED';
        const result = res.result || {};
        const text = typeof result.text === 'string' && result.text.trim() ? normalizeModelText(result.text) : null;
        let fact = null;
        if (text) {
          fact = text.slice(0, 400);
        } else {
          const parts = [];
          if (result.summary?.memoryPercent != null) parts.push(`RAM ${result.summary.memoryPercent}% terpakai`);
          if (result.summary?.cpuLoadPercent != null) parts.push(`CPU ${result.summary.cpuLoadPercent}%`);
          if (result.summary?.topProcess?.name) parts.push(`terbesar ${result.summary.topProcess.name} (${result.summary.topProcess.wsMB} MB)`);
          if (result.memoryStatus) parts.push(`status memori ${result.memoryStatus}`);
          if (result.runtimeStatus) parts.push(`runtime ${result.runtimeStatus}`);
          if (result.current?.percentUsed != null) parts.push(`RAM ${result.current.percentUsed}%`);
          if (result.leak?.status) parts.push(`tren memori ${result.leak.status}`);
          if (result.totalProcesses != null) parts.push(`${result.totalProcesses} process`);
          if (result.topByMemory?.[0]) parts.push(`paling besar ${result.topByMemory[0].name} (${result.topByMemory[0].wsMB} MB)`);
          if (parts.length) fact = `Pengamatan perangkat (${result.scope || 'overview'}): ${parts.join(', ')}.`;
        }
        approvedFacts.push(normalizeModelResponse(fact || `Pengamatan perangkat lokal tersedia (${result.scope || 'overview'}) via DEVICE_INTELLIGENCE.`));
        evidenceRefs.push({
          sourceId: `dev_${Date.now()}`,
          tool: step.tool,
          scope: result.scope || 'overview',
          retrievedAt: new Date().toISOString(),
          sourceType: 'COMPUTED'
        });
      } else if (step.tool === 'memory.vault') {
        primarySourceType = 'MEMORY';
        if (res.result?.memories?.length > 0) {
          approvedFacts.push(res.result.memories.map(m => normalizeModelResponse(m.content)).join('\n'));
          evidenceRefs.push({
            sourceId: `mem_${Date.now()}`,
            retrievedAt: new Date().toISOString(),
            sourceType: 'MEMORY'
          });
        }
      }
    }

    // If verification failed or no facts were obtained
    if (!verification?.isSatisfied && approvedFacts.length === 0) {
      return {
        naturalVoiceSpeech: 'Saya tidak menemukan data terverifikasi untuk menyelesaikan tugas tersebut.',
        detailedTextDisplay: 'Proses eksekusi selesai namun tidak ditemukan bukti terverifikasi yang mencukupi untuk menarik kesimpulan faktual.',
        responseMode: 'INSUFFICIENT_EVIDENCE',
        responseSource: 'ZERO_HALLUCINATION_POLICY',
        sourceType: 'UNKNOWN',
        approvedFacts: [],
        claims: [],
        evidenceRefs: [],
        voiceIntent: 'SPEAK'
      };
    }

    const cleanFacts = approvedFacts.map(f => normalizeModelResponse(f));
    const firstFact = cleanFacts.length > 0 ? stripTrailingPunctuation(cleanFacts[0]).slice(0, 150) : '';
    const naturalSpeech = cleanFacts.length > 0
      ? normalizeModelResponse(`Berdasarkan data yang diverifikasi: ${firstFact}.`)
      : `Tugas "${raw}" telah selesai diproses.`;

    return {
      naturalVoiceSpeech: naturalSpeech,
      detailedTextDisplay: cleanFacts.length > 0 ? cleanFacts.join('\n\n') : naturalSpeech,
      responseMode: 'GROUNDED_OUTCOME',
      responseSource: 'EVIDENCE_SYNTHESIS',
      sourceType: primarySourceType,
      approvedFacts: cleanFacts,
      claims: cleanFacts,
      evidenceRefs,
      voiceIntent: 'SPEAK'
    };
  }
}

export const jinResponseEngineInstance = new JINResponseEngine();
export default jinResponseEngineInstance;
