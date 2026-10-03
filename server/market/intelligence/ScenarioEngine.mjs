/**
 * ScenarioEngine.mjs — MIE v1 Tahap 1
 * Pure rules: bullish / sideways / bearish scenarios for IHSG-style indices.
 * Thresholds explicit, no hidden magic. Confirmation levels from swing S/R.
 */

export function buildScenarios({ lastClose, support, resistance, rsi14, fxTailwind, flowDirection }) {
  const s = Array.isArray(support) ? support : [];
  const r = Array.isArray(resistance) ? resistance : [];
  const r1 = r[0] ?? null;
  const r2 = r[1] ?? null;
  const r3 = r[2] ?? null;
  const s1 = s[0] ?? null;
  const s2 = s[1] ?? null;
  const s3 = s[2] ?? null;

  const oversold = rsi14 != null && rsi14 <= 30;
  const flowBuy = String(flowDirection || '').toUpperCase() === 'BUY';

  const bullish = {
    id: 'BULLISH_REBOUND',
    trigger: r1 != null ? `Reclaim ${fmt(r1)} + volume di atas rata-rata + foreign net buy` : 'Reclaim resistance pertama + volume + foreign net buy',
    path: [r1, r2, r3].filter((v) => v != null),
    conditions: [
      r1 != null ? `close > ${fmt(r1)}` : 'close > resistance pertama',
      'volume confirmation',
      'foreign flow net buy',
      fxTailwind ? 'rupiah menguat (tailwind)' : 'fx tidak menjadi hambatan'
    ],
    confidence: oversold && flowBuy ? 0.62 : oversold ? 0.55 : 0.48,
    note: 'Rebound butuh konfirmasi price action + foreign flow. Bukan otomatis reversal.'
  };

  const sideways = {
    id: 'SIDEWAYS',
    trigger: `Konsolidasi antara ${s1 != null ? fmt(s1) : '?'} - ${r2 != null ? fmt(r2) : r1 != null ? fmt(r1) : '?'}`,
    range: [s1, r1].filter((v) => v != null),
    conditions: ['volume normal', 'foreign flow mixed'],
    confidence: 0.5,
    note: 'Rebound terbatas bila resistance pertama gagal direclaim dengan volume.'
  };

  const bearish = {
    id: 'BEARISH_CONTINUATION',
    trigger: s2 != null ? `Breakdown di bawah ${fmt(s2)}` : s1 != null ? `Breakdown di bawah ${fmt(s1)}` : 'Breakdown support',
    path: [s1, s2, s3].filter((v) => v != null),
    conditions: [
      s1 != null ? `close < ${fmt(s1)}` : 'close < support pertama',
      'volume di atas rata-rata (distribusi)',
      'foreign flow net sell'
    ],
    confidence: 0.55,
    note: 'Downside confirmation bila support jebol + flow sell.'
  };

  return { bullish, sideways, bearish };
}

export function detectMarketState({ lastClose, sma20, rsi14, support, resistance }) {
  const r1 = Array.isArray(resistance) && resistance[0] != null ? resistance[0] : null;
  const s1 = Array.isArray(support) && support[0] != null ? support[0] : null;
  const aboveSMA = sma20 != null && lastClose != null ? lastClose > sma20 : null;
  if (r1 != null && lastClose != null && lastClose > r1 && aboveSMA) return 'BULLISH_TREND';
  if (s1 != null && lastClose != null && lastClose < s1) return 'BEARISH';
  if (rsi14 != null && rsi14 <= 30) return 'REBOUND_WATCH';
  return 'REBOUND_WATCH';
}

function fmt(v) {
  try {
    return Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  } catch { return String(v); }
}

export default { buildScenarios, detectMarketState };
