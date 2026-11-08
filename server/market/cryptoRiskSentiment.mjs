/**
 * cryptoRiskSentiment.mjs
 * Crypto Risk Sentiment layer for FAKTOR UP/DOWN GOLD.
 *
 * Important boundaries:
 *  - Crypto is a SECONDARY context/confirmation layer. It never replaces the
 *    five macro instruments and never alters their weights or GOLD BIAS score.
 *  - BTC and ETH are aggregated into ONE `CRYPTO` influence group so they
 *    cannot be double counted as independent confirmations.
 *  - Direction is derived from the ACTUAL historical correlation with XAUUSD,
 *    never from a fixed rule such as "BTC up = Gold down".
 *  - Spot and Futures values are kept in separate fields and never mixed.
 *  - Funding and Open Interest are reported as conditions, not bullish/bearish
 *    signals by themselves.
 */

export const CRYPTO_CALC_VERSION = 'crypto-risk-v1';
export const CRYPTO_GROUP = 'CRYPTO';
export const CRYPTO_CORRELATION_WINDOW = 180;
export const CRYPTO_H4_CORRELATION_WINDOW = 180;
export const CRYPTO_MIN_CORRELATION_PAIRS = 20;
export const CRYPTO_MIN_ABS_CORRELATION = 0.15;
export const CRYPTO_LIVE_WINDOW_MS = 90_000;
export const CRYPTO_DELAYED_WINDOW_MS = 15 * 60_000;
export const CRYPTO_RISK_THRESHOLD = 0.3;

const TREND_EPSILON = 0.001;

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
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

function isoTime(value) {
  if (value == null) return null;
  const direct = new Date(value);
  if (Number.isFinite(direct.getTime())) return direct.toISOString();
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const fromNumber = new Date(number);
  return Number.isFinite(fromNumber.getTime()) ? fromNumber.toISOString() : null;
}

function dedupePoints(points) {
  const map = new Map();
  for (const point of points) {
    if (!point?.key || !Number.isFinite(point.value)) continue;
    map.set(point.key, point);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function computeCryptoChanges(candles, { keyMode = 'date' } = {}) {
  if (!Array.isArray(candles) || candles.length < 2) return [];
  const points = dedupePoints(candles.map((candle) => ({
    key: keyMode === 'date' ? isoDate(candle.openTime) : isoTime(candle.openTime),
    date: keyMode === 'date' ? isoDate(candle.openTime) : isoTime(candle.openTime),
    value: candle.close,
  })).filter((point) => point.key));
  const changes = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].value;
    const value = points[index].value;
    if (!Number.isFinite(previous) || !Number.isFinite(value) || previous === 0) continue;
    changes.push({
      key: points[index].key,
      date: points[index].date,
      value,
      change: (value - previous) / previous,
    });
  }
  return changes;
}

export function computeCryptoTrend(values, minBars = 20) {
  if (!Array.isArray(values) || values.length < minBars) {
    return { trend: 'UNKNOWN', available: false, basis: `Butuh minimal ${minBars} candle (tersedia ${values?.length || 0}).` };
  }
  const recent = average(values.slice(-5));
  const prior = average(values.slice(-20, -5));
  if (!Number.isFinite(recent) || !Number.isFinite(prior) || prior === 0) {
    return { trend: 'UNKNOWN', available: false, basis: 'Rata-rata harga tidak dapat dihitung.' };
  }
  const ratio = (recent - prior) / Math.abs(prior);
  const trend = ratio > TREND_EPSILON ? 'BULLISH' : ratio < -TREND_EPSILON ? 'BEARISH' : 'SIDEWAYS';
  return {
    trend,
    available: true,
    ratio,
    basis: 'Rata-rata 5 candle terakhir vs 15 candle sebelumnya.',
  };
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

export function alignCryptoCorrelation(goldChanges, factorChanges, window = CRYPTO_CORRELATION_WINDOW) {
  const goldMap = new Map((goldChanges || []).map((change) => [change.key, change.change]));
  const pairs = [];
  for (const change of factorChanges || []) {
    if (!goldMap.has(change.key)) continue;
    const goldChange = goldMap.get(change.key);
    if (!Number.isFinite(goldChange) || !Number.isFinite(change.change)) continue;
    pairs.push([goldChange, change.change]);
  }
  const recentPairs = Number.isFinite(window) && window > 0 ? pairs.slice(-window) : pairs;
  if (recentPairs.length < CRYPTO_MIN_CORRELATION_PAIRS) {
    return {
      r: null,
      n: recentPairs.length,
      totalPairs: pairs.length,
      window,
      validated: false,
      reason: `Butuh minimal ${CRYPTO_MIN_CORRELATION_PAIRS} pasangan; tersedia ${recentPairs.length}.`,
    };
  }
  const r = pearson(recentPairs);
  const validated = Number.isFinite(r) && Math.abs(r) >= CRYPTO_MIN_ABS_CORRELATION;
  return {
    r: Number.isFinite(r) ? r : null,
    n: recentPairs.length,
    totalPairs: pairs.length,
    window,
    validated,
    reason: Number.isFinite(r)
      ? (validated ? null : `|r| ${Math.abs(r).toFixed(2)} di bawah ambang ${CRYPTO_MIN_ABS_CORRELATION}.`)
      : 'Variasi data tidak cukup untuk menghitung korelasi.',
  };
}

export function classifyCryptoStatus({ hasData, updatedAt, now = Date.now() }) {
  if (!hasData) return 'UNAVAILABLE';
  const time = new Date(updatedAt || 0).getTime();
  if (!Number.isFinite(time) || time <= 0) return 'STALE';
  const age = Math.max(0, now - time);
  if (age <= CRYPTO_LIVE_WINDOW_MS) return 'LIVE';
  if (age <= CRYPTO_DELAYED_WINDOW_MS) return 'DELAYED';
  return 'STALE';
}

function statusDetailFor(status, { updatedAt, sourceType }) {
  const suffix = sourceType === 'REST_SNAPSHOT' ? ' Sumber: REST snapshot publik, bukan stream WebSocket.' : '';
  if (status === 'UNAVAILABLE') return 'Binance tidak mengembalikan data yang dapat divalidasi.';
  if (status === 'LIVE') return `Timestamp ${updatedAt || 'tidak tersedia'} segar (≤90 dtk).${suffix}`;
  if (status === 'DELAYED') return `Snapshot tertunda; timestamp ${updatedAt || 'tidak tersedia'}.${suffix}`;
  return `Data usang; timestamp ${updatedAt || 'tidak tersedia'}.${suffix}`;
}

function trendValue(trend) {
  if (trend === 'BULLISH') return 1;
  if (trend === 'BEARISH') return -1;
  return 0;
}

function signalFromAsset(asset) {
  if (!asset?.spotOk) return null;
  const d1 = trendValue(asset.trends?.D1?.trend);
  const h4 = trendValue(asset.trends?.H4?.trend);
  const momentum = finiteOrNull(asset.momentum);
  const momentumSign = momentum == null ? 0 : Math.sign(momentum);
  return (0.5 * d1) + (0.3 * h4) + (0.2 * momentumSign);
}

function classifyRiskSentiment(btc, eth) {
  const btcSignal = signalFromAsset(btc);
  const ethSignal = signalFromAsset(eth);
  const available = [btcSignal, ethSignal].filter((value) => value != null);
  if (available.length === 0) {
    return { status: 'UNKNOWN', score: null, reason: 'BTC/ETH Spot tidak tersedia.' };
  }
  const score = btcSignal != null && ethSignal != null
    ? (0.6 * btcSignal) + (0.4 * ethSignal)
    : available[0];
  let status = 'MIXED';
  if (score >= CRYPTO_RISK_THRESHOLD) status = 'RISK-ON';
  else if (score <= -CRYPTO_RISK_THRESHOLD) status = 'RISK-OFF';
  return {
    status,
    score,
    reason: `Sinyal gabungan BTC/ETH ${score.toFixed(2)} (ambang ±${CRYPTO_RISK_THRESHOLD}).`,
  };
}

function volumeConfirmation(candlesD1) {
  const candles = Array.isArray(candlesD1) ? candlesD1 : [];
  if (candles.length < 21) return { status: 'UNKNOWN', ratio: null };
  const latest = candles.at(-1)?.volume;
  const prior = average(candles.slice(-21, -1).map((candle) => candle.volume));
  if (!Number.isFinite(latest) || !Number.isFinite(prior) || prior <= 0) {
    return { status: 'UNKNOWN', ratio: null };
  }
  const ratio = latest / prior;
  return {
    status: ratio >= 1.1 ? 'ABOVE_AVERAGE' : ratio <= 0.9 ? 'BELOW_AVERAGE' : 'NORMAL',
    ratio,
  };
}

function takerPressure(candle) {
  if (!candle || !Number.isFinite(candle.volume) || candle.volume <= 0) {
    return { ratio: null, status: 'UNKNOWN' };
  }
  const ratio = candle.takerBuyBase / candle.volume;
  if (!Number.isFinite(ratio)) return { ratio: null, status: 'UNKNOWN' };
  return {
    ratio,
    status: ratio >= 0.55 ? 'BUY_PRESSURE' : ratio <= 0.45 ? 'SELL_PRESSURE' : 'BALANCED',
  };
}

function openInterestChangePct(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const recent = history.slice(-6);
  if (recent.length < 2) return null;
  const first = recent[0]?.sumOpenInterest;
  const last = recent.at(-1)?.sumOpenInterest;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function fundingCondition(rate) {
  if (!Number.isFinite(rate)) return { status: 'UNKNOWN', note: 'Funding rate tidak tersedia.' };
  if (rate > 0.00005) {
    return {
      status: 'POSITIVE',
      note: 'Longs membayar shorts. Positif TIDAK otomatis berarti bullish.',
    };
  }
  if (rate < -0.00005) {
    return {
      status: 'NEGATIVE',
      note: 'Shorts membayar longs. Negatif TIDAK otomatis berarti bearish.',
    };
  }
  return { status: 'NEUTRAL', note: 'Funding mendekati netral.' };
}

function buildFuturesBlock(futures, now) {
  if (!futures || !futures.ticker || !futures.klines) {
    return {
      available: false,
      status: 'UNAVAILABLE',
      statusDetail: 'Binance USD-M Futures tidak terjangkau; data futures tidak diisi dengan spot.',
      markPrice: null,
      openInterest: null,
      openInterestChangePct: null,
      fundingRate: null,
      fundingCondition: { status: 'UNKNOWN', note: 'Funding rate tidak tersedia.' },
      longShortRatio: null,
      liquidations: { ok: false, restricted: false, note: 'Data likuidasi tidak tersedia.', error: 'Futures tidak terjangkau.' },
      updatedAt: null,
      error: 'Binance USD-M Futures tidak tersedia.',
    };
  }
  const tickerOk = Boolean(futures.ticker?.ok);
  const funding = futures.funding || {};
  const oi = futures.openInterest || {};
  const longShort = futures.longShort || {};
  const liquidations = futures.liquidations || {};
  const updatedAt = funding.time || futures.ticker?.closeTime || oi.current?.time || null;
  const hasData = Boolean(tickerOk || oi.ok || funding.ok);
  const status = classifyCryptoStatus({ hasData, updatedAt, now });
  return {
    available: hasData && status !== 'UNAVAILABLE',
    status,
    statusDetail: statusDetailFor(status, { updatedAt, sourceType: 'REST_SNAPSHOT' }),
    markPrice: funding.markPrice ?? futures.ticker?.lastPrice ?? null,
    priceChangePercent: futures.ticker?.priceChangePercent ?? null,
    quoteVolume: futures.ticker?.quoteVolume ?? null,
    openInterest: oi.current?.value ?? null,
    openInterestChangePct: openInterestChangePct(oi.history),
    fundingRate: funding.lastFundingRate ?? null,
    fundingCondition: fundingCondition(funding.lastFundingRate),
    nextFundingTime: funding.nextFundingTime ?? null,
    longShortRatio: longShort.latest?.longShortRatio ?? null,
    liquidations: {
      ok: Boolean(liquidations.ok),
      restricted: Boolean(liquidations.restricted),
      count: liquidations.count ?? null,
      note: liquidations.note || 'Data likuidasi tidak tersedia.',
      error: liquidations.error ?? null,
    },
    updatedAt,
    error: hasData ? null : (funding.error || futures.ticker?.error || 'Data futures tidak tersedia.'),
  };
}

function buildAsset({ name, symbol, spot, futures, gold, now }) {
  const candlesD1 = spot?.klines?.D1?.candles || [];
  const candlesH4 = spot?.klines?.H4?.candles || [];
  const candlesH1 = spot?.klines?.H1?.candles || [];
  const tickerOk = Boolean(spot?.ticker?.ok);
  const latest = tickerOk ? spot.ticker.lastPrice : candlesD1.at(-1)?.close ?? null;
  const spotOk = Number.isFinite(latest) && candlesD1.length > 0;
  const lastCandleCloseTime = Number(candlesD1.at(-1)?.closeTime);
  // An in-progress candle's closeTime is in the future; cap it at `now` so the
  // UI never shows a future timestamp or inflates freshness.
  const fallbackUpdatedAt = Number.isFinite(lastCandleCloseTime)
    ? new Date(Math.min(lastCandleCloseTime, now)).toISOString()
    : null;
  const updatedAt = spot?.ticker?.closeTime || fallbackUpdatedAt;
  const status = classifyCryptoStatus({ hasData: spotOk, updatedAt, now });

  const trends = {
    D1: computeCryptoTrend(candlesD1.map((candle) => candle.close)),
    H4: computeCryptoTrend(candlesH4.map((candle) => candle.close)),
    H1: computeCryptoTrend(candlesH1.map((candle) => candle.close)),
  };

  const d1Changes = computeCryptoChanges(candlesD1, { keyMode: 'date' });
  const h4Changes = computeCryptoChanges(candlesH4, { keyMode: 'time' });
  const correlationD1 = alignCryptoCorrelation(gold?.dailyChanges || [], d1Changes, CRYPTO_CORRELATION_WINDOW);
  const correlationH4 = alignCryptoCorrelation(gold?.h4Changes || [], h4Changes, CRYPTO_H4_CORRELATION_WINDOW);

  const h4ChangesValues = h4Changes.map((change) => change.change).filter(Number.isFinite);
  const momentum = h4Changes.at(-1)?.change
    ?? (Number.isFinite(spot?.ticker?.priceChangePercent) ? spot.ticker.priceChangePercent / 100 : null);
  const volatility = stdDev(h4ChangesValues);
  const magnitude = Number.isFinite(momentum) && Number.isFinite(volatility) && volatility > 0
    ? Math.min(3, Math.abs(momentum) / volatility)
    : 0;

  const validated = Boolean(correlationD1.validated);
  const direction = validated && Number.isFinite(momentum) && momentum !== 0
    ? Math.sign(momentum) * Math.sign(correlationD1.r)
    : 0;

  const volume = volumeConfirmation(candlesD1);
  const pressure = takerPressure(candlesH1.at(-1) || candlesD1.at(-1));
  const futuresBlock = buildFuturesBlock(futures, now);

  return {
    name,
    symbol,
    market: 'SPOT',
    spotOk,
    status,
    statusDetail: statusDetailFor(status, { updatedAt, sourceType: 'REST_SNAPSHOT' }),
    latest,
    priceChangePercent24h: spot?.ticker?.priceChangePercent ?? null,
    quoteVolume24h: spot?.ticker?.quoteVolume ?? null,
    volume24h: spot?.ticker?.volume ?? null,
    updatedAt,
    provider: spot?.ticker?.provider || spot?.klines?.D1?.provider || 'Binance Spot',
    sourceUrl: spot?.ticker?.sourceUrl || `https://www.binance.com/en/trade/${symbol}`,
    trends,
    momentum,
    magnitude,
    volumeConfirmation: volume,
    takerPressure: pressure,
    correlationD1,
    correlationH4,
    validated,
    direction,
    futures: futuresBlock,
    error: spotOk
      ? null
      : (spot?.ticker?.error || spot?.klines?.D1?.error || `Binance Spot tidak mengembalikan data untuk ${symbol}.`),
  };
}

function overallStatus(assets) {
  const available = assets.filter((asset) => asset.spotOk);
  if (available.length === 0) return 'UNAVAILABLE';
  const order = { LIVE: 0, DELAYED: 1, STALE: 2 };
  const worst = available.reduce((current, asset) => {
    const assetRank = order[asset.status] ?? 2;
    return assetRank > current.rank ? { rank: assetRank, status: asset.status } : current;
  }, { rank: -1, status: 'LIVE' });
  return worst.status;
}

function buildCryptoFactor(btc, eth) {
  const candidates = [btc, eth].filter((asset) => asset?.validated && asset.direction !== 0);
  if (candidates.length === 0) {
    return {
      id: 'crypto',
      symbol: 'CRYPTO',
      label: 'Crypto Risk Sentiment (BTC+ETH)',
      role: 'CONFIRMATION',
      influenceGroup: CRYPTO_GROUP,
      validated: false,
      direction: 0,
      correlationD1: null,
      correlationH4: null,
      weight: 0,
      contribution: 0,
      appliedToMacroScore: false,
      reason: 'Korelasi aktual BTC/ETH terhadap XAUUSD belum tervalidasi; crypto tidak memengaruhi GOLD BIAS.',
    };
  }
  const directions = candidates.map((asset) => Math.sign(asset.direction) * Math.abs(asset.correlationD1.r));
  const direction = Math.sign(directions.reduce((sum, value) => sum + value, 0));
  const weightSum = candidates.reduce((sum, asset) => sum + Math.abs(asset.correlationD1.r), 0);
  const correlationD1 = weightSum > 0
    ? candidates.reduce((sum, asset) => sum + (asset.correlationD1.r * Math.abs(asset.correlationD1.r)), 0) / weightSum
    : null;
  return {
    id: 'crypto',
    symbol: 'CRYPTO',
    label: 'Crypto Risk Sentiment (BTC+ETH)',
    role: 'CONFIRMATION',
    influenceGroup: CRYPTO_GROUP,
    validated: true,
    direction,
    correlationD1,
    correlationH4: candidates.map((asset) => asset.correlationH4?.r).find((value) => Number.isFinite(value)) ?? null,
    weight: 0,
    contribution: 0,
    appliedToMacroScore: false,
    reason: `Agregat satu grup CRYPTO dari ${candidates.map((asset) => asset.symbol).join(' + ')}. Arah mengikuti korelasi aktual; bobot makro tidak diubah.`,
  };
}

export function buildCryptoRiskSentiment({ raw, gold, now = Date.now() } = {}) {
  const base = {
    calcVersion: CRYPTO_CALC_VERSION,
    generatedAt: new Date(now).toISOString(),
    provider: 'Binance',
    apiKeysRequired: false,
    sourceType: 'REST_SNAPSHOT',
    group: CRYPTO_GROUP,
    note: 'Crypto Risk Sentiment adalah konteks/konfirmasi tambahan. Tidak menggantikan DXY, Treasury, Real Yield, atau WTI dan tidak mengubah bobot makro.',
    limitations: [
      'REST snapshot digunakan; LIVE hanya klaim timestamp segar, bukan status streaming WebSocket.',
      'Funding positif/negatif dan kenaikan Open Interest tidak otomatis bullish/bearish.',
      'Spot dan Futures dipisahkan; harga tidak pernah dicampur.',
      'Likuidasi publik Binance dibatasi; angka likuidasi tidak dikarang.',
    ],
  };

  if (!raw || !raw.ok) {
    return {
      ...base,
      ok: false,
      status: 'UNAVAILABLE',
      statusDetail: 'Binance Spot tidak terjangkau.',
      riskSentiment: { status: 'UNKNOWN', score: null, reason: 'Data BTC/ETH tidak tersedia.' },
      assets: { BTC: null, ETH: null },
      futuresReachable: false,
      factor: buildCryptoFactor(null, null),
      error: raw?.error || 'Binance tidak mengembalikan data.',
    };
  }

  const btc = buildAsset({ name: 'Bitcoin', symbol: raw?.spot?.BTC?.symbol || 'BTCUSDT', spot: raw?.spot?.BTC, futures: raw?.futures?.BTC, gold, now });
  const eth = buildAsset({ name: 'Ethereum', symbol: raw?.spot?.ETH?.symbol || 'ETHUSDT', spot: raw?.spot?.ETH, futures: raw?.futures?.ETH, gold, now });
  const status = overallStatus([btc, eth]);
  const riskSentiment = classifyRiskSentiment(btc, eth);

  return {
    ...base,
    ok: Boolean(btc.spotOk || eth.spotOk),
    status,
    statusDetail: statusDetailFor(status, {
      updatedAt: btc.updatedAt || eth.updatedAt,
      sourceType: 'REST_SNAPSHOT',
    }),
    riskSentiment,
    assets: { BTC: btc, ETH: eth },
    futuresReachable: Boolean(raw?.futures?.reachable),
    futuresError: raw?.futures?.error || null,
    factor: buildCryptoFactor(btc, eth),
    error: btc.error && eth.error ? `${btc.error} | ${eth.error}` : (btc.error || eth.error || null),
  };
}

export function alignCryptoWithBias(crypto, bias) {
  if (!crypto) return null;
  const direction = crypto.factor?.direction ?? 0;
  const validated = Boolean(crypto.factor?.validated);
  let alignment = 'UNKNOWN';
  let label = 'Crypto belum tervalidasi';
  if (validated && direction !== 0) {
    if (bias === 'UP') {
      alignment = direction > 0 ? 'CONFIRMS' : 'OPPOSES';
      label = direction > 0 ? 'Crypto mengonfirmasi bias UP' : 'Crypto berlawanan dengan bias UP';
    } else if (bias === 'DOWN') {
      alignment = direction < 0 ? 'CONFIRMS' : 'OPPOSES';
      label = direction < 0 ? 'Crypto mengonfirmasi bias DOWN' : 'Crypto berlawanan dengan bias DOWN';
    } else {
      alignment = 'CONTEXT_ONLY';
      label = 'Bias makro belum arah jelas; crypto hanya konteks';
    }
  } else if (!crypto.ok) {
    label = 'Crypto tidak tersedia; analisis makro tetap berjalan';
  }
  return {
    ...crypto,
    alignment,
    alignmentLabel: label,
    alignmentReason: 'Crypto adalah konfirmasi tambahan dan tidak mengubah skor/bobot makro.',
  };
}

export const CRYPTO_PROVIDER_INFO = {
  provider: 'Binance',
  spot: ['BTCUSDT', 'ETHUSDT'],
  futures: ['BTCUSDT USD-M', 'ETHUSDT USD-M'],
  timeframes: ['D1', 'H4', 'H1'],
  apiKeysRequired: false,
};
