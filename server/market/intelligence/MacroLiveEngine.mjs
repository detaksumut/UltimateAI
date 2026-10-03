/**
 * MacroLiveEngine.mjs - MIE v1 Tahap 2: MACRO LIVE (bukan manual)
 *
 * Sumber LIVE terverifikasi dari mesin ini (tanpa API key):
 *  - FRED CSV  https://fred.stlouisfed.org/graph/fredgraph.csv?id=<ID>
 *      PCEPI, CPIAUCSL, UNRATE, PAYEMS, DGS10, DFF, DFEDTARU, T10Y2Y, GDPC1
 *  - BLS public API v2 (tanpa key)
 *      CES0000000001 = Total Nonfarm Payroll (NFP, ribuan)
 *      CES0500000003 = Average Hourly Earnings
 *  - Yahoo ZQ=F 30-Day Fed Funds Futures -> implied rate -> probabilitas kenaikan Fed
 *
 * JUJUR: sumber live gratis tidak menyediakan consensus/ekspektasi.
 *  -> `consensus` selalu null + `consensusAvailable:false`. TIDAK PERNAH dikarang.
 *  -> surprise hanya terisi bila consensus diisi manual (MacroStore).
 *  -> Foreign flow IDX: idx.co.id 403 -> tidak di-scrape, tetap MANUAL (jujur).
 */
const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

const FRED_META = {
  PCEPI: { label: 'PCE Price Index', unit: 'INDEX', freq: 'Monthly' },
  CPIAUCSL: { label: 'CPI All Urban Consumers', unit: 'INDEX', freq: 'Monthly' },
  UNRATE: { label: 'Unemployment Rate', unit: 'PERCENT', freq: 'Monthly' },
  PAYEMS: { label: 'Total Nonfarm Payroll (FRED)', unit: 'THOUSANDS', freq: 'Monthly' },
  DGS10: { label: 'US 10Y Treasury Yield', unit: 'PERCENT', freq: 'Daily' },
  DFF: { label: 'Effective Federal Funds Rate', unit: 'PERCENT', freq: 'Daily' },
  DFEDTARU: { label: 'Fed Funds Target Upper', unit: 'PERCENT', freq: 'Daily' },
  T10Y2Y: { label: '10Y-2Y Spread', unit: 'PERCENT', freq: 'Daily' },
  GDPC1: { label: 'Real GDP (SAAR)', unit: 'BILION_USD', freq: 'Quarterly' }
};

const fredCache = new Map();
const FRED_TTL_MS = 15 * 60 * 1000;

/** Series FRED -> [{date,value}]; nilai '.' (missing) di-skip. */
export async function fetchFredSeries(id, { ttlMs = FRED_TTL_MS } = {}) {
  const cached = fredCache.get(id);
  if (cached && Date.now() - cached.at < ttlMs) return cached.series;
  try {
    const res = await fetch(`${FRED_CSV}?id=${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'JIN-Market-Intelligence/1.0', Accept: 'text/csv' }
    });
    if (!res.ok) throw new Error(`FRED HTTP ${res.status} untuk ${id}`);
    const lines = (await res.text()).trim().split(/\r?\n/);
    const series = [];
    for (let i = 1; i < lines.length; i++) {
      const comma = lines[i].indexOf(',');
      if (comma < 0) continue;
      const date = lines[i].slice(0, comma).trim();
      const raw = lines[i].slice(comma + 1).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || raw === '.' || raw === '') continue;
      const value = Number(raw);
      if (Number.isFinite(value)) series.push({ date, value });
    }
    fredCache.set(id, { at: Date.now(), series });
    return series;
  } catch {
    return [];
  }
}

function tail(series) {
  const n = series.length;
  if (!n) return null;
  const last = series[n - 1];
  const prev = n >= 2 ? series[n - 2] : null;
  const yoyBase = n >= 13 ? series[n - 13] : null;
  const yoyPct = yoyBase && yoyBase.value !== 0
    ? ((last.value - yoyBase.value) / Math.abs(yoyBase.value)) * 100
    : null;
  return { last, prev, yoyBase, yoyPct };
}

function fredEnvelope(id, result) {
  const meta = FRED_META[id] || { label: id, unit: 'UNKNOWN', freq: 'Unknown' };
  const sourceUrl = `https://fred.stlouisfed.org/series/${id}`;
  const source = 'FRED (Federal Reserve Bank of St. Louis)';
  if (!result) {
    return {
      indicator: id, label: meta.label, unit: meta.unit, frequency: meta.freq,
      actual: null, previous: null, yoyPct: null,
      consensus: null, consensusAvailable: false, surprise: null,
      dataStatus: 'UNAVAILABLE', source, sourceUrl,
      error: 'series kosong / fetch gagal'
    };
  }
  const { last, prev, yoyBase, yoyPct } = result;
  return {
    indicator: id,
    label: meta.label,
    unit: meta.unit,
    frequency: meta.freq,
    actual: last.value,
    asOf: last.date,
    previous: prev ? prev.value : null,
    previousDate: prev ? prev.date : null,
    yoyPct,
    yoyBaseDate: yoyBase ? yoyBase.date : null,
    changeVsPrev: prev ? Number((last.value - prev.value).toFixed(4)) : null,
    consensus: null,
    consensusAvailable: false,
    consensusNote: 'Konsensus tidak tersedia di sumber live gratis - TIDAK dikarang.',
    surprise: null,
    dataStatus: 'LIVE',
    source,
    sourceUrl
  };
}

const BLS_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

export const BLS_SERIES = {
  CES0000000001: { label: 'Total Nonfarm Payroll', unit: 'THOUSANDS' },
  CES0500000003: { label: 'Average Hourly Earnings (Total Private)', unit: 'USD' }
};

export async function fetchBlsSeries(seriesIds) {
  try {
    const thisYear = String(new Date().getUTCFullYear());
    const prevYear = String(new Date().getUTCFullYear() - 1);
    const res = await fetch(BLS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'JIN-Market-Intelligence/1.0' },
      body: JSON.stringify({ seriesid: seriesIds, startyear: prevYear, endyear: thisYear }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error(`BLS HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== 'REQUEST_SUCCEEDED' || !json.Results?.series) throw new Error(`BLS ${json.status}`);
    return json.Results.series;
  } catch {
    return [];
  }
}

function blsEnvelope(series, seriesId, indicator) {
  const meta = BLS_SERIES[seriesId];
  const sourceUrl = 'https://www.bls.gov/news.release/empsit.htm';
  const source = 'BLS (U.S. Bureau of Labor Statistics)';
  const unavailable = (error) => ({
    indicator, label: meta.label, unit: meta.unit, frequency: 'Monthly',
    actual: null, previous: null, changeVsPrev: null,
    consensus: null, consensusAvailable: false, surprise: null,
    dataStatus: 'UNAVAILABLE', source, sourceUrl, error
  });
  if (!series) return unavailable('BLS fetch gagal / tidak ada data');
  const data = (series.data || []).filter((d) => /^\d{4}$/.test(d.year) && /^M\d{2}$/.test(d.period));
  const last = data[0];
  const prev = data[1];
  if (!last) return unavailable('tidak ada data periode');
  const actual = Number(last.value);
  const previous = prev ? Number(prev.value) : null;
  return {
    indicator,
    label: meta.label,
    unit: meta.unit,
    frequency: 'Monthly',
    actual,
    asOf: `${last.year}-${last.period.replace('M', '')}`,
    periodName: last.periodName,
    previous,
    previousDate: prev ? `${prev.year}-${prev.period.replace('M', '')}` : null,
    changeVsPrev: previous != null ? Number((actual - previous).toFixed(2)) : null,
    preliminary: (last.footnotes || []).some((f) => f.code === 'P') || false,
    consensus: null,
    consensusAvailable: false,
    consensusNote: 'Konsensus tidak tersedia di BLS API - TIDAK dikarang.',
    surprise: null,
    dataStatus: 'LIVE',
    source,
    sourceUrl
  };
}

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * ZQ=F = 30-Day Fed Funds Futures; harga = 100 - implied average effective rate.
 * impliedRate = 100 - price
 * probHike = (impliedRate - EFFR) / hikeStep * 100
 *
 * hikeStep = ukuran satu kali kenaikan kebijakan (default 25bp = 0.25).
 * CATATAN: DFEDTARU - EFFR adalah LEBAR RANGE target, BUKAN langkah kenaikan,
 * jadi TIDAK boleh dipakai sebagai hikeStep.
 * CATATAN: ini implied probability dari futures, BUKAN CME FedWatch Tool.
 */
export async function fetchFedHikeProbability({ effr, hikeStep = 0.25 } = {}) {
  const base = {
    indicator: 'FED_HIKE_PROB',
    label: 'Probabilitas kenaikan Fed (implied, Fed Funds Futures)',
    unit: 'PERCENT_PROB',
    dataStatus: 'UNAVAILABLE',
    source: 'Yahoo Finance ZQ=F + FRED DFF/DFEDTARU',
    sourceUrl: 'https://finance.yahoo.com/quote/ZQ=F',
    method: 'impliedRate = 100 - ZQ price; prob = (impliedRate - EFFR) / hikeStep',
    disclaimer: 'Implied probability dari futures. BUKAN CME FedWatch. Bukan janji.'
  };
  if (!Number.isFinite(effr)) return { ...base, error: 'EFFR (DFF) tidak tersedia' };
  try {
    const res = await fetch(`${YAHOO_CHART}/${encodeURIComponent('ZQ=F')}?range=5d&interval=1d`, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'JIN-Market-Intelligence/1.0', Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} untuk ZQ=F`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice ?? meta?.chartPreviousClose);
    if (!Number.isFinite(price)) throw new Error('harga ZQ=F kosong');
    const impliedRate = 100 - price;
    const step = Number.isFinite(hikeStep) && hikeStep > 0 ? hikeStep : 0.25;
    const rawProb = ((impliedRate - effr) / step) * 100;
    return {
      ...base,
      zqPrice: price,
      impliedRate: Number(impliedRate.toFixed(4)),
      currentEffr: effr,
      hikeStep: step,
      impliedProbPct: Number(Math.max(0, Math.min(100, rawProb)).toFixed(1)),
      dataStatus: 'LIVE',
      retrievedAt: new Date().toISOString()
    };
  } catch (err) {
    return { ...base, error: String(err.message || err) };
  }
}


/** Orkestrator: seluruh makro AS live, paralel, degrade per-item (tidak gagal total). */
export async function fetchLiveMacro() {
  const fredIds = Object.keys(FRED_META);
  const [fredSeries, blsSeries] = await Promise.all([
    Promise.all(fredIds.map((id) => fetchFredSeries(id))),
    fetchBlsSeries(Object.keys(BLS_SERIES))
  ]);

  const byId = {};
  fredIds.forEach((id, i) => { byId[id] = fredSeries[i]; });
  const items = [];

  // PCE & CPI ditampilkan sebagai YoY (seperti infografik); index level tetap disimpan.
  const pce = fredEnvelope('PCEPI', tail(byId.PCEPI));
  if (pce.dataStatus === 'LIVE' && pce.yoyPct != null) {
    pce.indexLevel = pce.actual;
    pce.actual = Number(pce.yoyPct.toFixed(2));
    pce.unit = 'PERCENT_YOY';
    pce.displayMode = 'YOY';
  }
  const cpi = fredEnvelope('CPIAUCSL', tail(byId.CPIAUCSL));
  if (cpi.dataStatus === 'LIVE' && cpi.yoyPct != null) {
    cpi.indexLevel = cpi.actual;
    cpi.actual = Number(cpi.yoyPct.toFixed(2));
    cpi.unit = 'PERCENT_YOY';
    cpi.displayMode = 'YOY';
  }
  items.push(pce, cpi);
  items.push(fredEnvelope('UNRATE', tail(byId.UNRATE)));
  items.push(fredEnvelope('PAYEMS', tail(byId.PAYEMS)));

  const nfp = blsEnvelope(blsSeries.find((s) => s.seriesID === 'CES0000000001'), 'CES0000000001', 'NFP_BLS');
  const ahe = blsEnvelope(blsSeries.find((s) => s.seriesID === 'CES0500000003'), 'CES0500000003', 'AHE_BLS');
  items.push(nfp, ahe);

  const dgs10 = fredEnvelope('DGS10', tail(byId.DGS10));
  const t10y2y = fredEnvelope('T10Y2Y', tail(byId.T10Y2Y));
  const dff = fredEnvelope('DFF', tail(byId.DFF));
  const dfedtaru = fredEnvelope('DFEDTARU', tail(byId.DFEDTARU));
  items.push(dgs10, t10y2y, dff, dfedtaru, fredEnvelope('GDPC1', tail(byId.GDPC1)));

  const fedProb = await fetchFedHikeProbability({
    effr: dff.dataStatus === 'LIVE' ? dff.actual : null
  });
  items.push(fedProb);

  const degraded = items.filter((i) => i.dataStatus !== 'LIVE').map((i) => i.indicator);
  const asOf = {};
  for (const i of items) if (i.asOf) asOf[i.indicator] = i.asOf;

  return {
    provider: 'FRED + BLS + Yahoo Fed Funds Futures',
    live: true,
    noApiKeyRequired: true,
    retrievedAt: new Date().toISOString(),
    liveCount: items.length - degraded.length,
    totalCount: items.length,
    degraded,
    asOf,
    items
  };
}

/** Cari item macro by indicator. */
export function pickItem(macro, indicator) {
  return macro?.items?.find((i) => i.indicator === indicator) || null;
}

export default {
  fetchFredSeries,
  fetchBlsSeries,
  fetchLiveMacro,
  fetchFedHikeProbability,
  pickItem,
  FRED_META,
  BLS_SERIES
};

