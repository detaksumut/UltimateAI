/**
 * ResponseNormalizer.mjs
 * TAHAP 3B-2C — Response Normalization.
 *
 * Strips role/meta labels that raw model or tool output may leak into generated
 * text (e.g. `assistant`, `system`, `user`, `model`, `JIN`, `[INST]`, JSON
 * fences), collapses leading whitespace, and repairs accidental double
 * punctuation. It must be applied as early as possible so that responseMessage,
 * detailedDisplay, claims[], finding.claim and evidenceItems[].description are
 * all built from clean text.
 *
 * NEVER touches legitimate content: a phrase such as "AI assistant membantu
 * pengguna." stays untouched because the role label is not a leading token,
 * and deliberate ellipses like "Tunggu..." are preserved.
 */

const ROLE_TOKEN = '(?:assistant|system|user|model|jin)';

export function normalizeModelResponse(text) {
  if (typeof text !== 'string') return text;

  let normalized = text
    // Strip JSON/code fences a raw model narration may wrap around its answer.
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '');

  // Remove standalone role labels at the beginning:
  //   "assistant\n\nHalo"  ->  "Halo"
  normalized = normalized.replace(
    new RegExp(`^[\\s\\u201C\\u201D"']*(${ROLE_TOKEN})\\s*[\\r\\n]+`, 'i'),
    ''
  );

  // Remove chat-style role prefixes (separator is required so a real sentence
  // that merely starts with the word "assistant" is never damaged):
  //   "assistant: Halo" | "system>Halo" | "user - Halo"  ->  "Halo"
  normalized = normalized.replace(
    new RegExp(`^[\\s\\u201C\\u201D"']*(${ROLE_TOKEN})\\s*[:>\\-]\\s*`, 'i'),
    ''
  );

  // Strip [INST] / [/INST] instruction fences.
  normalized = normalized.replace(/^\[\/?INST\]\s*/gi, '');

  // Strip leading/trailing stray quotes.
  normalized = normalized.replace(/^["'\s\u201C\u201D]+/, '').replace(/["'\s\u201C\u201D]+\s*$/, '');

  // Collapse excessive leading whitespace/newlines.
  normalized = normalized.replace(/^\s+/, '');

  // Repair accidental double punctuation. A single double period ".." becomes
  // "."; a deliberate triple-dot ellipsis ("Tunggu...") is left intact.
  normalized = normalized.replace(/(?<!\.)\.{2}(?!\.)/g, '.');

  return normalized.trim();
}

/**
 * Strips trailing sentence punctuation so a composing layer can append its own
 * terminator without producing artifacts like "terpakai..".
 */
export function stripTrailingPunctuation(text) {
  if (typeof text !== 'string') return text;
  return text.trim().replace(/[.!?]{1,}\s*$/u, '');
}

export default normalizeModelResponse;