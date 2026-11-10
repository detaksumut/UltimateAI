/**
 * tests/helpers/jini-decision-fixtures.mjs
 * Deterministic SYNTHETIC FIXTURES shared by the JINI decision-engine tests.
 *
 * These are not live market data and do not claim market accuracy. They exist
 * only to exercise deterministic policy, conflict handling and traceability.
 */

import {
  buildJiniSnapshotFromPanels,
} from '../../src/services/trading/decision/panelIntegration.js';
import { buildScalpingM1Analysis } from '../../src/services/trading/scalping/scalpingM1.js';

export const NOW = Date.parse('2026-11-04T12:00:00.000Z');
export const SYMBOL = 'XAUUSD';
export const PRICE = 4000;
export const TF_MS = {
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
};
const WAVE = [0, 1.2, 2.4, 3.0, 2.4, 1.2, 0, -1.2, -2.4, -3.0, -2.4, -1.2];

export function iso(ms) {
  return new Date(ms).toISOString();
}

export function makeWaveSeries(timeframe, direction, {
  count = 60,
  price = PRICE,
  phaseOffset = 0,
} = {}) {
  const drift = direction === 'BULLISH' ? 1 : (direction === 'BEARISH' ? -1 : 0);
  const ms = TF_MS[timeframe];
  const raw = [];
  for (let i = 0; i < count; i += 1) {
    raw.push((drift * i) + WAVE[(i + phaseOffset) % WAVE.length]);
  }
  const lastRaw = raw[raw.length - 1];
  const shift = price - lastRaw;

  return raw.map((value, i) => {
    const open = value + shift;
    const close = open + (drift * 0.4);
    return {
      symbol: SYMBOL,
      timeframe,
      open,
      high: Math.max(open, close) + 0.8,
      low: Math.min(open, close) - 0.8,
      close,
      volume: 100 + i,
      source: 'MT5_LOCAL_BRIDGE',
      timestamp: iso(NOW - ((count - 1 - i) * ms)),
    };
  });
}

export function makeFlatM1({ count = 60, price = PRICE } = {}) {
  const candles = [];
  for (let i = 0; i < count; i += 1) {
    candles.push({
      symbol: SYMBOL,
      timeframe: 'M1',
      open: price,
      high: price + 0.8,
      low: price - 0.8,
      close: price,
      volume: 100 + i,
      source: 'MT5_LOCAL_BRIDGE',
      timestamp: iso(NOW - ((count - 1 - i) * 60_000)),
    });
  }
  return candles;
}

export function makeTick({ spread = 0.4, ageMs = 2000 } = {}) {
  return {
    bid: PRICE,
    ask: PRICE + spread,
    timestamp: iso(NOW - ageMs),
    source: 'MT5_LOCAL_BRIDGE',
  };
}

export function makeXmMulti({
  directions = {},
  spread = 0.4,
  omit = [],
  tickAgeMs = 2000,
} = {}) {
  const payloads = {};
  const tick = makeTick({ spread, ageMs: tickAgeMs });
  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']) {
    if (omit.includes(timeframe)) continue;
    const direction = directions[timeframe] || 'NEUTRAL';
    let candles;
    if (timeframe === 'M1' && direction === 'NEUTRAL') {
      candles = makeFlatM1();
    } else {
      const phaseOffset = timeframe === 'M1'
        ? (direction === 'BULLISH' ? 2 : (direction === 'BEARISH' ? 11 : 0))
        : 0;
      candles = makeWaveSeries(timeframe, direction, { phaseOffset });
    }
    payloads[timeframe] = {
      source: 'MT5_LOCAL_BRIDGE',
      candles,
      tick,
      lastCandleAt: candles[candles.length - 1].timestamp,
    };
  }
  return { ok: true, symbol: SYMBOL, payloads, failures: {} };
}

export function enginePayloads(xmMulti) {
  const payloads = {};
  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4']) {
    if (xmMulti.payloads[timeframe]) payloads[timeframe] = xmMulti.payloads[timeframe];
  }
  return payloads;
}

export function makeZone(side, low, high, extra = {}) {
  return {
    id: `${side}-ZONE`,
    timeframe: 'H4',
    side,
    low,
    high,
    proximal: side === 'DEMAND' ? high : low,
    distal: side === 'DEMAND' ? low : high,
    score: 82,
    lifecycle: side === 'DEMAND' ? 'TESTED' : 'FRESH',
    active: true,
    testCount: 1,
    heldRetestCount: 1,
    ...extra,
  };
}

export function makeSupplyDemand({
  at = 'DEMAND',
  price = PRICE + 0.2,
  generatedAt = NOW,
} = {}) {
  let demand;
  let supply;
  if (at === 'DEMAND') {
    demand = makeZone('DEMAND', price - 6, price + 0.8);
    supply = makeZone('SUPPLY', price + 10, price + 16);
  } else if (at === 'SUPPLY') {
    demand = makeZone('DEMAND', price - 16, price - 10);
    supply = makeZone('SUPPLY', price - 0.8, price + 6);
  } else {
    demand = makeZone('DEMAND', price - 26, price - 20);
    supply = makeZone('SUPPLY', price + 20, price + 26);
  }

  return {
    ok: true,
    dataStatus: 'READY',
    dataAvailable: true,
    symbol: SYMBOL,
    generatedAt: iso(generatedAt),
    lastUpdate: iso(generatedAt - 30_000),
    currentPrice: price,
    source: 'MT5_LOCAL_BRIDGE',
    isXmValidated: true,
    nearestDemand: demand,
    nearestSupply: supply,
    strongest: demand,
    confluence: [],
    lifecycleCounts: { FRESH: 1, TESTED: 1, WEAKENED: 0, INVALID: 0 },
    activeZones: [demand, supply],
    zones: [demand, supply],
    warnings: [],
    timeframes: {},
  };
}

export function makeOrderFlow({
  buyPercent = 70,
  lastTradeAt = NOW - 5000,
  absorption = null,
  trades = 150,
} = {}) {
  const buyBase = buyPercent * 10;
  const sellBase = (100 - buyPercent) * 10;
  return {
    ok: true,
    status: 'LIVE',
    classification: 'EXCHANGE_AGGRESSOR',
    window: {
      trades,
      firstTradeAt: iso(lastTradeAt - 60_000),
      lastTradeAt: iso(lastTradeAt),
    },
    volume: { buyBase, sellBase, totalBase: 1000 },
    percentages: { buy: buyPercent, sell: 100 - buyPercent, neutral: 0 },
    delta: buyBase - sellBase,
    imbalance: (buyPercent - 50) / 50,
    cvd: (buyBase - sellBase) * 1.2,
    absorption,
    source: {
      provider: 'Binance Spot',
      endpoint: '/api/v3/aggTrades',
      symbol: 'PAXGUSDT',
      apiKeysRequired: false,
    },
  };
}

export function makeInstrument(id, symbol, status = 'LIVE', latest = 100) {
  return {
    id,
    symbol,
    label: symbol,
    kind: id.includes('us') ? 'yield' : 'price',
    unit: 'index',
    role: id === 'dxy' || id === 'us10y_real' ? 'CORE' : 'CONFIRMATION',
    influenceGroup: id === 'wti' ? 'OIL' : 'USD',
    provider: id === 'us02y' || id === 'us10y_real' ? 'fred' : 'yahoo',
    status,
    latest,
    change: id === 'dxy' ? -0.2 : 0.01,
    changeUnit: id.includes('us') ? 'pp' : 'price',
    changePercent: id.includes('us') ? null : -0.2,
    updatedAt: iso(NOW - 120_000),
  };
}

export function makeIntermarket({
  bias = 'UP',
  generatedAt = NOW - 120_000,
  staleInstruments = [],
} = {}) {
  return {
    ok: true,
    generatedAt: iso(generatedAt),
    providerSummary: { priceSeries: 'Yahoo Finance', noSimulatedData: true },
    gold: { id: 'gold', symbol: SYMBOL, latest: PRICE + 0.2, status: 'LIVE' },
    instruments: [
      makeInstrument('dxy', 'DXY'),
      makeInstrument('us10y', 'US10Y'),
      makeInstrument('us10y_real', 'US10Y_REAL'),
      makeInstrument('us02y', 'US02Y'),
      makeInstrument('wti', 'WTI'),
    ],
    analysis: {
      status: 'OK',
      bias,
      strength: 'MODERATE',
      score: bias === 'DOWN' ? -0.3 : (bias === 'UP' ? 0.3 : 0),
      confirmationCount: 3,
      conflictCount: 1,
      independentConfirmationCount: 2,
      independentConflictCount: 1,
      dominantFactor: { id: 'dxy', symbol: 'DXY', direction: 1 },
      dataCompleteness: {
        available: 5,
        required: 5,
        staleInstruments,
        missing: [],
        correlationWindow: 180,
      },
      factorMetrics: [],
      conflicts: [],
      generatedAt: iso(generatedAt),
      calcVersion: 'test-fixture',
    },
    integrity: { noSimulatedData: true },
  };
}

export function makeTerminal({
  connected = true,
  platformReady = true,
  fatalError = false,
} = {}) {
  return {
    brokerId: 'xm',
    platformId: 'xm',
    platformLabel: 'XM Global',
    url: 'https://www.xm.com/terminal/index.html?token=secret',
    title: 'XM Terminal',
    connected,
    platformReady,
    loginRequired: false,
    chartNoData: false,
    fatalError,
    error: fatalError ? 'Terminal crash' : null,
    sessionPersistent: true,
    capabilities: { chartCanvas: true },
    diagnostics: {
      websocket: { state: 'open', frames: 120, lastFrameAt: iso(NOW - 1000) },
      chart: { canvasCount: 1, noDataVisible: false },
      lastProbeAt: iso(NOW - 3000),
    },
    updatedAt: iso(NOW - 10_000),
  };
}

export function makeBridge({ online = true } = {}) {
  return {
    ok: online,
    online,
    source: online ? 'MT5_LOCAL_BRIDGE' : null,
    symbol: SYMBOL,
    endpoint: 'http://127.0.0.1:20200',
    timeframes: online ? { M1: { count: 60, freshness: 'FRESH' } } : {},
    tick: makeTick(),
    updatedAt: iso(NOW - 5000),
    message: online ? null : 'Bridge offline',
  };
}

export function allDirections(direction) {
  return {
    M1: direction,
    M5: direction,
    M15: direction,
    H1: direction,
    H4: direction,
    D1: direction,
  };
}

export function makeSnapshot(overrides = {}) {
  const directions = overrides.directions || allDirections('BULLISH');
  const spread = overrides.spread ?? 0.4;
  const xmMulti = overrides.xmMulti || makeXmMulti({
    directions,
    spread,
    omit: overrides.omit || [],
    tickAgeMs: overrides.tickAgeMs ?? 2000,
  });
  const price = PRICE + (spread / 2);

  const scalping = overrides.scalping !== undefined
    ? overrides.scalping
    : buildScalpingM1Analysis({ payloads: enginePayloads(xmMulti), now: NOW });

  const orderFlow = 'orderFlow' in overrides
    ? overrides.orderFlow
    : makeOrderFlow({
      buyPercent: overrides.buyPercent ?? 70,
      lastTradeAt: overrides.orderFlowLastTradeAt ?? (NOW - 5000),
      absorption: overrides.absorption ?? null,
    });

  const intermarket = 'intermarket' in overrides
    ? overrides.intermarket
    : makeIntermarket({
      bias: overrides.intermarketBias ?? 'UP',
      generatedAt: overrides.intermarketGeneratedAt ?? (NOW - 120_000),
      staleInstruments: overrides.intermarketStaleInstruments ?? [],
    });

  return buildJiniSnapshotFromPanels({
    xmMulti,
    supplyDemand: 'supplyDemand' in overrides
      ? overrides.supplyDemand
      : makeSupplyDemand({
        at: overrides.at ?? 'DEMAND',
        price,
        generatedAt: overrides.supplyDemandGeneratedAt ?? NOW,
      }),
    scalping,
    orderFlow,
    intermarket,
    terminal: makeTerminal(),
    bridge: makeBridge(),
    now: NOW,
  });
}
