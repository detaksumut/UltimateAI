/**
 * ResponseGroundingGuard.js (v2.1 - Non-Blocking, Traced & Positive-Evidence Grounding Guard)
 *
 * CORE CONTRACT:
 * - POSITIVE EVIDENCE WHITELIST: Only verified entities in VERIFIED_SYSTEM_ENTITIES pass through.
 * - LINEAR NON-BACKTRACKING REGEX: Prevents catastrophic regex stalls on long text.
 * - IDEMPOTENCY / MAX_PASSES: Guarantees 1 single pass (no recursive loops).
 * - FULL RUNTIME TRACEABILITY: Outputs millisecond timestamps for each sub-stage.
 */

import { isCapabilityAvailable, isVerifiedSystemEntity } from './CapabilityRegistry.js';
import { uiStateResolverInstance } from './UIStateResolver.js';

// Linear bounded structural regex (strictly no nested unbounded quantifiers to prevent ReDoS)
const STRUCTURAL_SYSTEM_NAME_PATTERN = /\b([A-Z][a-zA-Z0-9]{1,30}(?:\s+[A-Z][a-zA-Z0-9]{1,30}){0,4}\s+(?:Pipeline|Engine|Matrix|Core|Nexus|Platform|Architecture|Suite|Subsystem|Processor|Synthesizer|Pro|Enterprise|Studio|Protocol|Network)(?:\s+(?:v\d+|[0-9]+(?:\.[0-9]+)*|Plus|Max|Ultra))?)\b/g;

// Generalized Phantom UI Patterns
const PHANTOM_UI_PATTERNS = [
  /\(HTML App di Atas\)/gi,
  /HTML App di Atas/gi,
  /modul\s+[A-Za-z0-9\s]+(?:\s+di\s+atas)/gi,
  /aplikasi\s+di\s+atas/gi,
  /modul\s+di\s+atas/gi,
  /tombol\s+[A-Za-z0-9\s]+\s+di\s+bawah/gi
];

export class ResponseGroundingGuard {
  constructor() {
    this.uiResolver = uiStateResolverInstance;
    this.MAX_GROUNDING_PASSES = 1;
  }

  /**
   * Evaluates text against Positive Whitelists & Evidence Registers.
   * Fully traced with microsecond timestamps.
   */
  guard(rawResponse, userPrompt = '', context = {}) {
    const startTime = performance.now();
    const isoNow = () => new Date().toISOString();

    if (!rawResponse || typeof rawResponse !== 'string') {
      return { cleanedText: '', violationsDetected: [], isGrounded: true };
    }

    // Idempotency: If already guarded, return immediately
    if (context._isGuarded) {
      return { cleanedText: rawResponse, violationsDetected: [], isGrounded: true };
    }

    console.log(`[TRACE] ${isoNow()} | ENTITY_VALIDATION_START | InputLength: ${rawResponse.length}`);

    const violations = [];
    let text = rawResponse;
    const cleanUserPrompt = (userPrompt || '').trim().toLowerCase();

    // =========================================================================
    // 1. MINIMUM SUFFICIENT RESPONSE CALIBRATION (Direct answers for simple prompts)
    // =========================================================================
    const isSimpleAudioRequest = /^(?:saya\s+mau\s+)?(?:tolong\s+)?transkripsi(?:\s+kan)?\s+audio(?:\s+ini)?$/i.test(cleanUserPrompt) ||
                                 /^(?:bisa\s+)?transkrip(?:\s+kan)?\s+audio\??$/i.test(cleanUserPrompt) ||
                                 /^(?:mau\s+)?upload\s+audio$/i.test(cleanUserPrompt);

    if (isSimpleAudioRequest && text.length > 250 && !text.includes('```')) {
      violations.push({
        type: 'OVERENGINEERED_RESPONSE_CALIBRATED',
        detail: 'Calibrated multi-paragraph explanation into direct response for simple audio request.'
      });
      console.log(`[TRACE] ${isoNow()} | GROUNDING_DONE | Elapsed: ${(performance.now() - startTime).toFixed(2)}ms (Calibrated Simple Response)`);
      return {
        cleanedText: 'Bisa. Silakan upload file audionya saja, nanti JIN bantu transkripsikan.',
        violationsDetected: violations,
        isGrounded: true
      };
    }

    if (/^silakan\s+upload\s+audio|^silakan\s+unggah\s+audio/i.test(cleanUserPrompt)) {
      violations.push({
        type: 'REDUNDANT_SYSTEM_EXPLANATION_CALIBRATED',
        detail: 'Normalized upload prompt.'
      });
      console.log(`[TRACE] ${isoNow()} | GROUNDING_DONE | Elapsed: ${(performance.now() - startTime).toFixed(2)}ms (Normalized Upload Prompt)`);
      return {
        cleanedText: 'Silakan upload file audionya.',
        violationsDetected: violations,
        isGrounded: true
      };
    }

    // =========================================================================
    // 2. POSITIVE-LIST VERIFICATION: Generalized System Entity Interceptor
    // =========================================================================
    text = text.replace(STRUCTURAL_SYSTEM_NAME_PATTERN, (match, entityName) => {
      const cleanEntity = entityName.trim();

      if (isVerifiedSystemEntity(cleanEntity)) {
        return cleanEntity;
      }

      violations.push({
        type: 'UNVERIFIED_SYSTEM_NAME_INTERCEPTED',
        interceptedName: cleanEntity,
        reason: 'Entity not found in positive authorization whitelist'
      });

      if (/Audio|Speech|Voice|Sound/i.test(cleanEntity)) {
        return 'fitur audio';
      } else if (/Document|PDF|Text|Knowledge/i.test(cleanEntity)) {
        return 'fitur analisis dokumen';
      }
      return 'fitur sistem';
    });

    text = text.replace(/Sistem\s+fitur\s+audio\s+aktif\s+dan\s+siap\s+menerima\s+berkas\s+Anda\./gi, 'Saya siap menerima dan memproses berkas audio Anda.');
    text = text.replace(/fitur\s+audio\s+aktif\s+dan\s+siap/gi, 'Saya siap');
    text = text.replace(/Sistem\s+fitur\s+analisis\s+dokumen\s+telah\s+membedah/gi, 'Saya telah membaca dan menganalisis');

    console.log(`[TRACE] ${isoNow()} | ENTITY_VALIDATION_DONE | Intercepted: ${violations.filter(v => v.type === 'UNVERIFIED_SYSTEM_NAME_INTERCEPTED').length}`);

    // =========================================================================
    // 3. UI REALITY & FRESHNESS GUARD (Strict Sandbox App Verification)
    // =========================================================================
    const isAppActive = this.uiResolver.isAppActive();
    if (!isAppActive) {
      for (const pattern of PHANTOM_UI_PATTERNS) {
        if (pattern.test(text)) {
          violations.push({
            type: 'PHANTOM_UI_REFERENCE_REMOVED',
            pattern: pattern.toString(),
            detail: 'Referenced UI coordinates when no sandbox app is confirmed running'
          });
          text = text.replace(pattern, '');
        }
      }
    }

    text = text.replace(/Gunakan\s+Modul\s*\(\s*\)\.\.\./gi, '');
    text = text.replace(/Gunakan\s+Modul\s*\.\.\./gi, '');
    text = text.replace(/\n\s*[-*]\s*\n/g, '\n');

    console.log(`[TRACE] ${isoNow()} | UI_VALIDATION_DONE | AppActive: ${isAppActive}`);

    // =========================================================================
    // 4. DYNAMIC CAPABILITY CLAIM & EVIDENCE VERIFIER
    // =========================================================================
    console.log(`[TRACE] ${isoNow()} | CAPABILITY_CHECK_START`);

    if (/bisa\s+bedakan\s+pembicara|bisa\s+diarization|bisa\s+speaker\s+diarization|pisahkan\s+suara\s+orang/i.test(cleanUserPrompt)) {
      if (!isCapabilityAvailable('speaker_diarization')) {
        violations.push({
          type: 'UNSUPPORTED_CAPABILITY_PROMISE_PREVENTED',
          feature: 'speaker_diarization',
          evidenceStatus: 'VERIFIED_UNAVAILABLE'
        });
        console.log(`[TRACE] ${isoNow()} | CAPABILITY_CHECK_DONE | Diarization Rejected`);
        return {
          cleanedText: 'Saat ini JIN belum dapat memastikan pemisahan pembicara (diarization) secara otomatis. Namun JIN dapat mentranskripsikan seluruh isi ucapan audio ke dalam teks.',
          violationsDetected: violations,
          isGrounded: true
        };
      }
    }

    if (/berapa\s+jumlah\s+pembicara|bisa\s+hitung\s+berapa\s+orang\s+bicara/i.test(cleanUserPrompt)) {
      if (!isCapabilityAvailable('multi_speaker_count_detection')) {
        violations.push({
          type: 'UNSUPPORTED_CAPABILITY_PROMISE_PREVENTED',
          feature: 'multi_speaker_count_detection',
          evidenceStatus: 'VERIFIED_UNAVAILABLE'
        });
        console.log(`[TRACE] ${isoNow()} | CAPABILITY_CHECK_DONE | Speaker Count Rejected`);
        return {
          cleanedText: 'Saat ini JIN belum dapat menghitung jumlah pembicara secara otomatis dari rekaman audio.',
          violationsDetected: violations,
          isGrounded: true
        };
      }
    }

    if (/bisa\s+ambil\s+audio\s+dari\s+link|bisa\s+dari\s+url\s+youtube/i.test(cleanUserPrompt)) {
      if (!isCapabilityAvailable('url_audio_ingestion')) {
        violations.push({
          type: 'UNSUPPORTED_CAPABILITY_PROMISE_PREVENTED',
          feature: 'url_audio_ingestion',
          evidenceStatus: 'VERIFIED_UNAVAILABLE'
        });
        console.log(`[TRACE] ${isoNow()} | CAPABILITY_CHECK_DONE | URL Audio Rejected`);
        return {
          cleanedText: 'Saat ini tautan audio web eksternal belum dapat diproses secara langsung. Silakan unduh dan unggah berkas audionya.',
          violationsDetected: violations,
          isGrounded: true
        };
      }
    }

    if (!isCapabilityAvailable('speaker_diarization')) {
      if (/diarization\s+pembicara|pemisahan\s+pembicara\s+otomatis/i.test(text)) {
        violations.push({
          type: 'UNVERIFIED_CLAIM_STRIPPED',
          claim: 'diarization pembicara'
        });
        text = text.replace(/,\s*diarization\s+pembicara/gi, '');
        text = text.replace(/diarization\s+pembicara/gi, 'transkripsi isi percakapan');
      }
    }

    console.log(`[TRACE] ${isoNow()} | CAPABILITY_CHECK_DONE`);

    text = text.replace(/\n{3,}/g, '\n\n').trim();

    const elapsed = (performance.now() - startTime).toFixed(2);
    console.log(`[TRACE] ${isoNow()} | GROUNDING_DONE | TotalDuration: ${elapsed}ms | Violations: ${violations.length}`);

    return {
      cleanedText: text,
      violationsDetected: violations,
      isGrounded: true
    };
  }
}

export const responseGroundingGuardInstance = new ResponseGroundingGuard();
export default responseGroundingGuardInstance;
