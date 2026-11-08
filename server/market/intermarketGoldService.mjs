/**
 * intermarketGoldService.mjs
 * Normalization + statistics for the FAKTOR UP/DOWN GOLD tab.
 *
 * Separation of concerns:
 *  - intermarketProviders.mjs : network / provider adapters
 *  - this file                : unit normalization, trend, correlation, bias
 *  - FaktorUpDownGoldPanel    : presentation only
 *
 * Integrity:
 *  - No hardcoded live values and no simulated fallback.
 *  - Yield changes are expressed as percentage points (pp), never as ordinary
 *    price percentage returns.
 *  - Correlations are relationships, not proof of causation.
 *  - If a core instrument or the gold baseline is unavailable, the result is
 *    INSUFFICIENT DATA instead of a fabricated conclusion.
 */

import {
  fetchFredSeries,
  fetchYahooChart,
  FRED_SERIES,
  YAHOO_TICKERS,
} from './intermarketProviders.mjs';
import { fetchBinanceCryptoSnapshot } from './binanceProviders.mjs';
import {
  alignCryptoWithBias,
  buildCryptoRiskSentiment,
  CRYPTO_CALC_VERSION,
  CRYPTO_GROUP,
} from './cryptoRiskSentiment.mjs';

export const CALC_VERSION = 'gold-intermarket-v2';
export const MIN_CORRELATION_PAIRS = 20;
export const MIN_ABS_CORRELATION = 0.15;
export const BIAS_THRESHOLD = 0.12;
// Correlations use the most recent window so a stale regime cannot dominate.
export const CORRELATION_WINDOW_DAYS = 180;
export const H4_CORRELATION_WINDOW_BARS = 180;
export const ROLE_MULTIPLIER = { CORE: 1.2, CONFIRMATION: 1, CONDITIONAL: 0.8 };
// A quote is only marked LIVE when the provider reports an open regular
// session AND the timestamp is very fresh. Yahoo is a public feed, so this is
// deliberately conservative; everything older stays DELAYED/STALE.
export const LIVE_WINDOW_MS = 10 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export const INSTRUMENT_DEFS = [
  {
    id: 'dxy',
    symbol: 'DXY',
    label: 'US Dollar Index',
    kind: 'price',
    unit: 'index',
    provider: 'yahoo',
    ticker: YAHOO_TICKERS.DXY,
    role: 'CORE',
    influenceGroup: 'USD',
  },
  {
    id: 'us10y',
    symbol: 'US10Y',
    label: 'US 10Y Treasury Yield',
    kind: 'yield',
    unit: 'percent',
    provider: 'yahoo',
    ticker: YAHOO_TICKERS.US10Y,
    role: 'CONFIRMATION',
    influenceGroup: 'RATES',
  },
  {
    id: 'us10y_real',
    symbol: 'US10Y_REAL',
    label: 'US 10Y Real Yield (TIPS)',
    kind: 'yield',
    unit: 'percent',
    provider: 'fred',
    series: FRED_SERIES.US10Y_REAL,
    dailyOnly: true,
    role: 'CORE',
    influenceGroup: 'RATES',
  },
  {
    id: 'us02y',
    symbol: 'US02Y',
    label: 'US 2Y Treasury Yield',
    kind: 'yield',
    unit: 'percent',
    provider: 'fred',
    series: FRED_SERIES.US02Y,
    dailyOnly: true,
    role: 'CONFIRMATION',
    influenceGroup: 'RATES',
  },
  {
    id: 'wti',
    symbol: 'WTI',
    label: 'WTI Crude Oil',
    kind: 'price',
    unit: 'usd_per_bbl',
    provider: 'yahoo',
    ticker: YAHOO_TICKERS.WTI,
    role: 'CONDITIONAL',
    influenceGroup: 'OIL',
  },
];

export const GOLD_BASELINE_DEF = {
  id: 'gold',
  symbol: 'XAUUSD',
  label: 'Gold futures GC=F (proxy XAUUSD)',
  kind: 'price',
  unit: 'usd_per_oz',
  provider: 'yahoo',
  ticker: YAHOO_TICKERS.GOLD_FUTURES,
  // No free XAUUSD spot feed is wired yet; GC=F is used as an explicit proxy
  // and labelled as such in the UI. It is never presented as spot XAUUSD.
  proxy: 'GC=F',
};

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return null;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

function dedupePoints(points) {
  const map = new Map();
  for (const point of points) {
    if (!point?.key || !Number.isFinite(point.value)) continue;
    map.set(point.key, point);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function changeOf(previous, value, kind) {
  if (!Number.isFinite(previous) || !Number.isFinite(value)) return null;
  if (kind === 'yield') return value - previous;
  if (previous === 0) return null;
  return (value - previous) / previous;
}

export function buildChanges(points, kind) {
  const changes = [];
  for (let index = 1; index < points.length; index += 1) {
    const change = changeOf(points[index - 1].value, points[index].value, kind);
    if (change == null) continue;
    changes.push({ key: points[index].key, date: points[index].date, value: points[index].value, change });
  }
  return changes;
}

export function computeTrend(values, minBars = 20) {
  if (!Array.isArray(values) || values.length < minBars) {
    return { trend: 'UNKNOWN', available: false, basis: `Butuh minimal ${minBars} candle (tersedia ${values?.length || 0}).` };
  }
  const recent = average(values.slice(-5));
  const prior = average(values.slice(-20, -5));
  if (!Number.isFinite(recent) || !Number.isFinite(prior) || prior === 0) {
    return { trend: 'UNKNOWN', available: false, basis: 'Rata-rata harga tidak dapat dihitung.' };
  }
  const ratio = (recent - prior) / Math.abs(prior);
  const trend = ratio > 0.001 ? 'BULLISH' : ratio < -0.001 ? 'BEARISH' : 'SIDEWAYS';
  return {
    trend,
    available: true,
    ratio,
    basis: 'Rata-rata 5 candle terakhir vs 15 candle sebelumnya.',
  };
}

function computeSummary(points, kind, minBars = 20) {
  const values = points.map((point) => point.value);
  const last = values.at(-1);
  const previous = values.at(-2);
  const seriesChange = kind === 'yield'
    ? (Number.isFinite(last) && Number.isFinite(previous) ? last - previous : null)
    : (Number.isFinite(last) && Number.isFinite(previous) && previous !== 0 ? ((last - previous) / previous) * 100 : null);
  const change5 = values.length >= 6
    ? (kind === 'yield'
      ? values.at(-1) - values.at(-6)
      : (values.at(-6) !== 0 ? ((values.at(-1) - values.at(-6)) / values.at(-6)) * 100 : null))
    : null;
  const trend = computeTrend(values, minBars);
  return {
    ...trend,
    available: trend.available,
    last: Number.isFinite(last) ? last : null,
    previous: Number.isFinite(previous) ? previous : null,
    change: Number.isFinite(seriesChange) ? seriesChange : null,
    changeUnit: kind === 'yield' ? 'pp' : 'percent',
    change5: Number.isFinite(change5) ? change5 : null,
    bars: values.length,
    lastAt: points.at(-1)?.date || null,
  };
}

export function classifyStatus({
  hasData,
  updatedAt,
  now = Date.now(),
  // 3 days covers a normal weekend so Friday's close is still DELAYED on
  // Monday morning, not prematurely STALE.
  delayedDays = 3,
  staleDays = 10,
  liveWindowMs = 0,
  marketState = null,
}) {
  if (!hasData) return 'UNAVAILABLE';
  const time = new Date(updatedAt || 0).getTime();
  if (!Number.isFinite(time) || time <= 0) return 'STALE';
  const ageMs = Math.max(0, now - time);
  const sessionOpen = marketState == null || marketState === 'REGULAR';
  if (liveWindowMs > 0 && ageMs <= liveWindowMs && sessionOpen) return 'LIVE';
  const ageDays = ageMs / DAY_MS;
  if (ageDays <= delayedDays) return 'DELAYED';
  if (ageDays <= staleDays) return 'STALE';
  return 'STALE';
}

export function statusDetailFor(status, { updatedAt, marketState } = {}) {
  if (status === 'UNAVAILABLE') return 'Provider tidak mengembalikan nilai yang dapat divalidasi.';
  if (status === 'LIVE') return `Sesi pasar reguler; timestamp ${updatedAt || 'tidak tersedia'} masih segar.`;
  if (status === 'DELAYED') return `Data publik/tertunda; timestamp ${updatedAt || 'tidak tersedia'}.`;
  if (status === 'STALE') {
    return marketState && marketState !== 'REGULAR'
      ? `Pasar ${marketState}; data tidak diperbarui.`
      : `Data sudah usang; timestamp ${updatedAt || 'tidak tersedia'}.`;
  }
  return 'Status tidak diketahui.';
}

export function validateInstrument(instrument) {
  const warnings = [];
  const hasData = Boolean(instrument)
    && Number.isFinite(instrument.latest)
    && Array.isArray(instrument.dailyPoints)
    && instrument.dailyPoints.length > 0;

  if (!hasData) warnings.push('Nilai terbaru tidak tersedia dari provider.');
  if (!instrument?.updatedAt || !Number.isFinite(new Date(instrument.updatedAt).getTime())) {
    warnings.push('Timestamp sumber tidak valid atau tidak tersedia.');
  }
  if (!instrument?.provider) warnings.push('Sumber data tidak tercatat.');
  if (!['percent', 'index', 'usd_per_bbl', 'usd_per_oz'].includes(instrument?.unit)) {
    warnings.push(`Satuan tidak dikenal: ${instrument?.unit ?? 'null'}.`);
  }
  if (instrument?.kind === 'yield' && instrument.changeUnit !== 'pp') {
    warnings.push('Perubahan yield tidak dinyatakan dalam percentage point.');
  }
  if (instrument?.kind === 'price' && instrument.changeUnit !== 'price') {
    warnings.push('Perubahan harga tidak dinyatakan dalam unit harga.');
  }

  const lastClose = instrument?.dailyPoints?.at(-1)?.value;
  if (Number.isFinite(instrument?.latest) && Number.isFinite(lastClose)) {
    const difference = Math.abs(instrument.latest - lastClose);
    const tolerance = instrument.kind === 'yield'
      ? 0.5
      : Math.abs(lastClose) * 0.03;
    if (difference > tolerance) {
      warnings.push(`Harga meta (${instrument.latest}) berbeda dari close candle terakhir (${lastClose}).`);
    }
  }
  if (hasData && !Number.isFinite(instrument.change)) {
    warnings.push('Perubahan harian tidak dapat dihitung karena baseline tidak tersedia.');
  }

  return { ok: hasData && warnings.length === 0, hasData, warnings };
}

function toDailyPoints(candles) {
  return dedupePoints(candles.map((candle) => ({
    key: isoDate(candle.timestamp),
    date: isoDate(candle.timestamp),
    value: candle.close,
  })).filter((point) => point.key));
}

function toH4Points(candles) {
  return dedupePoints(candles.map((candle) => ({
    key: candle.timestamp,
    date: candle.timestamp,
    value: candle.close,
  })));
}

export function normalizeYahooInstrument(def, d1, h4, now = Date.now()) {
  const dailyPoints = d1?.ok ? toDailyPoints(d1.candles) : [];
  const h4Points = h4?.ok ? toH4Points(h4.candles) : [];
  const dailyChanges = buildChanges(dailyPoints, def.kind);
  const h4Changes = buildChanges(h4Points, def.kind);

  const latest = finiteOrNull(d1?.meta?.regularMarketPrice) ?? dailyPoints.at(-1)?.value ?? null;
  // Use the previous daily candle as baseline. meta.chartPreviousClose is the
  // close at the start of the requested range, not the prior session.
  const previousClose = dailyPoints.length >= 2
    ? dailyPoints.at(-2).value
    : finiteOrNull(d1?.meta?.previousClose) ?? null;
  const hasData = Number.isFinite(latest) && dailyPoints.length > 0;

  const change = Number.isFinite(latest) && Number.isFinite(previousClose)
    ? (def.kind === 'yield' ? latest - previousClose : latest - previousClose)
    : null;
  const changePercent = def.kind === 'yield' || !Number.isFinite(change) || !Number.isFinite(previousClose) || previousClose === 0
    ? null
    : (change / previousClose) * 100;

  const updatedAt = d1?.meta?.regularMarketTime || d1?.candles?.at(-1)?.timestamp || null;
  const marketState = d1?.meta?.marketState || 'UNKNOWN';
  const status = classifyStatus({
    hasData,
    updatedAt,
    now,
    liveWindowMs: LIVE_WINDOW_MS,
    marketState,
  });

  const normalized = {
    id: def.id,
    symbol: def.symbol,
    label: def.label,
    kind: def.kind,
    unit: def.unit,
    role: def.role || 'CONFIRMATION',
    influenceGroup: def.influenceGroup || def.id,
    provider: d1?.provider || 'Yahoo Finance',
    providerSymbol: d1?.providerSymbol || def.ticker,
    sourceUrl: d1?.sourceUrl || null,
    fallbackUsed: false,
    marketState,
    proxy: def.proxy || null,
    latest: Number.isFinite(latest) ? latest : null,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    change: Number.isFinite(change) ? change : null,
    changeUnit: def.kind === 'yield' ? 'pp' : 'price',
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    d1: {
      ...computeSummary(dailyPoints, def.kind),
      source: d1?.provider || 'Yahoo Finance',
    },
    h4: h4?.ok
      ? { ...computeSummary(h4Points, def.kind), source: h4.provider || 'Yahoo Finance' }
      : { trend: 'UNKNOWN', available: false, bars: 0, reason: h4?.error || 'H4 tidak tersedia.', source: 'Yahoo Finance' },
    status,
    statusDetail: statusDetailFor(status, { updatedAt, marketState }),
    updatedAt,
    lastObservationDate: dailyPoints.at(-1)?.date || null,
    error: hasData ? null : (d1?.error || 'Data instrumen tidak tersedia.'),
    dailyPoints,
    dailyChanges,
    h4Points,
    h4Changes,
  };
  normalized.validation = validateInstrument(normalized);
  return normalized;
}

export function normalizeFredInstrument(def, series, now = Date.now()) {
  const points = dedupePoints((series?.observations || []).map((observation) => ({
    key: observation.date,
    date: observation.date,
    value: observation.value,
  })));
  const dailyChanges = buildChanges(points, def.kind);
  const latest = points.at(-1)?.value ?? null;
  const previousClose = points.at(-2)?.value ?? null;
  const hasData = Number.isFinite(latest) && points.length > 0;
  const change = Number.isFinite(latest) && Number.isFinite(previousClose) ? latest - previousClose : null;
  const updatedAt = points.at(-1)?.date ? `${points.at(-1).date}T00:00:00.000Z` : null;
  const status = classifyStatus({ hasData, updatedAt, now, delayedDays: 5, staleDays: 14 });

  const normalized = {
    id: def.id,
    symbol: def.symbol,
    label: def.label,
    kind: def.kind,
    unit: def.unit,
    role: def.role || 'CONFIRMATION',
    influenceGroup: def.influenceGroup || def.id,
    provider: series?.provider || 'FRED',
    providerSymbol: series?.providerSymbol || def.series,
    sourceUrl: series?.sourceUrl || `https://fred.stlouisfed.org/series/${def.series}`,
    fallbackUsed: false,
    marketState: 'DAILY_ONLY',
    proxy: null,
    latest: Number.isFinite(latest) ? latest : null,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    change: Number.isFinite(change) ? change : null,
    changeUnit: 'pp',
    changePercent: null,
    d1: {
      ...computeSummary(points, def.kind),
      source: series?.provider || 'FRED',
    },
    h4: {
      trend: 'UNKNOWN',
      available: false,
      bars: 0,
      reason: 'Sumber FRED hanya menyediakan data harian; H4 tidak tersedia.',
      source: 'FRED',
    },
    status,
    statusDetail: statusDetailFor(status, { updatedAt }),
    updatedAt,
    lastObservationDate: points.at(-1)?.date || null,
    error: hasData ? null : (series?.error || 'Data seri FRED tidak tersedia.'),
    dailyPoints: points,
    dailyChanges,
    h4Points: [],
    h4Changes: [],
  };
  normalized.validation = validateInstrument(normalized);
  return normalized;
}

export function pearson(pairs) {
  const n = pairs.length;
  if (n < 2) return null;
  const xs = pairs.map((pair) => pair[0]);
  const ys = pairs.map((pair) => pair[1]);
  const meanX = average(xs);
  const meanY = average(ys);
  let numerator = 0;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    numerator += dx * dy;
    sumX += dx * dx;
    sumY += dy * dy;
  }
  if (sumX === 0 || sumY === 0) return null;
  return numerator / Math.sqrt(sumX * sumY);
}

export function computeStability(pairs) {
  if (!Array.isArray(pairs) || pairs.length < MIN_CORRELATION_PAIRS * 2) {
    return { status: 'UNKNOWN', firstHalf: null, secondHalf: null };
  }
  const mid = Math.floor(pairs.length / 2);
  const firstHalf = pearson(pairs.slice(0, mid));
  const secondHalf = pearson(pairs.slice(mid));
  if (!Number.isFinite(firstHalf) || !Number.isFinite(secondHalf)) {
    return { status: 'UNKNOWN', firstHalf: null, secondHalf: null };
  }
  const sameSign = Math.sign(firstHalf) === Math.sign(secondHalf);
  const bothMaterial = Math.abs(firstHalf) >= MIN_ABS_CORRELATION
    && Math.abs(secondHalf) >= MIN_ABS_CORRELATION;
  return {
    status: sameSign ? (bothMaterial ? 'STABLE' : 'WEAK') : 'UNSTABLE',
    firstHalf,
    secondHalf,
  };
}

export function alignCorrelation(goldChanges, factorChanges, { window = CORRELATION_WINDOW_DAYS } = {}) {
  const goldMap = new Map((goldChanges || []).map((change) => [change.key, change.change]));
  const pairs = [];
  for (const change of factorChanges || []) {
    if (!goldMap.has(change.key)) continue;
    const goldChange = goldMap.get(change.key);
    if (!Number.isFinite(goldChange) || !Number.isFinite(change.change)) continue;
    pairs.push([goldChange, change.change]);
  }
  const recentPairs = Number.isFinite(window) && window > 0 ? pairs.slice(-window) : pairs;
  if (recentPairs.length < MIN_CORRELATION_PAIRS) {
    return {
      r: null,
      n: recentPairs.length,
      totalPairs: pairs.length,
      window: Number.isFinite(window) ? window : null,
      stability: { status: 'UNKNOWN', firstHalf: null, secondHalf: null },
      reason: `Butuh minimal ${MIN_CORRELATION_PAIRS} pasangan harian; tersedia ${recentPairs.length}.`,
    };
  }
  const r = pearson(recentPairs);
  return {
    r: Number.isFinite(r) ? r : null,
    n: recentPairs.length,
    totalPairs: pairs.length,
    window: Number.isFinite(window) ? window : null,
    stability: computeStability(recentPairs),
    reason: Number.isFinite(r) ? null : 'Variasi data tidak cukup untuk menghitung korelasi.',
  };
}

function buildFactorMetrics(instruments, gold, goldH4Changes) {
  const metrics = [];
  for (const instrument of instruments) {
    const def = INSTRUMENT_DEFS.find((entry) => entry.id === instrument.id);
    const correlationD1 = alignCorrelation(gold?.dailyChanges || [], instrument.dailyChanges, {
      window: CORRELATION_WINDOW_DAYS,
    });
    const correlationH4 = instrument.h4?.available
      ? alignCorrelation(goldH4Changes || [], instrument.h4Changes, {
        window: H4_CORRELATION_WINDOW_BARS,
      })
      : {
        r: null,
        n: 0,
        totalPairs: 0,
        window: H4_CORRELATION_WINDOW_BARS,
        stability: { status: 'UNKNOWN', firstHalf: null, secondHalf: null },
        reason: 'H4 tidak tersedia untuk instrumen ini.',
      };

    let consistency = 'UNKNOWN';
    if (correlationD1.r != null && correlationH4.r != null) {
      consistency = Math.sign(correlationD1.r) === Math.sign(correlationH4.r) ? 'ALIGNED' : 'CONFLICT';
    }

    const changes = instrument.dailyChanges.map((change) => change.change).filter(Number.isFinite);
    const latestChange = instrument.dailyChanges.at(-1)?.change ?? null;
    const volatility = stdDev(changes);
    const magnitude = volatility && volatility > 0 && Number.isFinite(latestChange)
      ? Math.min(3, Math.abs(latestChange) / volatility)
      : 0;
    const direction = Number.isFinite(latestChange) && latestChange !== 0 && correlationD1.r != null
      ? Math.sign(latestChange) * Math.sign(correlationD1.r)
      : 0;
    const validated = correlationD1.r != null;
    const trendConflict = instrument.d1?.available && instrument.h4?.available
      && instrument.d1.trend !== 'UNKNOWN'
      && instrument.h4.trend !== 'UNKNOWN'
      && instrument.d1.trend !== 'SIDEWAYS'
      && instrument.h4.trend !== 'SIDEWAYS'
      && instrument.d1.trend !== instrument.h4.trend;

    metrics.push({
      id: instrument.id,
      symbol: instrument.symbol,
      label: instrument.label,
      role: instrument.role || def?.role || 'CONFIRMATION',
      influenceGroup: instrument.influenceGroup || def?.influenceGroup || instrument.id,
      status: instrument.status || 'UNAVAILABLE',
      validated,
      correlationD1,
      correlationH4,
      consistency,
      latestChange,
      magnitude: Number.isFinite(magnitude) ? magnitude : 0,
      direction,
      weight: 0,
      weighted: false,
      contribution: 0,
      redundancy: 0,
      trendConflict,
      reason: correlationD1.reason,
      dailyChanges: instrument.dailyChanges,
    });
  }
  return metrics;
}

function dependencyRedundancy(metric, eligible) {
  let maxAbs = 0;
  for (const other of eligible) {
    if (other.id === metric.id) continue;
    const correlation = alignCorrelation(metric.dailyChanges, other.dailyChanges, {
      window: CORRELATION_WINDOW_DAYS,
    });
    if (Number.isFinite(correlation.r)) maxAbs = Math.max(maxAbs, Math.abs(correlation.r));
  }
  return maxAbs;
}

function roleMultiplier(metric) {
  return ROLE_MULTIPLIER[metric.role] ?? ROLE_MULTIPLIER.CONFIRMATION;
}

function metricBaseScore(metric) {
  const consistencyMultiplier = metric.consistency === 'ALIGNED'
    ? 1.1
    : metric.consistency === 'CONFLICT'
      ? 0.6
      : 1;
  return Math.abs(metric.correlationD1.r) * consistencyMultiplier * roleMultiplier(metric);
}

function assignWeights(metrics) {
  const eligible = metrics.filter((metric) => (
    metric.validated
    && metric.status !== 'STALE'
    && metric.status !== 'UNAVAILABLE'
    && metric.correlationD1.r != null
    && Math.abs(metric.correlationD1.r) >= MIN_ABS_CORRELATION
  ));

  // Instruments in the same influence group (e.g. nominal/real yields) share a
  // group weight. This prevents correlated instruments from double counting
  // as independent confirmation.
  const groups = new Map();
  for (const metric of eligible) {
    const group = groups.get(metric.influenceGroup) || [];
    group.push(metric);
    groups.set(metric.influenceGroup, group);
  }

  const groupEntries = Array.from(groups.entries()).map(([name, members]) => {
    const scores = new Map(members.map((member) => [member.id, metricBaseScore(member)]));
    const groupScore = Math.max(0, ...scores.values());
    const memberTotal = Array.from(scores.values()).reduce((sum, value) => sum + value, 0);
    return { name, members, scores, groupScore, memberTotal };
  });
  const totalGroupScore = groupEntries.reduce((sum, group) => sum + group.groupScore, 0);

  for (const metric of metrics) {
    metric.weighted = eligible.includes(metric);
    metric.redundancy = eligible.length > 1 ? dependencyRedundancy(metric, eligible) : 0;
  }

  for (const group of groupEntries) {
    const groupWeight = totalGroupScore > 0 ? group.groupScore / totalGroupScore : 0;
    for (const member of group.members) {
      const score = group.scores.get(member.id) || 0;
      member.weight = group.memberTotal > 0 ? groupWeight * (score / group.memberTotal) : 0;
      member.contribution = member.weight * member.direction * (member.magnitude / 3);
    }
  }
  return eligible;
}

function directionLabelForGold(metric) {
  if (metric.direction > 0) {
    return metric.latestChange >= 0
      ? 'kenaikan instrumen historisnya mendukung Gold naik'
      : 'penurunan instrumen historisnya mendukung Gold naik';
  }
  if (metric.direction < 0) {
    return metric.latestChange >= 0
      ? 'kenaikan instrumen historisnya menekan Gold'
      : 'penurunan instrumen historisnya menekan Gold';
  }
  return 'arah pengaruh belum tervalidasi';
}

function impactLabel(metric) {
  if (!metric.validated || !metric.weighted) return 'Belum dinilai';
  if (metric.direction === 0) return 'Belum dinilai';
  return metric.direction > 0 ? 'Mendukung Gold UP' : 'Menekan Gold DOWN';
}

function impactStrength(metric) {
  if (!metric.validated) return 'UNVALIDATED';
  if (!metric.weighted) return 'NOT_WEIGHTED';
  const power = Math.abs(metric.contribution);
  if (power >= 0.1) return 'STRONG';
  if (power >= 0.04) return 'MODERATE';
  return 'WEAK';
}

function strengthLabel({ score, confirm, conflict }) {
  const absScore = Math.abs(score);
  const total = confirm + conflict;
  const agreement = total > 0 ? confirm / total : 0;
  if (absScore >= 0.4 && agreement >= 0.7 && confirm >= 3 && conflict <= 1) return 'STRONG';
  if (absScore >= 0.15 && confirm >= 2) return 'MODERATE';
  return 'WEAK';
}

function buildOilAnalysis({ instruments, metrics, nominal, real }) {
  const oil = instruments.find((instrument) => instrument.id === 'wti') || null;
  const oilMetric = metrics.find((metric) => metric.id === 'wti') || null;
  const dxy = instruments.find((instrument) => instrument.id === 'dxy') || null;

  const breakevenNow = Number.isFinite(nominal?.latest) && Number.isFinite(real?.latest)
    ? nominal.latest - real.latest
    : null;
  const breakevenPrevious = Number.isFinite(nominal?.previousClose) && Number.isFinite(real?.previousClose)
    ? nominal.previousClose - real.previousClose
    : null;
  const breakevenChange = Number.isFinite(breakevenNow) && Number.isFinite(breakevenPrevious)
    ? breakevenNow - breakevenPrevious
    : null;

  const compareDirection = (baseChange, otherChange) => {
    if (!Number.isFinite(baseChange) || !Number.isFinite(otherChange)) return 'UNKNOWN';
    if (Math.abs(otherChange) < 1e-9) return 'FLAT';
    return Math.sign(baseChange) === Math.sign(otherChange) ? 'SAME_DIRECTION' : 'OPPOSITE_DIRECTION';
  };

  let inflationStatus = 'UNKNOWN';
  if (Number.isFinite(oil?.change) && Number.isFinite(breakevenChange)) {
    if (Math.abs(breakevenChange) <= 0.005) inflationStatus = 'BREAKEVEN_FLAT';
    else if (oil.change > 0 && breakevenChange > 0) inflationStatus = 'OIL_UP_WITH_INFLATION_EXPECTATION_UP';
    else if (oil.change < 0 && breakevenChange < 0) inflationStatus = 'OIL_DOWN_WITH_INFLATION_EXPECTATION_DOWN';
    else inflationStatus = 'DIVERGENT';
  }

  const magnitude = oilMetric?.magnitude || 0;
  const speed = magnitude >= 1.5 ? 'FAST' : magnitude >= 0.5 ? 'NORMAL' : 'SLOW';
  const validated = Boolean(oilMetric?.validated);
  const oilStrength = !validated
    ? 'UNVALIDATED'
    : Math.abs(oilMetric.correlationD1.r) >= 0.35
      ? 'STRONG'
      : Math.abs(oilMetric.correlationD1.r) >= 0.2
        ? 'MODERATE'
        : 'WEAK';

  return {
    instrumentId: oil?.id || 'wti',
    symbol: oil?.symbol || 'WTI',
    label: oil?.label || 'WTI Crude Oil',
    available: Boolean(oil && oil.status !== 'UNAVAILABLE' && Number.isFinite(oil.latest)),
    alternativeUsed: false,
    change: oil?.change ?? null,
    direction: Number.isFinite(oil?.change) ? (oil.change > 0 ? 'UP' : oil.change < 0 ? 'DOWN' : 'FLAT') : 'UNKNOWN',
    speed,
    validated,
    strength: oilStrength,
    correlationD1: oilMetric?.correlationD1?.r ?? null,
    weight: oilMetric?.weight ?? 0,
    inflationLink: {
      status: inflationStatus,
      breakevenNow: Number.isFinite(breakevenNow) ? breakevenNow : null,
      breakevenChange: Number.isFinite(breakevenChange) ? breakevenChange : null,
      note: 'Breakeven 10Y dihitung sebagai yield nominal 10Y dikurangi real yield 10Y. Sumber/waktu dapat berbeda; ini indikasi, bukan bukti sebab-akibat.',
    },
    vsDxy: compareDirection(oil?.change, dxy?.change),
    vsUs10y: compareDirection(oil?.change, nominal?.change),
    geopolitical: {
      status: 'UNKNOWN',
      note: 'Faktor geopolitik / risk sentiment tidak dinilai otomatis tanpa feed berita geopolitik tervalidasi.',
    },
  };
}

function buildNarrative({
  bias, strength, confirm, conflict, independentConfirm, independentConflict, dominant, oilAnalysis, missing, stale,
}) {
  const staleText = stale?.length
    ? ` Data usang (tidak diberi bobot): ${stale.join(', ')}.`
    : '';
  if (bias === 'INSUFFICIENT DATA') {
    return `INSUFFICIENT DATA — analisis bias Gold ditahan karena ${missing.join(', ') || 'data inti belum lengkap'}.${staleText} JIN tidak mengarang kesimpulan.`;
  }
  const dominantText = dominant
    ? ` Faktor dominan: ${dominant.label} (kontribusi ${dominant.contribution >= 0 ? '+' : ''}${dominant.contribution.toFixed(3)}, korelasi D1 ${dominant.correlationD1.r.toFixed(2)}, ${dominant.correlationD1.stability?.status || 'UNKNOWN'}).`
    : '';
  const oilText = oilAnalysis?.available
    ? ` Oil: ${oilAnalysis.symbol} ${oilAnalysis.direction} (${oilAnalysis.speed}); status pengaruh ${oilAnalysis.strength}.`
    : ' Oil tidak tersedia.';
  return `GOLD BIAS ${bias} dengan kekuatan ${strength}. Konfirmasi ${confirm} faktor (${independentConfirm} grup independen), konflik ${conflict} faktor (${independentConflict} grup).${dominantText}${oilText}${staleText} Korelasi memakai ${CORRELATION_WINDOW_DAYS} observasi harian terakhir; korelasi historis bukan hubungan sebab-akibat.`;
}

function cryptoNarrativeFor(crypto) {
  if (!crypto) return 'Crypto Risk Sentiment tidak dimuat.';
  if (!crypto.ok) {
    return `Crypto Risk Sentiment UNAVAILABLE (${crypto.error || 'Binance tidak terjangkau'}). GOLD BIAS makro tidak terpengaruh.`;
  }
  const status = crypto.riskSentiment?.status || 'UNKNOWN';
  const factor = crypto.factor;
  const directionText = factor?.validated
    ? (factor.direction > 0
      ? 'Arah konteks mendukung Gold UP'
      : factor.direction < 0
        ? 'Arah konteks menekan Gold DOWN'
        : 'Arah konteks netral')
    : 'Korelasi aktual BTC/ETH vs XAUUSD belum tervalidasi';
  return `Crypto Risk Sentiment: ${status}. ${directionText}. Status data ${crypto.status}. Grup ${CRYPTO_GROUP} berbobot 0 dan tidak mengubah skor makro; ${crypto.alignmentLabel || 'crypto hanya konteks'}.`;
}

export function buildGoldIntermarketAnalysis({ instruments, gold, crypto = null, now = Date.now() }) {
  const safeInstruments = Array.isArray(instruments) ? instruments : [];
  const goldAvailable = Boolean(gold && Number.isFinite(gold.latest) && gold.dailyChanges?.length >= MIN_CORRELATION_PAIRS);
  const goldH4Changes = gold?.h4Changes || [];

  const metrics = buildFactorMetrics(safeInstruments, gold, goldH4Changes);
  const eligible = assignWeights(metrics);

  const totalWeight = eligible.reduce((sum, metric) => sum + metric.weight, 0);
  const rawScore = eligible.reduce((sum, metric) => sum + metric.contribution, 0);
  const score = totalWeight > 0 ? rawScore / totalWeight : 0;

  const positiveWeight = eligible.filter((metric) => metric.direction > 0).reduce((sum, metric) => sum + metric.weight, 0);
  const negativeWeight = eligible.filter((metric) => metric.direction < 0).reduce((sum, metric) => sum + metric.weight, 0);
  const dominantSign = score > 0 ? 1 : score < 0 ? -1 : positiveWeight >= negativeWeight ? 1 : -1;
  const confirm = eligible.filter((metric) => metric.direction === dominantSign).length;
  const conflict = eligible.filter((metric) => metric.direction === -dominantSign).length;
  const confirmingGroups = new Set(
    eligible.filter((metric) => metric.direction === dominantSign).map((metric) => metric.influenceGroup),
  );
  const conflictingGroups = new Set(
    eligible.filter((metric) => metric.direction === -dominantSign).map((metric) => metric.influenceGroup),
  );

  const available = safeInstruments.filter((instrument) => instrument.status !== 'UNAVAILABLE' && Number.isFinite(instrument.latest));
  const staleIds = available.filter((instrument) => instrument.status === 'STALE').map((instrument) => instrument.symbol);
  // DXY and the 10Y real yield are core factors: they must be present and
  // fresh for a directional conclusion, independent of correlation strength.
  const coreDefs = INSTRUMENT_DEFS.filter((def) => def.role === 'CORE');
  const coreFactorsUsable = coreDefs.every((def) => {
    const instrument = safeInstruments.find((item) => item.id === def.id);
    return Boolean(instrument)
      && Number.isFinite(instrument.latest)
      && instrument.status !== 'STALE'
      && instrument.status !== 'UNAVAILABLE';
  });
  const missingIds = INSTRUMENT_DEFS
    .filter((def) => !available.some((instrument) => instrument.id === def.id))
    .map((def) => def.symbol);
  const missingDetails = INSTRUMENT_DEFS
    .filter((def) => !available.some((instrument) => instrument.id === def.id))
    .map((def) => ({
      symbol: def.symbol,
      label: def.label,
      provider: def.provider === 'fred' ? `FRED ${def.series}` : `Yahoo Finance ${def.ticker}`,
    }));
  if (!goldAvailable) {
    missingIds.push('XAUUSD baseline');
    missingDetails.push({
      symbol: GOLD_BASELINE_DEF.symbol,
      label: GOLD_BASELINE_DEF.label,
      provider: `Yahoo Finance ${GOLD_BASELINE_DEF.ticker}`,
    });
  }
  const validationWarnings = safeInstruments
    .filter((instrument) => instrument.validation?.warnings?.length > 0)
    .map((instrument) => ({
      symbol: instrument.symbol,
      warnings: instrument.validation.warnings,
    }));

  const dataComplete = missingIds.length === 0 && eligible.length >= 3 && coreFactorsUsable;
  const rawBias = score >= BIAS_THRESHOLD ? 'UP' : score <= -BIAS_THRESHOLD ? 'DOWN' : 'MIXED';
  const bias = dataComplete && (confirm + conflict) > 0 ? rawBias : 'INSUFFICIENT DATA';
  const strength = bias === 'INSUFFICIENT DATA' ? 'WEAK' : strengthLabel({ score, confirm, conflict });
  const cryptoAnalysis = alignCryptoWithBias(crypto, bias);

  const dominant = eligible
    .slice()
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0] || null;

  const toSupport = (metric) => {
    const instrument = safeInstruments.find((item) => item.id === metric.id) || {};
    return {
      id: metric.id,
      symbol: metric.symbol,
      label: metric.label,
      role: metric.role,
      influenceGroup: metric.influenceGroup,
      direction: metric.direction > 0 ? 'UP' : 'DOWN',
      impact: impactLabel(metric),
      impactStrength: impactStrength(metric),
      reason: directionLabelForGold(metric),
      change: instrument.change ?? null,
      changeUnit: instrument.changeUnit || (instrument.kind === 'yield' ? 'pp' : 'price'),
      changePercent: instrument.changePercent ?? null,
      correlationD1: metric.correlationD1.r,
      stability: metric.correlationD1.stability,
      weight: metric.weight,
      contribution: metric.contribution,
      magnitude: metric.magnitude,
      validated: metric.validated,
    };
  };

  const supportsUp = eligible.filter((metric) => metric.direction > 0).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).map(toSupport);
  const supportsDown = eligible.filter((metric) => metric.direction < 0).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).map(toSupport);
  const unvalidated = metrics
    .filter((metric) => (
      !metric.validated
      || metric.status === 'STALE'
      || metric.status === 'UNAVAILABLE'
      || (metric.correlationD1.r != null && Math.abs(metric.correlationD1.r) < MIN_ABS_CORRELATION)
    ))
    .map((metric) => ({
      id: metric.id,
      symbol: metric.symbol,
      label: metric.label,
      reason: metric.status === 'STALE'
        ? 'Data usang (STALE); tidak diberi bobot agar tidak dianggap data terbaru.'
        : metric.status === 'UNAVAILABLE'
          ? 'Data tidak tersedia dari provider; tidak diberi bobot.'
          : !metric.validated
            ? (metric.reason || 'Korelasi historis belum tervalidasi.')
            : `Korelasi D1 ${metric.correlationD1.r.toFixed(2)} (${metric.correlationD1.n} observasi, ${metric.correlationD1.stability?.status || 'UNKNOWN'}) di bawah ambang ${MIN_ABS_CORRELATION}; tidak diberi bobot.`,
    }));

  const conflicts = [];
  for (const metric of eligible) {
    if (metric.validated && metric.direction === -dominantSign && metric.magnitude >= 0.15) {
      conflicts.push({
        id: metric.id,
        symbol: metric.symbol,
        label: metric.label,
        type: 'FACTOR_OPPOSES_BIAS',
        reason: `${metric.label} bergerak berlawanan terhadap bias ${bias}.`,
      });
    }
    if (metric.trendConflict) {
      conflicts.push({
        id: metric.id,
        symbol: metric.symbol,
        label: metric.label,
        type: 'D1_H4_CONFLICT',
        reason: `${metric.label}: tren D1 dan H4 tidak searah.`,
      });
    }
    if (metric.consistency === 'CONFLICT') {
      conflicts.push({
        id: metric.id,
        symbol: metric.symbol,
        label: metric.label,
        type: 'CORRELATION_CONSISTENCY_CONFLICT',
        reason: `${metric.label}: tanda korelasi D1 dan H4 berbeda.`,
      });
    }
    if (metric.correlationD1.stability?.status === 'UNSTABLE') {
      conflicts.push({
        id: metric.id,
        symbol: metric.symbol,
        label: metric.label,
        type: 'CORRELATION_UNSTABLE',
        reason: `${metric.label}: korelasi 180 hari tidak stabil (paruh pertama ${metric.correlationD1.stability.firstHalf.toFixed(2)}, paruh kedua ${metric.correlationD1.stability.secondHalf.toFixed(2)}).`,
      });
    }
  }

  const nominal = safeInstruments.find((instrument) => instrument.id === 'us10y') || null;
  const real = safeInstruments.find((instrument) => instrument.id === 'us10y_real') || null;
  const oilAnalysis = buildOilAnalysis({ instruments: safeInstruments, metrics, nominal, real });

  const dominantFactor = dominant ? {
    id: dominant.id,
    symbol: dominant.symbol,
    label: dominant.label,
    role: dominant.role,
    influenceGroup: dominant.influenceGroup,
    impact: impactLabel(dominant),
    impactStrength: impactStrength(dominant),
    contribution: dominant.contribution,
    weight: dominant.weight,
    correlationD1: dominant.correlationD1.r,
    stability: dominant.correlationD1.stability,
    direction: dominant.direction,
    validated: dominant.validated,
  } : null;

  return {
    status: bias === 'INSUFFICIENT DATA' ? 'INSUFFICIENT_DATA' : 'OK',
    bias,
    strength,
    score: Number.isFinite(score) ? score : 0,
    confirmationCount: confirm,
    conflictCount: conflict,
    independentConfirmationCount: confirmingGroups.size,
    independentConflictCount: conflictingGroups.size,
    dominantFactor,
    supportsUp,
    supportsDown,
    conflicts,
    unvalidated,
    oil: oilAnalysis,
    crypto: cryptoAnalysis,
    cryptoFactor: cryptoAnalysis?.factor ?? null,
    cryptoNarrative: cryptoNarrativeFor(cryptoAnalysis),
    dataCompleteness: {
      available: available.length,
      required: INSTRUMENT_DEFS.length,
      goldBaselineAvailable: goldAvailable,
      goldBaselineProxy: GOLD_BASELINE_DEF.proxy || null,
      coreFactorsUsable,
      coreFactorIds: coreDefs.map((def) => def.symbol),
      missing: missingIds,
      missingDetails,
      staleInstruments: staleIds,
      validatedFactorCount: eligible.length,
      correlationWindow: CORRELATION_WINDOW_DAYS,
      validationWarnings,
    },
    factorMetrics: metrics.map((metric) => ({
      id: metric.id,
      symbol: metric.symbol,
      label: metric.label,
      role: metric.role,
      influenceGroup: metric.influenceGroup,
      weight: metric.weight,
      correlationD1: metric.correlationD1,
      correlationH4: metric.correlationH4,
      consistency: metric.consistency,
      direction: metric.direction,
      magnitude: metric.magnitude,
      contribution: metric.contribution,
      redundancy: metric.redundancy,
      weighted: metric.weighted,
      impact: impactLabel(metric),
      impactStrength: impactStrength(metric),
      validated: metric.validated,
      trendConflict: metric.trendConflict,
    })),
    narrative: buildNarrative({
      bias,
      strength,
      confirm,
      conflict,
      independentConfirm: confirmingGroups.size,
      independentConflict: conflictingGroups.size,
      dominant,
      oilAnalysis,
      missing: missingIds,
      stale: staleIds,
    }),
    generatedAt: new Date(now).toISOString(),
    calcVersion: CALC_VERSION,
  };
}

function serializeInstrument(instrument) {
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    label: instrument.label,
    kind: instrument.kind,
    unit: instrument.unit,
    role: instrument.role,
    influenceGroup: instrument.influenceGroup,
    provider: instrument.provider,
    providerSymbol: instrument.providerSymbol,
    sourceUrl: instrument.sourceUrl,
    fallbackUsed: instrument.fallbackUsed,
    marketState: instrument.marketState || null,
    proxy: instrument.proxy || null,
    latest: instrument.latest,
    previousClose: instrument.previousClose,
    change: instrument.change,
    changeUnit: instrument.changeUnit,
    changePercent: instrument.changePercent,
    d1: instrument.d1,
    h4: instrument.h4,
    status: instrument.status,
    statusDetail: instrument.statusDetail,
    updatedAt: instrument.updatedAt,
    lastObservationDate: instrument.lastObservationDate,
    validation: instrument.validation,
    error: instrument.error,
  };
}

async function loadYahooInstrument(def, now) {
  const [d1, h4] = await Promise.all([
    fetchYahooChart({ ticker: def.ticker, interval: '1d', range: '2y' }),
    fetchYahooChart({ ticker: def.ticker, interval: '1h', range: '3mo', aggregateHours: 4 }),
  ]);

  // No secondary instrument substitution: if the requested ticker is
  // unavailable the instrument is reported UNAVAILABLE, never replaced by a
  // different market (e.g. WTI must not be swapped for Brent).
  return normalizeYahooInstrument(def, d1, h4, now);
}

async function loadFredInstrument(def, now) {
  const series = await fetchFredSeries(def.series, { limit: 420 });
  return normalizeFredInstrument(def, series, now);
}

export async function fetchGoldIntermarketFactors({ now = Date.now() } = {}) {
  const [goldD1, goldH4, rawInstruments, rawCrypto] = await Promise.all([
    fetchYahooChart({ ticker: GOLD_BASELINE_DEF.ticker, interval: '1d', range: '2y' }),
    fetchYahooChart({ ticker: GOLD_BASELINE_DEF.ticker, interval: '1h', range: '3mo', aggregateHours: 4 }),
    Promise.all(INSTRUMENT_DEFS.map((def) => (
      def.provider === 'fred' ? loadFredInstrument(def, now) : loadYahooInstrument(def, now)
    ))),
    (async () => {
      try {
        return await fetchBinanceCryptoSnapshot({ now });
      } catch (error) {
        return { ok: false, error: error?.message || 'Binance tidak terjangkau.' };
      }
    })(),
  ]);

  const gold = normalizeYahooInstrument(GOLD_BASELINE_DEF, goldD1, goldH4, now);
  const crypto = buildCryptoRiskSentiment({ raw: rawCrypto, gold, now });
  const analysis = buildGoldIntermarketAnalysis({ instruments: rawInstruments, gold, crypto, now });

  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    calcVersion: CALC_VERSION,
    refreshIntervalMs: 60_000,
    providerSummary: {
      priceSeries: 'Yahoo Finance chart API (dapat tertunda)',
      realYield: 'FRED DFII10 (US Treasury 10Y TIPS, harian)',
      us02y: 'FRED DGS2 (US Treasury 2Y, harian)',
      goldBaseline: 'Yahoo Finance GC=F (gold futures, proxy XAUUSD)',
      wti: 'Yahoo Finance CL=F (WTI only, no Brent substitution)',
      crypto: 'Binance Spot BTCUSDT/ETHUSDT + USD-M Futures (REST snapshot, no API keys)',
      noSimulatedData: true,
    },
    gold: serializeInstrument(gold),
    instruments: rawInstruments.map(serializeInstrument),
    crypto,
    analysis,
    integrity: {
      noSimulatedData: true,
      yieldsUsePercentagePoints: true,
      correlationIsNotCausation: true,
      liveClaimRestricted: true,
      notes: [
        'Yahoo Finance adalah feed publik dan dapat tertunda; status LIVE hanya dipakai bila sesi pasar reguler dan timestamp < 10 menit.',
        'Bar OHLC nol (libur/placeholder) dibuang agar tidak mencemari tren dan korelasi.',
        'FRED hanya menyediakan data harian sehingga H4 untuk real yield dan US02Y berstatus tidak tersedia.',
        'WTI tidak pernah diganti Brent; bila CL=F gagal, instrumen dilaporkan UNAVAILABLE.',
        'Baseline Gold memakai futures GC=F sebagai proxy eksplisit XAUUSD, bukan spot.',
        'Data STALE tidak diberi bobot agar tidak dianggap data terbaru.',
        'Bila ada instrumen inti atau baseline Gold yang tidak tersedia, hasil analisis menjadi INSUFFICIENT DATA.',
        'Crypto (BTC/ETH) adalah lapisan konfirmasi tambahan dengan satu grup CRYPTO; bobotnya 0 dan tidak mengubah skor atau GOLD BIAS makro.',
        'Crypto Spot dan Futures dipisahkan; funding dan Open Interest dilaporkan sebagai kondisi, bukan sinyal bullish/bearish otomatis.',
        'Crypto memakai REST snapshot; klaim LIVE hanya berdasarkan timestamp segar, bukan streaming WebSocket.',
        'Bila Binance atau futures tidak terjangkau, crypto dilaporkan UNAVAILABLE dan analisis makro tetap berjalan.',
      ],
    },
  };
}


