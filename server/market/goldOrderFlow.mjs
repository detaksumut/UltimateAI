/**
 * goldOrderFlow.mjs
 * JIN GOLD ORDER FLOW — real trade aggression, no charts, no simulation.
 *
 * Data source:
 *  - Binance Spot PAXG/USDT aggregated trades. Binance exposes `isBuyerMaker`,
 *    the exchange's own aggressor-side flag, so BUY/SELL aggression is taken
 *    from the feed rather than inferred from price direction.
 *  - PAXG is a gold-backed token, NOT COMEX GC. The COMEX tape requires a CME
 *    feed/credentials and is reported UNAVAILABLE here instead of being faked.
 *
 * Integrity rules:
 *  - Percentages are volume-weighted by aggressor side, never by price change.
 *  - Aggressive volume and institutions are different things. This module never
 *    claims "institutional buying/selling".
 *  - CVD is the cumulative signed volume inside the fetched window only.
 *  - Missing/absent tape yields UNAVAILABLE with null numbers, never estimates.
 *  - If side flags are missing, a validated tick rule may be used and the whole
 *    result is labelled ESTIMATED.
 */

import { BINANCE_SYMBOLS, fetchBinanceAggTrades } from './binanceProviders.mjs';

export const ORDER_FLOW_CALC_VERSION = 'gold-order-flow-v1';
export const ORDER_FLOW_SYMBOL = BINANCE_SYMBOLS.PAXG;
export const ORDER_FLOW_WINDOW_TRADES = 1000;
export const ORDER_FLOW_MIN_TRADES = 30;
export const ORDER_FLOW_BIAS_THRESHOLD = 0.15;
export const ORDER_FLOW_LIVE_WINDOW_MS = 60_000;
export const ORDER_FLOW_DELAYED_WINDOW_MS = 5 * 60_000;
export const ABSORPTION_MIN_NOTIONAL = 10_000;
export const ABSORPTION_MAX_PRICE_MOVE_PCT = 0.05;
export const ABSORPTION_VOLUME_MULTIPLIER = 1.5;

export const COMEX_FEED_INFO = {
  symbol: 'GC',
  label: 'COMEX Gold Futures (GC)',
  status: 'UNAVAILABLE',
  reason: 'Feed trade-tape COMEX/CME dengan aggressor side belum tersedia; CME DataMine memerlukan kredensial.',
  isComex: true,
};

const INSTRUMENT_INFO = {
  symbol: ORDER_FLOW_SYMBOL,
  label: 'PAXG/USDT (Gold token)',
  venue: 'BINANCE SPOT',
  isComex: false,
  isProxy: true,
  proxyFor: 'Gold order-flow context (bukan COMEX GC)',
};

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumBy(trades, selector) {
  return trades.reduce((sum, trade) => sum + (Number(selector(trade)) || 0), 0);
}

function classifyStatus({ lastTradeAt, now }) {
  const time = Number(lastTradeAt);
  if (!Number.isFinite(time) || time <= 0) return 'UNAVAILABLE';
  const age = Math.max(0, now - time);
  if (age <= ORDER_FLOW_LIVE_WINDOW_MS) return 'LIVE';
  if (age <= ORDER_FLOW_DELAYED_WINDOW_MS) return 'DELAYED';
  return 'STALE';
}

function statusDetailFor(status, { lastTradeAt, trades }) {
  if (status === 'UNAVAILABLE') return 'Tape trade Binance tidak tersedia; tidak ada angka pengganti.';
  if (status === 'LIVE') return `${trades} trade terakhir masih segar (≤60 dtk).`;
  if (status === 'DELAYED') return `${trades} trade terakhir tertunda (≤5 mnt).`;
  return `${trades} trade terakhir sudah usang.`;
}

function decideSide(trade, previousPrice, previousSide) {
  if (trade.isBuyerMaker === true) return 'SELL';
  if (trade.isBuyerMaker === false) return 'BUY';
  // Validated tick rule for feeds without maker/taker side. Result is labelled
  // ESTIMATED by the caller; equal prices inherit the previous direction.
  if (Number.isFinite(previousPrice)) {
    if (trade.price > previousPrice) return 'BUY';
    if (trade.price < previousPrice) return 'SELL';
  }
  return previousSide || 'NEUTRAL';
}

function volumeLevelFor({ previousQuote, latestQuote, previousTrades }) {
  if (previousTrades < 10 || !(previousQuote > 0)) {
    return { level: 'UNKNOWN', ratio: null };
  }
  const ratio = latestQuote / previousQuote;
  const level = ratio >= ABSORPTION_VOLUME_MULTIPLIER
    ? 'HIGH'
    : ratio <= 0.6
      ? 'LOW'
      : 'NORMAL';
  return { level, ratio };
}

function absorptionFor({ volumeLevel, volumeRatio, latestQuote, latestChangePct, imbalance, trades }) {
  if (volumeRatio == null || trades < 15) {
    return {
      status: 'UNKNOWN',
      side: null,
      note: 'Sampel belum cukup untuk menilai absorption.',
    };
  }
  const detected = volumeLevel === 'HIGH'
    && latestQuote >= ABSORPTION_MIN_NOTIONAL
    && Number.isFinite(latestChangePct)
    && Math.abs(latestChangePct) <= ABSORPTION_MAX_PRICE_MOVE_PCT;
  if (!detected) {
    return {
      status: 'NOT_DETECTED',
      side: null,
      note: 'Tidak ada volume besar yang diserap tanpa pergerakan harga sebanding.',
    };
  }
  const side = !Number.isFinite(imbalance) || Math.abs(imbalance) < ORDER_FLOW_BIAS_THRESHOLD
    ? 'TWO_WAY'
    : imbalance > 0
      ? 'BUY'
      : 'SELL';
  return {
    status: 'DETECTED',
    side,
    note: 'Volume besar diserap tanpa pergerakan harga sebanding. Absorption bukan bukti arah reversal.',
  };
}

export function unavailableOrderFlow({ now = Date.now(), error = null, reason = null } = {}) {
  return {
    ok: false,
    generatedAt: new Date(now).toISOString(),
    calcVersion: ORDER_FLOW_CALC_VERSION,
    status: 'UNAVAILABLE',
    statusDetail: 'Feed trade-tape tidak tersedia; panel tidak menampilkan angka simulasi.',
    instrument: INSTRUMENT_INFO,
    comex: COMEX_FEED_INFO,
    classification: 'UNKNOWN',
    window: {
      trades: 0,
      requestedTrades: ORDER_FLOW_WINDOW_TRADES,
      firstTradeAt: null,
      lastTradeAt: null,
      durationMs: null,
    },
    price: { first: null, last: null, changePct: null },
    volume: {
      buyBase: null,
      sellBase: null,
      neutralBase: null,
      totalBase: null,
      buyQuote: null,
      sellQuote: null,
      neutralQuote: null,
      totalQuote: null,
    },
    percentages: { buy: null, sell: null, neutral: null },
    delta: null,
    deltaQuote: null,
    imbalance: null,
    cvd: null,
    cvdQuote: null,
    cvdSign: 'UNKNOWN',
    bias: 'NEUTRAL',
    biasSide: 'NEUTRAL',
    biasReason: reason || 'Tape tidak tersedia; bias tidak dapat dinilai.',
    volumeLevel: 'UNKNOWN',
    volumeRatio: null,
    absorption: absorptionFor({ volumeRatio: null, trades: 0 }),
    insufficientSample: true,
    classificationNote: 'Tidak ada data aggressor-side yang dapat divalidasi.',
    notes: buildNotes('UNKNOWN'),
    error: error || 'Binance aggregated trades tidak tersedia.',
  };
}

function buildNotes(classification) {
  const notes = [
    'PAXG/USDT adalah token emas di Binance, BUKAN COMEX GC. COMEX GC ditampilkan UNAVAILABLE sampai feed CME tersedia.',
    'Persentase dihitung dari volume trade berdasarkan sisi agresor (isBuyerMaker), bukan dari naik-turunnya harga.',
    'CVD adalah cumulative signed volume di dalam window trade yang diambil, bukan CVD sepanjang sesi.',
    'Ini bukan institutional buying/selling: identitas institusi tidak diketahui dari tape publik.',
  ];
  if (classification === 'ESTIMATED') {
    notes.push('Feed tidak menyediakan maker/taker side; klasifikasi memakai tick rule dan ditandai ESTIMATED.');
  }
  return notes;
}

export function aggregateOrderFlow({ trades, now = Date.now(), source = null } = {}) {
  const list = (Array.isArray(trades) ? trades : [])
    .map((trade) => ({
      price: finiteOrNull(trade?.price),
      quantity: finiteOrNull(trade?.quantity ?? trade?.qty),
      quoteQuantity: finiteOrNull(trade?.quoteQuantity),
      time: finiteOrNull(trade?.time ?? trade?.T),
      isBuyerMaker: typeof trade?.isBuyerMaker === 'boolean' ? trade.isBuyerMaker : null,
    }))
    .filter((trade) => (
      Number.isFinite(trade.price)
      && trade.price > 0
      && Number.isFinite(trade.quantity)
      && trade.quantity > 0
      && Number.isFinite(trade.time)
      && trade.time > 0
    ))
    .sort((a, b) => a.time - b.time)
    .slice(-ORDER_FLOW_WINDOW_TRADES)
    .map((trade) => ({
      ...trade,
      quoteQuantity: Number.isFinite(trade.quoteQuantity)
        ? trade.quoteQuantity
        : trade.price * trade.quantity,
    }));

  if (list.length === 0) {
    return unavailableOrderFlow({ now, error: 'Tape Binance tidak mengembalikan trade valid.' });
  }

  const hasExchangeSide = list.every((trade) => trade.isBuyerMaker !== null);
  const anyExchangeSide = list.some((trade) => trade.isBuyerMaker !== null);
  const classification = hasExchangeSide
    ? 'EXCHANGE_AGGRESSOR'
    : anyExchangeSide
      ? 'MIXED'
      : 'ESTIMATED';

  const buckets = { BUY: [], SELL: [], NEUTRAL: [] };
  let previousPrice = null;
  let previousSide = null;
  let cvdBase = 0;
  let cvdQuote = 0;
  for (const trade of list) {
    const side = decideSide(trade, previousPrice, previousSide);
    buckets[side].push(trade);
    const sign = side === 'BUY' ? 1 : side === 'SELL' ? -1 : 0;
    cvdBase += sign * trade.quantity;
    cvdQuote += sign * trade.quoteQuantity;
    previousPrice = trade.price;
    if (side !== 'NEUTRAL') previousSide = side;
  }

  const buyBase = sumBy(buckets.BUY, (trade) => trade.quantity);
  const sellBase = sumBy(buckets.SELL, (trade) => trade.quantity);
  const neutralBase = sumBy(buckets.NEUTRAL, (trade) => trade.quantity);
  const buyQuote = sumBy(buckets.BUY, (trade) => trade.quoteQuantity);
  const sellQuote = sumBy(buckets.SELL, (trade) => trade.quoteQuantity);
  const neutralQuote = sumBy(buckets.NEUTRAL, (trade) => trade.quoteQuantity);
  const totalBase = buyBase + sellBase + neutralBase;
  const totalQuote = buyQuote + sellQuote + neutralQuote;
  const delta = buyBase - sellBase;
  const deltaQuote = buyQuote - sellQuote;
  const imbalance = totalBase > 0 ? delta / totalBase : null;

  const firstPrice = list[0].price;
  const lastPrice = list.at(-1).price;
  const priceChangePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : null;

  const mid = Math.floor(list.length / 2);
  const previousHalf = list.slice(0, mid);
  const latestHalf = list.slice(mid);
  const previousQuote = sumBy(previousHalf, (trade) => trade.quoteQuantity);
  const latestQuote = sumBy(latestHalf, (trade) => trade.quoteQuantity);
  const { level: volumeLevel, ratio: volumeRatio } = volumeLevelFor({
    previousQuote,
    latestQuote,
    previousTrades: previousHalf.length,
  });
  const midPrice = latestHalf[0]?.price ?? firstPrice;
  const latestChangePct = midPrice > 0 ? ((lastPrice - midPrice) / midPrice) * 100 : null;
  const absorption = absorptionFor({
    volumeLevel,
    volumeRatio,
    latestQuote,
    latestChangePct,
    imbalance,
    trades: list.length,
  });

  const insufficientSample = list.length < ORDER_FLOW_MIN_TRADES;
  let bias = 'NEUTRAL';
  if (!insufficientSample && Number.isFinite(imbalance)) {
    if (imbalance >= ORDER_FLOW_BIAS_THRESHOLD) bias = 'BUYER DOMINANT';
    else if (imbalance <= -ORDER_FLOW_BIAS_THRESHOLD) bias = 'SELLER DOMINANT';
  }
  const biasSide = bias === 'BUYER DOMINANT' ? 'BUY' : bias === 'SELLER DOMINANT' ? 'SELL' : 'NEUTRAL';
  const biasReason = insufficientSample
    ? `Sampel tipis (${list.length} < ${ORDER_FLOW_MIN_TRADES} trade); bias ditahan NETRAL.`
    : `Buy ${(Number.isFinite(imbalance) ? imbalance * 100 : 0).toFixed(1)}% dari volume agresor gabungan; ambang ±${ORDER_FLOW_BIAS_THRESHOLD * 100}%.`;

  const status = classifyStatus({ lastTradeAt: list.at(-1).time, now });
  const firstTradeAt = new Date(list[0].time).toISOString();
  const lastTradeAt = new Date(list.at(-1).time).toISOString();
  const percentages = totalBase > 0
    ? {
      buy: (buyBase / totalBase) * 100,
      sell: (sellBase / totalBase) * 100,
      neutral: (neutralBase / totalBase) * 100,
    }
    : { buy: null, sell: null, neutral: null };

  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    calcVersion: ORDER_FLOW_CALC_VERSION,
    status,
    statusDetail: statusDetailFor(status, { lastTradeAt, trades: list.length }),
    instrument: INSTRUMENT_INFO,
    comex: COMEX_FEED_INFO,
    source: source || {
      provider: 'Binance Spot',
      endpoint: '/api/v3/aggTrades',
      symbol: ORDER_FLOW_SYMBOL,
      apiKeysRequired: false,
    },
    classification,
    classificationNote: classification === 'ESTIMATED'
      ? 'Maker/taker side tidak tersedia; klasifikasi memakai tick rule dan ditandai ESTIMATED.'
      : 'Agresor diambil dari flag isBuyerMaker bursa (REAL).',
    window: {
      trades: list.length,
      requestedTrades: ORDER_FLOW_WINDOW_TRADES,
      firstTradeAt,
      lastTradeAt,
      durationMs: list.at(-1).time - list[0].time,
    },
    price: {
      first: firstPrice,
      last: lastPrice,
      changePct: Number.isFinite(priceChangePct) ? priceChangePct : null,
    },
    volume: {
      buyBase,
      sellBase,
      neutralBase,
      totalBase,
      buyQuote,
      sellQuote,
      neutralQuote,
      totalQuote,
    },
    percentages,
    delta,
    deltaQuote,
    imbalance: Number.isFinite(imbalance) ? imbalance : null,
    cvd: cvdBase,
    cvdQuote,
    cvdSign: cvdBase > 0 ? 'POSITIVE' : cvdBase < 0 ? 'NEGATIVE' : 'FLAT',
    bias,
    biasSide,
    biasReason,
    volumeLevel,
    volumeRatio,
    absorption,
    insufficientSample,
    notes: buildNotes(classification),
    error: null,
  };
}

export function buildGoldOrderFlow({ raw, now = Date.now() } = {}) {
  if (!raw || raw.ok !== true || !Array.isArray(raw.trades) || raw.trades.length === 0) {
    return unavailableOrderFlow({
      now,
      error: raw?.error || 'Tape Binance tidak tersedia.',
      reason: 'Tape aggressor-side tidak tersedia; tidak ada angka pengganti.',
    });
  }
  return aggregateOrderFlow({
    trades: raw.trades,
    now,
    source: {
      provider: raw.provider || 'Binance Spot',
      endpoint: '/api/v3/aggTrades',
      symbol: raw.symbol || ORDER_FLOW_SYMBOL,
      host: raw.host || null,
      apiKeysRequired: false,
      sourceUrl: raw.sourceUrl || null,
      fetchedAt: raw.fetchedAt || new Date(now).toISOString(),
    },
  });
}

export async function fetchGoldOrderFlow({ now = Date.now() } = {}) {
  let raw;
  try {
    raw = await fetchBinanceAggTrades({
      symbol: ORDER_FLOW_SYMBOL,
      limit: ORDER_FLOW_WINDOW_TRADES,
      market: 'spot',
    });
  } catch (error) {
    raw = { ok: false, error: error?.message || 'Tape Binance tidak terjangkau.' };
  }
  return buildGoldOrderFlow({ raw, now });
}

export const GOLD_ORDER_FLOW_PROVIDER_INFO = {
  id: 'binance-paxg-order-flow',
  instrument: ORDER_FLOW_SYMBOL,
  venue: 'Binance Spot',
  endpoint: '/api/v3/aggTrades',
  windowTrades: ORDER_FLOW_WINDOW_TRADES,
  apiKeysRequired: false,
  comex: COMEX_FEED_INFO,
  note: 'PAXG proxy order flow. COMEX GC tape is UNAVAILABLE without a CME feed.',
};
