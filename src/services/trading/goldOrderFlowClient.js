/**
 * goldOrderFlowClient.js
 * Client for the JIN GOLD ORDER FLOW tab.
 *
 * Thin transport layer: it never fabricates values. UNAVAILABLE payloads are
 * returned as-is so the panel can render a truthful state; only transport
 * failures throw.
 */
import { RouterConfig } from '../router/RouterConfig.js';
import { displayText, errorText } from './goldIntermarketClient.js';

export { displayText, errorText };

export async function fetchGoldOrderFlow({ signal, timeoutMs = 20_000, force = false } = {}) {
  const url = `${RouterConfig.api('/trading/gold-order-flow')}${force ? '?refresh=1' : ''}`;
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
    throw new Error(`Endpoint GOLD ORDER FLOW mengembalikan non-JSON (HTTP ${response.status}).`);
  }

  if (response.status === 404) {
    throw new Error(
      'Endpoint GOLD ORDER FLOW belum aktif di LocalRouter (HTTP 404). '
      + 'Restart proses LocalRouter agar route /trading/gold-order-flow terdaftar.',
    );
  }
  if (!response.ok) {
    throw new Error(errorText(payload?.error) || `Gagal memuat order flow (HTTP ${response.status}).`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Format data GOLD ORDER FLOW tidak valid.');
  }
  return payload;
}

export const GOLD_ORDER_FLOW_ENDPOINT = '/trading/gold-order-flow';
