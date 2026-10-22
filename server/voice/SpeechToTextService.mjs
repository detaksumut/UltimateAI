/**
 * SpeechToTextService.mjs
 * Real local speech-to-text service for JINI.
 *
 * The former /api/voice/transcribe handler returned an empty transcript without
 * invoking any recognizer. This provider calls a multimodal Gemini model with
 * the recorded audio and reports a clear error if no credential/provider works.
 */

const SUPPORTED_MIME_TYPES = new Set([
  'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff',
  'audio/aac', 'audio/ogg', 'audio/flac', 'audio/m4a', 'audio/mp4',
  'audio/webm', 'audio/opus', 'audio/l16', 'audio/alaw', 'audio/mulaw'
]);
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function collectGeminiKeys() {
  const numbered = Object.entries(process.env)
    .filter(([key, value]) => /^GEMINI_API_KEY_\d+$/.test(key) && typeof value === 'string' && value.trim())
    .sort(([a], [b]) => Number(a.slice('GEMINI_API_KEY_'.length)) - Number(b.slice('GEMINI_API_KEY_'.length)))
    .map(([, value]) => value.trim());
  return [...new Set([
    (process.env.GEMINI_API_KEY || '').trim(),
    ...numbered
  ].filter(value => value && value !== 'undefined'))];
}

function normalizeMimeType(value) {
  const mime = String(value || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('audio/')) {
    throw new Error('STT_UNSUPPORTED_MIME: Input harus berupa audio; received ' + mime);
  }
  if (!SUPPORTED_MIME_TYPES.has(mime)) {
    throw new Error('STT_UNSUPPORTED_MIME: Format audio belum didukung: ' + mime);
  }
  return mime === 'audio/x-wav' ? 'audio/wav' : mime;
}

function parseTranscriptResult(text) {
  const raw = String(text || '').trim();
  if (!raw) return { transcript: '', detectedLanguage: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      transcript: typeof parsed.transcript === 'string' ? parsed.transcript.trim() : '',
      detectedLanguage: typeof parsed.detectedLanguage === 'string' ? parsed.detectedLanguage : null
    };
  } catch {
    return { transcript: raw.replace(/^\s*["'`]|["'`]\s*$/g, '').trim(), detectedLanguage: null };
  }
}

export class SpeechToTextService {
  constructor() {
    this.modelCandidates = [...new Set([
      (process.env.GEMINI_STT_MODEL || '').trim(),
      (process.env.GEMINI_TEXT_MODEL || '').trim(),
      'gemini-3.6-flash',
      'gemini-2.5-flash'
    ].map(value => value.replace(/^models\//, '')).filter(Boolean))];
  }

  async transcribe({ audioBase64, mimeType = 'audio/webm', language = 'id-ID', signal = null } = {}) {
    if (typeof audioBase64 !== 'string' || !audioBase64.trim()) {
      throw new Error('STT_AUDIO_MISSING: No audio payload was provided.');
    }

    let encoded = audioBase64.trim();
    const dataUrlMatch = encoded.match(/^data:audio\/[^;]+;base64,([\s\S]+)$/i);
    if (dataUrlMatch) encoded = dataUrlMatch[1];
    encoded = encoded.replace(/\s+/g, '');

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
      throw new Error('STT_AUDIO_INVALID: Audio payload is not valid base64.');
    }

    const audio = Buffer.from(encoded, 'base64');
    if (audio.length < 500) throw new Error('STT_AUDIO_TOO_SHORT: Audio payload is too small.');
    if (audio.length > MAX_AUDIO_BYTES) throw new Error('STT_AUDIO_TOO_LARGE: Audio must be 15 MB or smaller.');

    const mime = normalizeMimeType(mimeType);
    const keys = collectGeminiKeys();
    if (keys.length === 0) {
      const error = new Error('STT_PROVIDER_NOT_CONFIGURED: Set GEMINI_API_KEY (or GEMINI_API_KEY_1..N) in the local environment.');
      error.code = 'STT_PROVIDER_NOT_CONFIGURED';
      throw error;
    }

    const requestedLanguage = typeof language === 'string' && language.trim() ? language.trim() : 'auto';
    const modelErrors = [];
    for (const model of this.modelCandidates) {
      for (const key of keys) {
        if (signal?.aborted) {
          const error = new Error('STT_ABORTED: Audio transcription was cancelled.');
          error.code = 'STT_ABORTED';
          throw error;
        }
        try {
          const instruction = [
            'Transcribe the attached audio faithfully and verbatim.',
            'Detect the language actually spoken; do not translate the speech.',
            requestedLanguage === 'auto'
              ? 'The requested language is automatic; identify the language from the audio.'
              : 'The user-selected language is ' + requestedLanguage + '; use it as a hint but transcribe what is actually spoken.',
            'Return only JSON with exactly two string fields: detectedLanguage (BCP-47 locale if identifiable, otherwise "unknown") and transcript.',
            'Do not add summaries, commentary, speaker labels, or corrections that change the words.'
          ].join(' ');

          const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) +
              ':generateContent?key=' + encodeURIComponent(key),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [
                    { text: instruction },
                    { inlineData: { mimeType: mime, data: audio.toString('base64') } }
                  ]
                }],
                generationConfig: {
                  temperature: 0,
                  maxOutputTokens: 2048,
                  responseMimeType: 'application/json'
                }
              }),
              signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000)
            }
          );

          if (!response.ok) {
            const details = (await response.text().catch(() => '')).slice(0, 280);
            modelErrors.push(model + ' HTTP ' + response.status + ': ' + details);
            // Rotate key/model for credential, model-availability, quota and upstream errors.
            if ([400, 401, 403, 404, 408, 429].includes(response.status) || response.status >= 500) continue;
            continue;
          }

          const data = await response.json();
          const parts = data?.candidates?.[0]?.content?.parts;
          const text = Array.isArray(parts) ? parts.map(part => part?.text || '').join('\n').trim() : '';
          const result = parseTranscriptResult(text);
          if (!result.transcript) {
            modelErrors.push(model + ' returned an empty transcript.');
            continue;
          }

          return {
            transcript: result.transcript,
            language: result.detectedLanguage || requestedLanguage,
            detectedLanguage: result.detectedLanguage || null,
            requestedLanguage,
            confidence: null,
            provider: 'GEMINI_AUDIO_TRANSCRIPTION',
            model,
            audioBytes: audio.length,
            mimeType: mime
          };
        } catch (err) {
          if (signal?.aborted) throw err;
          modelErrors.push(model + ': ' + String(err?.message || err).slice(0, 220));
        }
      }
    }

    const error = new Error('STT_TRANSCRIPTION_FAILED: No available Gemini model/key completed transcription. ' + modelErrors.slice(-4).join(' | '));
    error.code = 'STT_TRANSCRIPTION_FAILED';
    throw error;
  }
}

export const speechToTextServiceInstance = new SpeechToTextService();
export default speechToTextServiceInstance;
