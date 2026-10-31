/**
 * TransmissionEngine.mjs - MIE v1: makro LIVE -> dampak ke IHSG (audit-friendly)
 *
 * ATURAN: TIDAK ada "PCE turun = IHSG naik".
 * Setiap faktor punya: arah, strength (0..1), confidence (0..1), reasoning, sumber.
 *
 * Rantai transmisi:
 *   Inflasi (PCE/CPI) -> tekanan suku bunga AS -> Fed rate expectation
 *   Fed rate exp -> US Yield -> DXY -> USD/IDR -> IHSG (risk appetite)
 *
 * Output: 6 SKOR TERPISAH (bukan satu "AI SCORE").
 */

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

/**
 * Score makro dari data live.
 * @param {object} macro hasil fetchLiveMacro()
 * @param {object} ctx { dxyChangePct, usdIdrChangePct, us10yChangePct }
 */
export function scoreMacro(macro, ctx = {}) {
  const pick = (id) => macro?.items?.find((i) => i.indicator === id) || null;
  const dxy = ctx.dxyChangePct;
  const usdIdr = ctx.usdIdrChangePct;
  const y10 = ctx.us10yChangePct;

  const factors = [];
  const add = (o) => factors.push(o);

  // 1. Inflasi (PCE + CPI): mendingin vs periode sebelumnya = ruang policies lebih longgar
  for (const it of [pick('PCEPI'), pick('CPIAUCSL')]) {
    if (!it || it.dataStatus !== 'LIVE' || it.changeVsPrev == null) {
      add({
        factor: it?.indicator || 'INFLASI', label: it?.label || 'Inflasi AS',
        impact: 'UNKNOWN', strength: 0, confidence: 0.3,
        reasoning: 'data live tidak tersedia', sourceUrl: it?.sourceUrl || null
      });
      continue;
    }
    const cooling = it.changeVsPrev < 0;
    add({
      factor: it.indicator,
      label: it.label,
      value: it.actual,
      unit: it.unit,
      asOf: it.asOf,
      impact: cooling ? 'POSITIVE' : 'NEGATIVE',
      strength: clamp01(Math.abs(it.changeVsPrev) / 0.6),
      confidence: 0.7,
      reasoning: cooling
        ? `${it.label} ${it.actual}% YoY, turun ${Math.abs(it.changeVsPrev).toFixed(2)} poin -> tekanan inflasi AS mereda`
        : `${it.label} ${it.actual}% YoY, naik ${it.changeVsPrev.toFixed(2)} poin -> tekanan inflasi AS meningkat`,
      dataStatus: it.dataStatus,
      source: it.source,
      sourceUrl: it.sourceUrl
    });
  }

  // 2. NFP
  const nfp = pick('NFP_BLS');
  if (nfp && nfp.dataStatus === 'LIVE' && nfp.changeVsPrev != null) {
    const weak = nfp.changeVsPrev < 0;
    add({
      factor: 'NFP_BLS', label: nfp.label, value: nfp.actual, unit: nfp.unit, asOf: nfp.asOf,
      impact: weak ? 'POSITIVE' : 'NEGATIVE',
      strength: clamp01(Math.abs(nfp.changeVsPrev) / 120),
      confidence: 0.72,
      reasoning: `NFP ${Math.round(nfp.actual).toLocaleString('id-ID')} ribu, ${weak ? 'turun' : 'naik'} ${Math.abs(nfp.changeVsPrev).toFixed(0)} ribu -> ${weak ? 'ekspektasi Fed hawkish berkurang' : 'Fed bisa tetap hawkish'}`,
      dataStatus: nfp.dataStatus, source: nfp.source, sourceUrl: nfp.sourceUrl
    });
  } else {
    add({ factor: 'NFP_BLS', label: nfp?.label || 'NFP', impact: 'UNKNOWN', strength: 0,
      confidence: 0.3, reasoning: nfp?.error || 'NFP live tidak tersedia', sourceUrl: nfp?.sourceUrl || null });
  }

  // 3. Pengangguran
  const unrate = pick('UNRATE');
  if (unrate && unrate.dataStatus === 'LIVE' && unrate.changeVsPrev != null) {
    add({
      factor: 'UNRATE', label: unrate.label, value: unrate.actual, unit: unrate.unit, asOf: unrate.asOf,
      impact: unrate.changeVsPrev > 0 ? 'POSITIVE' : unrate.changeVsPrev < 0 ? 'NEGATIVE' : 'NEUTRAL',
      strength: clamp01(Math.abs(unrate.changeVsPrev) / 0.4),
      confidence: 0.65,
      reasoning: unrate.changeVsPrev > 0
        ? `Pengangguran naik ke ${unrate.actual}% -> kondisi melemah, mendukung policies longgar`
        : `Pengangguran ${unrate.actual}% -> pasar kerja tetap ketat, ruang policies makin sempit`,
      dataStatus: unrate.dataStatus, source: unrate.source, sourceUrl: unrate.sourceUrl
    });
  }

  // 4. Probabilitas kenaikan Fed (live, futures-implied)
  const fed = pick('FED_HIKE_PROB');
  if (fed && fed.dataStatus === 'LIVE' && fed.impliedProbPct != null) {
    const p = fed.impliedProbPct;
    add({
      factor: 'FED_HIKE_PROB', label: fed.label, value: p, unit: fed.unit,
      impact: p < 30 ? 'POSITIVE' : p > 60 ? 'NEGATIVE' : 'NEUTRAL',
      strength: clamp01(Math.abs(p - 50) / 50),
      confidence: 0.65,
      reasoning: `Probabilitas kenaikan Fed (implied) ${p}% vs EFFR ${fed.currentEffr}% -> ${p < 30 ? 'policies longgar, mendukung risk asset' : p > 60 ? 'tetap hawkish, tekanan ke risk asset' : 'netral, pasar masih menunggu'}`,
      dataStatus: fed.dataStatus, source: fed.source, sourceUrl: fed.sourceUrl,
      disclaimer: fed.disclaimer
    });
  } else {
    add({ factor: 'FED_HIKE_PROB', label: 'Probabilitas kenaikan Fed', impact: 'UNKNOWN',
      strength: 0, confidence: 0.3, reasoning: fed?.error || 'Fed Funds Futures tidak tersedia' });
  }

  // 5. US Yield
  const y = pick('DGS10');
  if (y && y.dataStatus === 'LIVE' && Number.isFinite(y10)) {
    add({
      factor: 'DGS10', label: y.label, value: y.actual, unit: y.unit, asOf: y.asOf,
      impact: y10 < -0.05 ? 'POSITIVE' : y10 > 0.05 ? 'NEGATIVE' : 'NEUTRAL',
      strength: clamp01(Math.abs(y10) / 0.25),
      confidence: 0.78,
      reasoning: `US 10Y ${y.actual}% (${y10 >= 0 ? '+' : ''}${y10.toFixed(2)} poin) -> ${y10 < 0 ? 'US Yield turun, emerging market lebih menarik' : 'US Yield naik, emerging market tertinggal'}`,
      dataStatus: y.dataStatus, source: y.source, sourceUrl: y.sourceUrl
    });
  }

  // 6. DXY
  if (Number.isFinite(dxy)) {
    add({
      factor: 'DXY', label: 'US Dollar Index', value: null, unit: 'INDEX',
      impact: dxy < -0.1 ? 'POSITIVE' : dxy > 0.1 ? 'NEGATIVE' : 'NEUTRAL',
      strength: clamp01(Math.abs(dxy) / 1.2), confidence: 0.8,
      reasoning: `DXY ${dxy >= 0 ? '+' : ''}${dxy.toFixed(2)}% -> ${dxy < 0 ? 'tekanan USD ke Rupiah berkurang' : 'USD menguat, risiko outflow naik'}`,
      dataStatus: 'UNAVAILABLE', source: 'Tidak tersedia', sourceUrl: null
    });
  }

  // 7. Rupiah
  if (Number.isFinite(usdIdr)) {
    add({
      factor: 'USDIDR', label: 'USD/IDR', value: null, unit: 'IDR',
      impact: usdIdr < -0.1 ? 'POSITIVE' : usdIdr > 0.1 ? 'NEGATIVE' : 'NEUTRAL',
      strength: clamp01(Math.abs(usdIdr) / 2), confidence: 0.85,
      reasoning: `USD/IDR ${usdIdr >= 0 ? '+' : ''}${usdIdr.toFixed(2)}% -> ${usdIdr < 0 ? 'Rupiah menguat, aset lokal lebih menarik' : 'Rupiah melemah, tekanan outflow'}`,
      dataStatus: 'UNAVAILABLE', source: 'Tidak tersedia', sourceUrl: null
    });
  }

  const known = factors.filter((f) => f.impact !== 'UNKNOWN');
  const posScore = known.filter((f) => f.impact === 'POSITIVE').reduce((a, f) => a + f.strength, 0);
  const negScore = known.filter((f) => f.impact === 'NEGATIVE').reduce((a, f) => a + f.strength, 0);
  const total = known.reduce((a, f) => a + f.strength, 0);

  const verdict = known.length === 0 ? 'WAITING_DATA'
    : posScore > negScore ? 'POSITIVE'
      : negScore > posScore ? 'NEGATIVE' : 'MIXED';

  return {
    verdict,
    netStrength: Number((posScore - negScore).toFixed(3)),
    magnitude: Number(total.toFixed(3)),
    macroScore: Math.round(clamp01((posScore + 1) / (posScore + negScore + 2)) * 100),
    knownCount: known.length,
    unknownCount: factors.length - known.length,
    factors,
    rule: 'Kesimpulan makro TIDAK otomatis = bullish IHSG. Butuh konfirmasi price action + foreign flow.',
    dataStatus: known.length === factors.length ? 'LIVE' : known.length > 0 ? 'PARTIAL' : 'UNAVAILABLE'
  };
}

/** 6 skor terpisah untuk audit. Tidak ada satu "AI SCORE" tunggal. */
export function buildScores({ macroScore, technical, flow, state }) {
  const rsi14 = technical?.rsi14;
  const momentum = rsi14 == null ? 50
    : rsi14 >= 70 ? 30 : rsi14 <= 30 ? 70 : Math.round(50 + (rsi14 - 50) * 0.8);

  const tech = technical?.trend === 'UPTREND' ? 70
    : technical?.trend === 'DOWNTREND' ? 30
      : rsi14 != null && rsi14 > 50 ? 55 : 45;

  const flowDir = String(flow?.direction || 'UNKNOWN').toUpperCase();
  const flowScore = flowDir === 'BUY' ? 70 : flowDir === 'SELL' ? 30 : 50;
  const sent = Math.round(macroScore * 0.6 + tech * 0.4);
  const risk = Math.round(Math.max(0, Math.min(100,
    100 - (state === 'BULLISH_TREND' ? 25 : state === 'REBOUND_WATCH' ? 50 : 75))));

  return {
    MACRO: { score: Math.round(macroScore), basis: 'PCE/CPI/NFP/Unrate/FedProb/Yield/DXY/USDIDR live' },
    TECHNICAL: { score: Math.round(tech), basis: `trend=${technical?.trend || '?'}, RSI14=${rsi14 != null ? rsi14.toFixed(1) : '?'}` },
    FLOW: { score: flowScore, basis: `foreign flow = ${flowDir}`, honest: flowDir === 'UNKNOWN' },
    MOMENTUM: { score: Math.round(momentum), basis: `RSI14 = ${rsi14 != null ? rsi14.toFixed(1) : '?'}` },
    SENTIMENT: { score: sent, basis: 'gabungan macro (60%) + technical (40%)' },
    RISK: { score: risk, basis: '100 dikurangi tingkat kepastian state; makin tinggi = makin berisiko' },
    note: 'Enam skor terpisah. Tidak ada satu "AI SCORE" yang tidak dapat diaudit.'
  };
}

export default { scoreMacro, buildScores };
