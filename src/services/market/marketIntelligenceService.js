/**
 * marketIntelligenceService.js — frontend client MIE v1 (1 fungsi live).
 * GET /api/market/analyze?symbol=IHSG (same-origin -> fallback :20200).
 * Macro manual: GET/POST /api/market/macro.
 */
function bases() {
  const out = [];
  if (typeof window !== 'undefined' && window.location?.origin) out.push(window.location.origin);
  out.push('http://127.0.0.1:20200');
  return [...new Set(out)];
}

export async function getMarketAnalysis(symbol = 'IHSG') {
  let lastErr = null;
  for (const b of bases()) {
    try {
      const r = await fetch(`${b}/api/market/analyze?symbol=${encodeURIComponent(symbol)}`, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status}`); continue; }
      return await r.json();
    } catch (e) { lastErr = e; }
  }
  return { service: 'MARKET_INTELLIGENCE', ok: false, error: lastErr?.message || 'unreachable' };
}

export async function getMacroSnapshot() {
  for (const b of bases()) {
    try {
      const r = await fetch(`${b}/api/market/macro`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}

export async function saveMacroSnapshot(patch) {
  let lastErr = null;
  for (const b of bases()) {
    try {
      const r = await fetch(`${b}/api/market/macro`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch || {}), signal: AbortSignal.timeout(8000)
      });
      if (r.ok) return await r.json();
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  return { ok: false, error: lastErr?.message || 'unreachable' };
}

export default { getMarketAnalysis, getMacroSnapshot, saveMacroSnapshot };
