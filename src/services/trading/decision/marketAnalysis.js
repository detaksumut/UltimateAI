/**
 * marketAnalysis.js
 * Deterministic, read-only derivations used by the Tahap 3 decision engine.
 *
 * Everything here reads the already-validated SNAPSHOT. It never fetches data,
 * never re-runs S&D/Scalping formulas, and never invents a missing value.
 */

import { classifyTrend } from '../scalping/scalpingM1.js';
import { DECISION_THRESHOLDS } from './weights.js';
import { DATA_INTEGRITY_STATUS } from './constants.js';

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapTrendDirection(raw) {
  if (raw === 'BULLISH') return 'BULLISH';
  if (raw === 'BEARISH') return 'BEARISH';
  if (raw === 'SIDEWAYS') return 'NEUTRAL';
  return 'UNKNOWN';
}

export function directionToEvidence(direction) {
  if (direction === 'BULLISH' || direction === 'BUY') return 'BUY';
  if (direction === 'BEARISH' || direction === 'SELL') return 'SELL';
  if (direction === 'NEUTRAL') return 'NEUTRAL';
  return null;
}

export function getTimeframeCandles(snapshot, timeframe) {
  const series = snapshot?.sources?.xmPrice?.candles?.[timeframe];
  return Array.isArray(series?.candles) ? series.candles : [];
}

export function trendStrength(trend) {
  if (!trend || trend.direction === 'UNKNOWN' || trend.direction === 'NEUTRAL') return 0.35;
  let strength = 0.4;
  const adx = finite(trend.adx);
  if (adx != null) {
    if (adx >= 25) strength += 0.3;
    else if (adx >= 18) strength += 0.15;
  }
  const slope = Math.abs(finite(trend.emaSlopeAtr) || 0);
  if (slope >= 0.15) strength += 0.3;
  else if (slope >= 0.05) strength += 0.15;
  return round(clamp(strength, 0, 1), 3);
}

export function classifyTimeframe(snapshot, timeframe) {
  const candles = getTimeframeCandles(snapshot, timeframe);
  const result = classifyTrend(candles);
  const direction = result.available ? mapTrendDirection(result.trend) : 'UNKNOWN';
  return {
    timeframe,
    available: result.available === true && direction !== 'UNKNOWN',
    direction,
    rawTrend: result.trend,
    condition: result.condition,
    close: finite(result.close),
    emaFast: finite(result.emaFast),
    emaSlow: finite(result.emaSlow),
    emaSlopeAtr: finite(result.emaSlopeAtr),
    adx: finite(result.adx),
    efficiencyRatio: finite(result.efficiencyRatio),
    atr: finite(result.atr),
    candleCount: candles.length,
    reasons: Array.isArray(result.reasons) ? result.reasons.slice() : [],
  };
}

function findSwings(candles, window) {
  const highs = [];
  const lows = [];
  for (let i = window; i < candles.length - window; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j += 1) {
      if (!(candles[i].high > candles[i - j].high && candles[i].high > candles[i + j].high)) {
        isHigh = false;
      }
      if (!(candles[i].low < candles[i - j].low && candles[i].low < candles[i + j].low)) {
        isLow = false;
      }
    }
    if (isHigh) highs.push({ index: i, price: candles[i].high });
    if (isLow) lows.push({ index: i, price: candles[i].low });
  }
  return { highs, lows };
}

/**
 * SWING-based market structure on H1 only.
 * HH+HL => BULLISH, LH+LL => BEARISH, mixed => NEUTRAL.
 */
export function detectMarketStructure(candles, window = DECISION_THRESHOLDS.STRUCTURE_SWING_WINDOW) {
  const safeWindow = Math.max(1, Number(window) || 2);
  if (!Array.isArray(candles) || candles.length < (safeWindow * 2) + 3) {
    return {
      available: false,
      direction: 'UNKNOWN',
      swingHighs: [],
      swingLows: [],
      reasons: ['Candle H1 belum cukup untuk membaca struktur swing.'],
    };
  }

  const { highs, lows } = findSwings(candles, safeWindow);
  const minSwings = DECISION_THRESHOLDS.STRUCTURE_MIN_SWINGS;
  if (highs.length < minSwings || lows.length < minSwings) {
    return {
      available: false,
      direction: 'UNKNOWN',
      swingHighs: highs.slice(-minSwings),
      swingLows: lows.slice(-minSwings),
      reasons: ['Swing high/low H1 belum cukup untuk menyimpulkan struktur.'],
    };
  }

  const [prevHigh, lastHigh] = highs.slice(-2);
  const [prevLow, lastLow] = lows.slice(-2);
  const higherHigh = lastHigh.price > prevHigh.price;
  const lowerHigh = lastHigh.price < prevHigh.price;
  const higherLow = lastLow.price > prevLow.price;
  const lowerLow = lastLow.price < prevLow.price;

  let direction = 'NEUTRAL';
  const reasons = [];
  if (higherHigh && higherLow) {
    direction = 'BULLISH';
    reasons.push('Swing H1 membentuk higher high dan higher low.');
  } else if (lowerHigh && lowerLow) {
    direction = 'BEARISH';
    reasons.push('Swing H1 membentuk lower high dan lower low.');
  } else {
    reasons.push('Swing H1 campuran; struktur belum satu arah.');
  }

  return {
    available: true,
    direction,
    swingHighs: highs.slice(-2),
    swingLows: lows.slice(-2),
    lastSwingHigh: finite(lastHigh.price),
    previousSwingHigh: finite(prevHigh.price),
    lastSwingLow: finite(lastLow.price),
    previousSwingLow: finite(prevLow.price),
    reasons,
  };
}

export function computePriceResponse(candles, lookback = DECISION_THRESHOLDS.PRICE_RESPONSE_LOOKBACK_M1) {
  const bars = Math.max(1, Number(lookback) || 5);
  if (!Array.isArray(candles) || candles.length < bars + 1) {
    return {
      available: false,
      direction: 'UNKNOWN',
      changePct: null,
      lookback: bars,
      reasons: ['Candle M1 belum cukup untuk mengukur respons harga.'],
    };
  }
  const last = finite(candles[candles.length - 1].close);
  const reference = finite(candles[candles.length - 1 - bars].close);
  if (last == null || reference == null || reference <= 0) {
    return {
      available: false,
      direction: 'UNKNOWN',
      changePct: null,
      lookback: bars,
      reasons: ['Harga acuan respons tidak valid.'],
    };
  }
  const changePct = ((last - reference) / reference) * 100;
  const threshold = DECISION_THRESHOLDS.PRICE_RESPONSE_FLAT_PCT;
  const direction = changePct > threshold ? 'UP' : (changePct < -threshold ? 'DOWN' : 'FLAT');
  return {
    available: true,
    direction,
    changePct: round(changePct, 4),
    lookback: bars,
    thresholdPct: threshold,
    lastClose: last,
    referenceClose: reference,
    reasons: [`Perubahan M1 ${bars} bar = ${round(changePct, 4)}% (${direction}).`],
  };
}

function zoneRange(zone) {
  if (!zone) return null;
  const low = finite(zone.low);
  const high = finite(zone.high);
  const proximal = finite(zone.proximal);
  const distal = finite(zone.distal);
  const candidates = [low, high, proximal, distal].filter((value) => value != null);
  if (candidates.length === 0) return null;
  return {
    low: low != null ? low : Math.min(...candidates),
    high: high != null ? high : Math.max(...candidates),
    proximal,
    distal,
  };
}

function distanceToZone(zone, price) {
  const range = zoneRange(zone);
  if (!range || !Number.isFinite(price)) return null;
  if (price >= range.low && price <= range.high) return 0;
  return Math.min(Math.abs(price - range.low), Math.abs(price - range.high));
}

function zoneSummary(zone, price) {
  if (!zone) return null;
  return {
    id: zone.id ?? null,
    side: zone.side ?? null,
    timeframe: zone.timeframe ?? null,
    low: zoneRange(zone)?.low ?? null,
    high: zoneRange(zone)?.high ?? null,
    score: finite(zone.score),
    lifecycle: zone.lifecycle ?? null,
    distance: round(distanceToZone(zone, price), 4),
  };
}

export function computeZoneContext(snapshot, atrM1) {
  const sd = snapshot?.supplyDemandEvidence;
  const price = finite(snapshot?.priceData?.mid) ?? finite(sd?.currentPrice);
  const ready = sd?.status === DATA_INTEGRITY_STATUS.READY && price != null;

  if (!ready) {
    return {
      available: false,
      location: 'UNKNOWN',
      price,
      reasons: ['Supply/Demand tidak tersedia; lokasi pasar tidak dipakai sebagai bukti.'],
      demand: null,
      supply: null,
      proximity: null,
    };
  }

  const proximity = Math.max(
    (finite(atrM1) || 0) * DECISION_THRESHOLDS.ZONE_PROXIMITY_ATR_M1,
    price * DECISION_THRESHOLDS.ZONE_PROXIMITY_PRICE_PCT,
  );
  const demandDistance = distanceToZone(sd.nearestDemand, price);
  const supplyDistance = distanceToZone(sd.nearestSupply, price);
  const nearDemand = demandDistance != null && demandDistance <= proximity;
  const nearSupply = supplyDistance != null && supplyDistance <= proximity;

  let location = 'NONE';
  if (nearDemand && nearSupply) location = 'BOTH';
  else if (nearDemand) location = 'DEMAND';
  else if (nearSupply) location = 'SUPPLY';

  return {
    available: true,
    location,
    price,
    proximity: round(proximity, 4),
    demandDistance: round(demandDistance, 4),
    supplyDistance: round(supplyDistance, 4),
    demand: zoneSummary(sd.nearestDemand, price),
    supply: zoneSummary(sd.nearestSupply, price),
    reasons: [
      `Harga ${price} berada di ${location} (proximity ${round(proximity, 4)}).`,
    ],
  };
}

function providerAbsorptionDirection(absorption) {
  if (!absorption || absorption.status !== 'DETECTED') return null;
  if (absorption.side === 'SELL') return 'BULLISH';
  if (absorption.side === 'BUY') return 'BEARISH';
  return null;
}

/**
 * Order flow read. Absorption is PROVEN from three facts, never taken on faith:
 *   1. aggressor dominance >= 65% on the absorbed side,
 *   2. price response does not continue in the aggressor's direction,
 *   3. price is located at the matching zone (demand for sell absorption,
 *      supply for buy absorption).
 * The provider's absorption flag can corroborate, but it cannot replace proof.
 */
export function deriveOrderFlowRead(snapshot, zoneContext, priceResponse) {
  const of = snapshot?.orderFlowEvidence;
  const status = of?.status ?? DATA_INTEGRITY_STATUS.UNAVAILABLE;
  const usable = [DATA_INTEGRITY_STATUS.READY, DATA_INTEGRITY_STATUS.DEGRADED].includes(status);
  const buyPercent = finite(of?.buyPercent);
  const sellPercent = finite(of?.sellPercent);
  const tradesCount = finite(of?.tradesCount) ?? 0;

  if (!usable || buyPercent == null || sellPercent == null || tradesCount < 30) {
    return {
      available: false,
      status,
      buyPercent,
      sellPercent,
      tradesCount,
      direction: null,
      strength: 0,
      aggressionDirection: null,
      absorption: { status: 'UNAVAILABLE', direction: null, pattern: null, reasons: [] },
      providerAbsorption: { status: of?.absorption?.status ?? null, side: of?.absorption?.side ?? null, direction: null },
      providerConflict: false,
      reasons: ['Order Flow tidak tersedia atau tidak memenuhi ambang minimum; tidak dipakai sebagai bukti.'],
    };
  }

  const dominance = DECISION_THRESHOLDS.AGGRESSOR_DOMINANCE_PERCENT;
  const strongBuy = buyPercent >= dominance;
  const strongSell = sellPercent >= dominance;
  const location = zoneContext?.location ?? 'UNKNOWN';
  const response = priceResponse?.direction ?? 'UNKNOWN';
  const providerDirection = providerAbsorptionDirection(of.absorption);

  let absorption = { status: 'NONE', direction: null, pattern: null, reasons: [] };
  if (strongSell && location === 'DEMAND' && priceResponse?.available && response !== 'DOWN') {
    absorption = {
      status: 'DETECTED',
      direction: 'BULLISH',
      pattern: 'SELL_AGGRESSION_ABSORBED_AT_DEMAND',
      reasons: [
        `Agresi jual ${sellPercent}% terserap di demand dan harga tidak turun (${response}).`,
      ],
    };
  } else if (strongBuy && location === 'SUPPLY' && priceResponse?.available && response !== 'UP') {
    absorption = {
      status: 'DETECTED',
      direction: 'BEARISH',
      pattern: 'BUY_AGGRESSION_ABSORBED_AT_SUPPLY',
      reasons: [
        `Agresi beli ${buyPercent}% terserap di supply dan harga tidak naik (${response}).`,
      ],
    };
  }

  let aggressionDirection = null;
  if (strongBuy) aggressionDirection = 'BUY';
  else if (strongSell) aggressionDirection = 'SELL';

  let direction = 'NEUTRAL';
  if (absorption.status === 'DETECTED') {
    direction = absorption.direction === 'BULLISH' ? 'BUY' : 'SELL';
  } else if (aggressionDirection) {
    direction = aggressionDirection;
  }

  const leadingPercent = direction === 'SELL' ? sellPercent : buyPercent;
  let strength = clamp(((Math.max(buyPercent, sellPercent) - 50) / 50) * 0.6 + 0.2, 0.2, 0.85);
  if (absorption.status === 'DETECTED') strength = Math.max(0.75, strength);
  if (status === DATA_INTEGRITY_STATUS.DEGRADED) strength *= 0.6;

  const providerConflict = Boolean(
    providerDirection && absorption.status === 'DETECTED' && providerDirection !== absorption.direction,
  );

  return {
    available: true,
    status,
    buyPercent,
    sellPercent,
    tradesCount,
    delta: finite(of?.delta),
    cvd: finite(of?.cvd),
    imbalance: finite(of?.imbalance),
    aggressionDirection,
    direction,
    leadingPercent,
    strength: round(clamp(strength, 0, 1), 3),
    absorption,
    providerAbsorption: {
      status: of?.absorption?.status ?? null,
      side: of?.absorption?.side ?? null,
      direction: providerDirection,
    },
    providerConflict,
    reasons: absorption.status === 'DETECTED'
      ? absorption.reasons.slice()
      : [`Dominasi agresor BUY ${buyPercent}% / SELL ${sellPercent}% (PAXG proxy).`],
  };
}

function mapIntermarketBias(bias) {
  if (bias === 'BULLISH_GOLD') return 'BUY';
  if (bias === 'BEARISH_GOLD') return 'SELL';
  if (bias === 'MIXED') return 'NEUTRAL';
  return null;
}

export function deriveIntermarketRead(snapshot) {
  const im = snapshot?.intermarketEvidence;
  const status = im?.status ?? DATA_INTEGRITY_STATUS.UNAVAILABLE;
  const direction = mapIntermarketBias(im?.bias);
  if (status === DATA_INTEGRITY_STATUS.UNAVAILABLE || direction == null) {
    return {
      available: false,
      status,
      bias: im?.bias ?? 'INSUFFICIENT_DATA',
      direction: null,
      strength: 0,
      reasons: ['Intermarket tidak tersedia atau belum cukup data; tidak dipakai sebagai bukti.'],
      notProvided: im?.coverage?.notProvided ?? [],
    };
  }

  const score = finite(im.score);
  let strength = 0.4 + Math.min(1, Math.abs(score ?? 0)) * 0.4;
  if (im.strength === 'STRONG') strength += 0.15;
  else if (im.strength === 'WEAK') strength -= 0.1;
  if (status === DATA_INTEGRITY_STATUS.DEGRADED) strength *= 0.75;

  return {
    available: true,
    status,
    bias: im.bias,
    direction,
    score,
    strengthLabel: im.strength ?? null,
    confirmationCount: finite(im.confirmationCount),
    conflictCount: finite(im.conflictCount),
    strength: round(clamp(strength, 0, 1), 3),
    reasons: [`Bias intermarket ${im.bias} (skor ${score ?? '—'}, kekuatan ${im.strength || '—'}).`],
    notProvided: im?.coverage?.notProvided ?? [],
  };
}

export function deriveSetupRead(trends) {
  const m15 = trends?.M15;
  const m5 = trends?.M5;
  const usable = [m15, m5].filter((trend) => trend?.available);
  if (usable.length === 0) {
    return {
      available: false,
      direction: null,
      strength: 0,
      reasons: ['M15/M5 belum tersedia untuk konfirmasi setup.'],
      sources: [],
    };
  }

  const directional = usable.filter((trend) => trend.direction === 'BULLISH' || trend.direction === 'BEARISH');
  if (directional.length === 0) {
    return {
      available: true,
      direction: 'NEUTRAL',
      strength: 0.35,
      reasons: ['M15/M5 sideways; tidak ada konfirmasi setup satu arah.'],
      sources: usable.map((trend) => trend.timeframe),
    };
  }

  const directions = new Set(directional.map((trend) => trend.direction));
  if (directions.size > 1) {
    return {
      available: true,
      direction: 'NEUTRAL',
      strength: 0.3,
      reasons: ['M15 dan M5 saling bertentangan; konfirmasi setup tidak sah.'],
      sources: directional.map((trend) => trend.timeframe),
    };
  }

  const direction = directional[0].direction;
  const strengths = directional.map((trend) => trendStrength(trend));
  const average = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
  const factor = directional.length === 2 ? 0.9 : 0.45;
  return {
    available: true,
    direction: direction === 'BULLISH' ? 'BUY' : 'SELL',
    strength: round(clamp(average * factor, 0, 1), 3),
    reasons: [`M15/M5 ${direction.toLowerCase()} (${directional.length} timeframe).`],
    sources: directional.map((trend) => trend.timeframe),
  };
}

export function deriveEntryRead(snapshot, m1Trend) {
  const scalping = snapshot?.scalpingEvidence;
  if (scalping?.status === DATA_INTEGRITY_STATUS.READY && scalping.trend?.available === true) {
    const direction = mapTrendDirection(scalping.trend.direction);
    const available = direction !== 'UNKNOWN';
    return {
      available,
      direction: available && direction !== 'NEUTRAL'
        ? (direction === 'BULLISH' ? 'BUY' : 'SELL')
        : (available ? 'NEUTRAL' : null),
      trendDirection: direction,
      strength: trendStrength({
        direction,
        adx: scalping.trend.adx,
        emaSlopeAtr: scalping.trend.emaSlopeAtr,
      }),
      source: 'SCALPING_M1_ENGINE',
      reasons: ['Entry trigger diambil dari Scalping M1 engine (tidak dihitung ulang).'],
    };
  }

  const direction = m1Trend?.direction ?? 'UNKNOWN';
  const available = direction !== 'UNKNOWN';
  return {
    available,
    direction: available && direction !== 'NEUTRAL'
      ? (direction === 'BULLISH' ? 'BUY' : 'SELL')
      : (available ? 'NEUTRAL' : null),
    trendDirection: direction,
    strength: trendStrength(m1Trend),
    source: 'XM_OHLC_M1',
    reasons: ['Entry trigger diturunkan dari candle M1 tervalidasi (scalping panel tidak tersedia).'],
  };
}
