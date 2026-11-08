/**
 * goldIntermarketClient.js
 * Client for the FAKTOR UP/DOWN GOLD tab.
 *
 * This layer is intentionally thin: it fetches the server-normalized payload
 * and never fabricates missing prices. On failure it throws so the UI can show
 * UNAVAILABLE / error instead of a simulated fallback.
 */
import { RouterConfig } from '../router/RouterConfig.js';

// Keys that may carry a human-readable string inside provider/error objects.
const DISPLAY_KEYS = ['message', 'reason', 'detail', 'label', 'error', 'status', 'note', 'text'];

/**
 * Convert any value into safe display text.
 *
 * Guarantee: this never returns "[object Object]". Plain objects are inspected
 * for known scalar fields; if none match, the caller's fallback is returned.
 * Rendering an object directly is therefore impossible through this helper.
 */
export function displayText(value, fallback = '—') {
  if (value == null) return fallback;
  const type = typeof value;
  if (type === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (type === 'number') return Number.isFinite(value) ? String(value) : fallback;
  if (type === 'bigint') return value.toString();
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'function' || type === 'symbol') return fallback;
  if (Array.isArray(value)) {
    const parts = value.map((entry) => displayText(entry, '')).filter(Boolean);
    return parts.length ? parts.join(' · ') : fallback;
  }
  if (type === 'object') {
    for (const key of DISPLAY_KEYS) {
      if (value[key] == null || value[key] === value) continue;
      const candidate = displayText(value[key], '');
      if (candidate) return candidate;
    }
    return fallback;
  }
  return fallback;
}

export function errorText(value) {
  if (value == null) return '';
  if (value instanceof Error) return errorText(value.message);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^<(!doctype|html)/i.test(trimmed)) {
      return 'Server mengembalikan HTML, bukan JSON.';
    }
    return trimmed;
  }
  return displayText(value, '');
}

export async function fetchGoldIntermarketFactors({ signal, timeoutMs = 45_000, force = false } = {}) {
  const url = `${RouterConfig.api('/trading/gold-intermarket-factors')}${force ? '?refresh=1' : ''}`;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const response = await fetch(url, {
    method: 'GET',
    signal: combinedSignal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    throw new Error(`Endpoint FAKTOR UP/DOWN GOLD mengembalikan non-JSON (HTTP ${response.status}).`);
  }

  if (response.status === 404) {
    throw new Error(
      'Endpoint FAKTOR UP/DOWN GOLD belum aktif di LocalRouter (HTTP 404). '
      + 'Restart proses LocalRouter agar route /trading/gold-intermarket-factors terdaftar.',
    );
  }
  if (!response.ok || payload?.ok !== true) {
    throw new Error(errorText(payload?.error) || `Gagal memuat faktor intermarket (HTTP ${response.status}).`);
  }
  if (!Array.isArray(payload.instruments) || !payload.analysis) {
    throw new Error(errorText(payload?.error) || 'Format data faktor intermarket tidak valid.');
  }
  return payload;
}

export const GOLD_INTERMARKET_ENDPOINT = '/trading/gold-intermarket-factors';
