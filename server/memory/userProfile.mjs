/**
 * userProfile.mjs
 * PERSISTENT USER DISPLAY-NAME / PREFERENCE MEMORY.
 *
 * The 3B local model cannot reliably recall a nickname from chat history alone —
 * profiles vanish as soon as the instruction scrolls out of the context window.
 * This tiny, deterministic store captures "panggil aku <NAMA>" (and friends)
 * from ANY chat turn and persists it; the router then injects it verbatim into
 * the system prompt on EVERY request, so JIN always knows the user's name.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const PROFILE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'user-profile.json');

let profile = {};
try {
  if (fs.existsSync(PROFILE_PATH)) profile = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
} catch { profile = {}; }

function persist() {
  try {
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf8');
  } catch (err) {
    console.warn('[USER_PROFILE] persist failed:', err.message);
  }
}

const NAME_RE = /["']|[,;:!?.\u2026]+/g;

function cleanName(name) {
  let n = String(name || '').replace(NAME_RE, '').replace(/\s+/g, ' ').trim();
  // Trim trailing conversational filler / temporal adverbials ("dong", "ya",
  // "dari sekarang", "mulai sekarang", …) that are NOT part of the name.
  for (let i = 0; i < 3; i++) {
    n = n.replace(/\s+(?:dong|loh|la?h?|ya|yah|oke|ok|okay|baik|deh|dulu|aja|saja|dari|sekarang|mulai|saat\s+ini|hari\s+ini)\s*$/i, '').trim();
  }
  return n.slice(0, 32);
}

// Indonesian + English framing. Captures the FIRST match in priority order.
const NAME_PATTERNS = [
  /\b(?:panggil|manggil|memanggil|dipanggil)\s+(?:aku|saya|gue|gua|gw|aing|saya)\s*(?:dengan\s+|sebagai\s+|as\s+|:|=)?\s*([A-Za-z\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F -]{1,30})/i,
  /\b(?:aku|saya|gue|gua|gw)\s+(?:mau|ingin|minta|lengkap)\s+(?:di)?panggil\s+([A-Za-z\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F -]{1,30})/i,
  /\bnama\s+(?:aku|saya|gue|gua|gw)\s*(?:adalah|:|=|nya)?\s*([A-Za-z\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F -]{1,30})/i,
  /\bcall\s+me\s+([A-Za-z\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F -]{1,30})/i,
  /\bmy\s+name\s+is\s+([A-Za-z\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F -]{1,30})/i
];

/**
 * Scan a user message for a name-call preference and persist it if found.
 * @param {string} text
 * @returns {string|null} newly captured name, or null when nothing changed
 */
export function captureUserProfile(text) {
  if (!text || typeof text !== 'string') return null;
  for (const re of NAME_PATTERNS) {
    const m = re.exec(text);
    if (m && m[1]) {
      const name = cleanName(m[1]);
      if (name.length < 1) continue;
      if (!profile.name || profile.name.toLowerCase() !== name.toLowerCase()) {
        profile.name = name;
        profile.updatedAt = new Date().toISOString();
        persist();
        console.log(`[USER_PROFILE] captured display name "${name}"`);
        return name;
      }
      return null; // already known
    }
  }
  return null;
}

/**
 * Read the profile FRESH from disk on every call so the running server can never
 * serve a stale/cached name (e.g. if the file was seeded or edited externally).
 * The file is authoritative; the in-memory copy is only a cold-start fallback.
 */
export function getUserProfile() {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
      if (parsed && parsed.name) {
        profile.name = parsed.name;
        return { name: parsed.name };
      }
    }
  } catch { /* fall through to cached value */ }
  return { name: (profile && profile.name) || null };
}

export default { captureUserProfile, getUserProfile };