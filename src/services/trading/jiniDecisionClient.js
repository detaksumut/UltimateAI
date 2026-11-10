/**
 * jiniDecisionClient.js
 * Client for the JINI DECISION ENGINE tab.
 *
 * Thin transport layer: it never fabricates values. Unavailable payloads are
 * returned as-is so the panel can render a truthful state; only transport
 * failures throw.
 */
import { RouterConfig } from '../router/RouterConfig.js';
import { displayText, errorText } from './goldIntermarketClient.js';

export { displayText, errorText };

export async function fetchJiniDecision({ signal, timeoutMs = 45_000, force = false, symbol = 'XAUUSD' } = {}) {
  const params = new URLSearchParams();
  if (force) params.set('refresh', '1');
  if (symbol && symbol !== 'XAUUSD') params.set('symbol', symbol);
  const query = params.toString() ? `?${params.toString()}` : '';
  const url = `${RouterConfig.api('/trading/jini-decision')}${query}`;
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

  const body = await response.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (_) {
    throw new Error(`Endpoint JINI DECISION mengembalikan non-JSON (HTTP ${response.status}).`);
  }

  if (response.status === 404) {
    throw new Error(
      'Endpoint JINI DECISION belum aktif di LocalRouter (HTTP 404). '
      + 'Restart proses LocalRouter agar route /trading/jini-decision terdaftar.',
    );
  }
  if (!response.ok) {
    throw new Error(errorText(payload?.error) || `Gagal memuat keputusan JINI (HTTP ${response.status}).`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Format data JINI DECISION tidak valid.');
  }
  return payload;
}

export const JINI_DECISION_ENDPOINT = '/trading/jini-decision';
