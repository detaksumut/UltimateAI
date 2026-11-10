/**
 * adapters.js
 * Pure, deterministic mappers from existing Broker Workspace service outputs
 * into the JINI Gold Decision Engine evidence contract.
 *
 * Principles:
 * - Never recompute indicators that a panel/service already produced.
 * - Never invent values: missing fields become null / UNAVAILABLE.
 * - Preserve timestamps, timeframe identity, source attribution and freshness.
 * - PAXG/USDT stays an explicit proxy; COMEX GC stays UNAVAILABLE.
 * - Auto-trading is never produced here.
 */

import {
  DATA_INTEGRITY_STATUS,
  ORDER_FLOW_VENUE,
  COMEX_INTEGRITY_CONTRACT,
  PROXY_INTEGRITY_CONTRACT,
} from './constants.js';

const SND_ENGINE = 'SND_ENGINE_PHASE1';
const SCALPING_ENGINE = 'SCALPING_M1_ENGINE';
const INTERMARKET_ENGINE = 'FAKTOR_UPDOWN_GOLD';
const MONITOR_ENGINE = 'JINI_MONITOR';
const XM_PROVIDER = 'XM Global MT5 (MT5_LOCAL_BRIDGE)';

const INTERMARKET_REQUIRED_IDS = ['dxy', 'us10y', 'us10y_real', 'us02y', 'wti', 'silver', 'copper', 'sp500'];

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteOrNull(value) {
  return num(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object';
}

function mapZone(zone) {
  if (!isObject(zone)) return null;
  return {
    id: zone.id ?? null,
    timeframe: zone.timeframe ?? null,
    side: zone.side ?? null,
    proximal: finiteOrNull(zone.proximal),
    distal: finiteOrNull(zone.distal),
    high: finiteOrNull(zone.high),
    low: finiteOrNull(zone.low),
    width: finiteOrNull(zone.width),
    widthAtr: finiteOrNull(zone.widthAtr),
    score: finiteOrNull(zone.score),
    lifecycle: zone.lifecycle ?? null,
    active: zone.active !== false,
    testCount: finiteOrNull(zone.testCount),
    heldRetestCount: finiteOrNull(zone.heldRetestCount),
    firstTestTime: zone.firstTestTime ?? null,
    lastTestTime: zone.lastTestTime ?? null,
    displacementAtr: finiteOrNull(zone.displacementAtr),
    departureBodyRatio: finiteOrNull(zone.departureBodyRatio),
    baseQuality: finiteOrNull(zone.baseQuality),
    atr: finiteOrNull(zone.atr),
    structure: {
      bos: zone.bos === true,
      bosLevel: finiteOrNull(zone.bosLevel),
      choch: null,
      chochNote: 'S&D Engine Phase 1 belum mengemit CHoCH; tidak diisi agar tidak mengarang struktur.',
    },
    originTime: zone.originTime ?? null,
    departureTime: zone.departureTime ?? null,
    invalidatedAt: zone.invalidatedAt ?? null,
    invalidReason: zone.invalidReason ?? null,
    wickBreach: zone.wickBreach === true,
    reactionAtr: finiteOrNull(zone.reactionAtr),
    recency: finiteOrNull(zone.recency),
    ageBars: finiteOrNull(zone.ageBars),
    reasons: Array.isArray(zone.reasons) ? zone.reasons.slice() : [],
  };
}

function mapConfluence(cluster) {
  if (!isObject(cluster)) return null;
  return {
    id: cluster.id ?? null,
    side: cluster.side ?? null,
    low: finiteOrNull(cluster.low),
    high: finiteOrNull(cluster.high),
    proximal: finiteOrNull(cluster.proximal),
    distal: finiteOrNull(cluster.distal),
    strength: finiteOrNull(cluster.strength),
    weightedScore: finiteOrNull(cluster.weightedScore),
    isConfluence: cluster.isConfluence === true,
    confluenceLevel: finiteOrNull(cluster.confluenceLevel),
    timeframes: Array.isArray(cluster.timeframes) ? cluster.timeframes.slice() : [],
    distance: finiteOrNull(cluster.distance),
    distanceAtr: finiteOrNull(cluster.distanceAtr),
    position: cluster.position ?? null,
    members: Array.isArray(cluster.members) ? cluster.members.map(mapZone).filter(Boolean) : [],
  };
}

export function adaptSupplyDemandEvidence(raw) {
  const attribution = {
    engine: SND_ENGINE,
    provider: XM_PROVIDER,
    derivedFrom: 'XM XAUUSD OHLC (validated)',
    isXmValidated: raw?.isXmValidated === true,
    source: raw?.source ?? null,
    limitation: 'S&D hanya mendeteksi zona; tidak menghasilkan sinyal BUY/SELL.',
  };

  if (!isObject(raw)) {
    return {
      source: SND_ENGINE,
      status: DATA_INTEGRITY_STATUS.UNAVAILABLE,
      dataAvailable: false,
      generatedAt: null,
      lastUpdate: null,
      symbol: 'XAUUSD',
      currentPrice: null,
      isXmValidated: false,
      nearestDemand: null,
      nearestSupply: null,
      strongest: null,
      confluence: [],
      lifecycleCounts: {},
      activeZoneCount: 0,
      timeframes: {},
      warnings: [],
      attribution,
    };
  }

  const timeframes = {};
  for (const [tf, summary] of Object.entries(raw.timeframes || {})) {
    if (!isObject(summary)) continue;
    timeframes[tf] = {
      timeframe: summary.timeframe || tf,
      status: summary.status ?? DATA_INTEGRITY_STATUS.UNAVAILABLE,
      ok: summary.ok === true,
      isXmValidated: summary.isXmValidated === true,
      source: summary.source ?? null,
      freshness: summary.freshness ?? 'NO_DATA',
      count: finiteOrNull(summary.count) ?? 0,
      qualityScore: finiteOrNull(summary.qualityScore),
      completeness: finiteOrNull(summary.completeness),
      gapRatio: finiteOrNull(summary.gapRatio),
      brokerClockOffsetMs: finiteOrNull(summary.brokerClockOffsetMs),
      lastTime: summary.lastTime ?? null,
      atr: finiteOrNull(summary.atr),
      activeZones: Array.isArray(summary.activeZones)
        ? summary.activeZones.map(mapZone).filter(Boolean)
        : [],
      zones: Array.isArray(summary.zones) ? summary.zones.map(mapZone).filter(Boolean) : [],
      warnings: Array.isArray(summary.warnings) ? summary.warnings.slice() : [],
      errors: Array.isArray(summary.errors) ? summary.errors.slice() : [],
    };
  }

  const dataAvailable = raw.dataAvailable === true && raw.dataStatus === 'READY';

  return {
    source: SND_ENGINE,
    status: dataAvailable ? DATA_INTEGRITY_STATUS.READY : DATA_INTEGRITY_STATUS.UNAVAILABLE,
    dataAvailable,
    generatedAt: raw.generatedAt ?? null,
    lastUpdate: raw.lastUpdate ?? null,
    symbol: raw.symbol ?? 'XAUUSD',
    currentPrice: finiteOrNull(raw.currentPrice),
    isXmValidated: raw.isXmValidated === true,
    nearestDemand: mapZone(raw.nearestDemand),
    nearestSupply: mapZone(raw.nearestSupply),
    strongest: mapZone(raw.strongest),
    confluence: Array.isArray(raw.confluence) ? raw.confluence.map(mapConfluence).filter(Boolean) : [],
    lifecycleCounts: isObject(raw.lifecycleCounts) ? { ...raw.lifecycleCounts } : {},
    activeZoneCount: Array.isArray(raw.activeZones) ? raw.activeZones.length : 0,
    timeframes,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.slice() : [],
    partial: raw.partial === true,
    attribution,
  };
}

function mapTrend(trend) {
  if (!isObject(trend)) {
    return {
      available: false,
      direction: 'UNKNOWN',
      condition: 'UNKNOWN',
      emaFast: null,
      emaSlow: null,
      emaSlopeAtr: null,
      adx: null,
      efficiencyRatio: null,
      atr: null,
      reasons: [],
    };
  }
  return {
    available: trend.available === true,
    direction: trend.trend ?? 'UNKNOWN',
    condition: trend.condition ?? 'UNKNOWN',
    close: finiteOrNull(trend.close),
    emaFast: finiteOrNull(trend.emaFast),
    emaSlow: finiteOrNull(trend.emaSlow),
    emaSlopeAtr: finiteOrNull(trend.emaSlopeAtr),
    adx: finiteOrNull(trend.adx),
    efficiencyRatio: finiteOrNull(trend.efficiencyRatio),
    atr: finiteOrNull(trend.atr),
    reasons: Array.isArray(trend.reasons) ? trend.reasons.slice() : [],
    dataSource: trend.dataSource ?? null,
  };
}

export function adaptScalpingEvidence(raw) {
  const attribution = {
    engine: SCALPING_ENGINE,
    provider: XM_PROVIDER,
    derivedFrom: 'XM XAUUSD M1 OHLC + tick bid/ask',
    isXmValidated: raw?.isXmValidated === true,
    source: raw?.source ?? null,
    limitation: 'Preview hanya; tidak ada sinyal BUY/SELL dan tidak ada auto-order.',
  };

  if (!isObject(raw)) {
    return {
      source: SCALPING_ENGINE,
      status: DATA_INTEGRITY_STATUS.UNAVAILABLE,
      dataAvailable: false,
      generatedAt: null,
      symbol: 'XAUUSD',
      currentPrice: null,
      isXmValidated: false,
      trend: mapTrend(null),
      momentum: { efficiencyRatio: null, adx: null, emaSlopeAtr: null },
      volatility: null,
      spread: null,
      spreadToAtr: null,
      context: null,
      setupStatus: null,
      supplyDemandM1: null,
      warnings: [],
      attribution,
    };
  }

  const trend = mapTrend(raw.trend);
  const spread = isObject(raw.spread) ? { ...raw.spread } : null;
  const momentum = {
    efficiencyRatio: trend.efficiencyRatio,
    adx: trend.adx,
    emaSlopeAtr: trend.emaSlopeAtr,
    source: 'DARI_METRIK_M1_TERHITUNG',
  };

  return {
    source: SCALPING_ENGINE,
    status: raw.dataAvailable === true && raw.dataStatus === 'READY'
      ? DATA_INTEGRITY_STATUS.READY
      : DATA_INTEGRITY_STATUS.UNAVAILABLE,
    dataAvailable: raw.dataAvailable === true,
    generatedAt: raw.generatedAt ?? null,
    symbol: raw.symbol ?? 'XAUUSD',
    currentPrice: finiteOrNull(raw.currentPrice),
    isXmValidated: raw.isXmValidated === true,
    trend,
    momentum,
    volatility: isObject(raw.volatility) ? { ...raw.volatility } : null,
    spread,
    spreadToAtr: finiteOrNull(spread?.spreadPctOfAtr),
    context: isObject(raw.context) ? {
      sync: raw.context.sync ?? 'NO_HTF_CONTEXT',
      nearestM1: mapZone(raw.context.nearestM1),
      aligned: Array.isArray(raw.context.aligned) ? raw.context.aligned.map(mapZone).filter(Boolean) : [],
      conflicting: Array.isArray(raw.context.conflicting) ? raw.context.conflicting.map(mapZone).filter(Boolean) : [],
      zones: Array.isArray(raw.context.zones) ? raw.context.zones.map(mapZone).filter(Boolean) : [],
    } : null,
    setupStatus: isObject(raw.setupStatus) ? { ...raw.setupStatus } : null,
    supplyDemandM1: isObject(raw.supplyDemand)
      ? {
        timeframe: raw.supplyDemand.timeframe ?? 'M1',
        status: raw.supplyDemand.status ?? null,
        freshness: raw.supplyDemand.freshness ?? null,
        atr: finiteOrNull(raw.supplyDemand.atr),
        activeZones: Array.isArray(raw.supplyDemand.activeZones)
          ? raw.supplyDemand.activeZones.map(mapZone).filter(Boolean)
          : [],
        nearestDemand: mapZone(raw.supplyDemand.nearestDemand),
        nearestSupply: mapZone(raw.supplyDemand.nearestSupply),
        strongest: mapZone(raw.supplyDemand.strongest),
        lifecycleCounts: isObject(raw.supplyDemand.lifecycleCounts) ? { ...raw.supplyDemand.lifecycleCounts } : {},
      }
      : null,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.slice() : [],
    attribution,
  };
}

export function adaptOrderFlowEvidence(normalized, rawProvider = null) {
  const provider = isObject(rawProvider) ? rawProvider : null;
  const isUnavailable = !normalized || normalized.status === DATA_INTEGRITY_STATUS.UNAVAILABLE;
  const metrics = normalized?.metrics || { buyVolume: 0, sellVolume: 0, totalVolume: 0, buyPercent: null, sellPercent: null, deltaVolume: null };
  const totalVolume = finiteOrNull(metrics.totalVolume);
  const providerImbalance = finiteOrNull(provider?.imbalance);
  const derivedImbalance = totalVolume && totalVolume > 0 && finiteOrNull(metrics.deltaVolume) != null
    ? finiteOrNull(metrics.deltaVolume) / totalVolume
    : null;
  // UNAVAILABLE must never look like a real 0/50% split.
  const present = (value) => (isUnavailable ? null : value);

  return {
    source: 'GOLD_ORDER_FLOW',
    provider: provider?.source?.provider || 'Binance Spot PAXG/USDT',
    venue: ORDER_FLOW_VENUE.PAXG_PROXY,
    isProxy: true,
    isComex: false,
    status: normalized?.status ?? DATA_INTEGRITY_STATUS.UNAVAILABLE,
    freshness: normalized?.freshness ?? DATA_INTEGRITY_STATUS.UNAVAILABLE,
    tradesCount: normalized?.tradesCount ?? 0,
    lastTradeAt: normalized?.lastTradeAt ?? null,
    ageMs: normalized?.ageMs ?? null,
    aggressiveBuy: present(finiteOrNull(metrics.buyVolume)),
    aggressiveSell: present(finiteOrNull(metrics.sellVolume)),
    buyPercent: present(finiteOrNull(metrics.buyPercent)),
    sellPercent: present(finiteOrNull(metrics.sellPercent)),
    delta: present(finiteOrNull(metrics.deltaVolume)),
    deltaFromProvider: present(finiteOrNull(provider?.delta)),
    cvd: present(finiteOrNull(normalized?.cvd)),
    imbalance: present(providerImbalance != null ? providerImbalance : derivedImbalance),
    imbalanceSource: isUnavailable ? null : (providerImbalance != null ? 'PROVIDER' : (derivedImbalance != null ? 'DERIVED_FROM_VOLUME' : null)),
    absorption: normalized?.absorption ? { ...normalized.absorption } : null,
    absorptionDetected: normalized?.absorptionDetected === true,
    classification: provider?.classification ?? null,
    windowTrades: finiteOrNull(provider?.window?.trades) ?? (normalized?.tradesCount ?? 0),
    comex: COMEX_INTEGRITY_CONTRACT,
    proxy: PROXY_INTEGRITY_CONTRACT,
    note: normalized?.note ?? null,
    attribution: {
      engine: 'GOLD_ORDER_FLOW',
      provider: provider?.source?.provider || 'Binance Spot',
      endpoint: provider?.source?.endpoint || '/api/v3/aggTrades',
      symbol: provider?.source?.symbol || 'PAXGUSDT',
      apiKeysRequired: provider?.source?.apiKeysRequired === true,
      isProxy: true,
      isComex: false,
      limitation: 'PAXG/USDT adalah proxy token emas, bukan tape COMEX GC.',
    },
  };
}

function mapMacroBias(rawBias) {
  switch (rawBias) {
    case 'UP': return 'BULLISH_GOLD';
    case 'DOWN': return 'BEARISH_GOLD';
    case 'MIXED': return 'MIXED';
    case 'INSUFFICIENT DATA': return 'INSUFFICIENT_DATA';
    default: return 'INSUFFICIENT_DATA';
  }
}

function mapIntermarketInstrument(instrument) {
  if (!isObject(instrument)) return null;
  return {
    id: instrument.id ?? null,
    symbol: instrument.symbol ?? null,
    label: instrument.label ?? null,
    kind: instrument.kind ?? null,
    unit: instrument.unit ?? null,
    role: instrument.role ?? null,
    influenceGroup: instrument.influenceGroup ?? null,
    provider: instrument.provider ?? null,
    providerSymbol: instrument.providerSymbol ?? null,
    status: instrument.status ?? 'UNAVAILABLE',
    latest: finiteOrNull(instrument.latest),
    previousClose: finiteOrNull(instrument.previousClose),
    change: finiteOrNull(instrument.change),
    changeUnit: instrument.changeUnit ?? null,
    changePercent: finiteOrNull(instrument.changePercent),
    updatedAt: instrument.updatedAt ?? null,
    lastObservationDate: instrument.lastObservationDate ?? null,
    proxy: instrument.proxy ?? null,
    marketState: instrument.marketState ?? null,
    error: instrument.error ?? null,
  };
}

export function adaptIntermarketEvidence(raw) {
  const attribution = {
    engine: INTERMARKET_ENGINE,
    providers: raw?.providerSummary || null,
    limitation: 'Korelasi bukan kausalitas; feed publik dapat tertunda.',
  };

  if (!isObject(raw) || raw.ok !== true || !isObject(raw.analysis)) {
    return {
      source: INTERMARKET_ENGINE,
      status: DATA_INTEGRITY_STATUS.UNAVAILABLE,
      generatedAt: raw?.generatedAt ?? null,
      bias: 'INSUFFICIENT_DATA',
      rawBias: 'INSUFFICIENT DATA',
      strength: 'WEAK',
      score: null,
      confirmationCount: 0,
      conflictCount: 0,
      dataCompleteness: null,
      instruments: [],
      instrumentsById: {},
      factorMetrics: [],
      conflicts: [],
      oil: null,
      coverage: {
        required: INTERMARKET_REQUIRED_IDS.slice(),
        available: [],
        notProvided: INTERMARKET_REQUIRED_IDS.slice(),
      },
      attribution,
    };
  }

  const analysis = raw.analysis;
  const instruments = Array.isArray(raw.instruments)
    ? raw.instruments.map(mapIntermarketInstrument).filter(Boolean)
    : [];
  const instrumentsById = Object.fromEntries(
    instruments.filter((instrument) => instrument.id).map((instrument) => [instrument.id, instrument]),
  );
  const available = instruments
    .filter((instrument) => instrument.status !== 'UNAVAILABLE' && instrument.latest != null)
    .map((instrument) => instrument.id);
  const notProvided = INTERMARKET_REQUIRED_IDS.filter((id) => !instrumentsById[id]);
  const staleInstruments = analysis?.dataCompleteness?.staleInstruments || [];

  let status = DATA_INTEGRITY_STATUS.READY;
  if (analysis?.bias === 'INSUFFICIENT DATA') {
    status = DATA_INTEGRITY_STATUS.DEGRADED;
  } else if (staleInstruments.length > 0) {
    status = DATA_INTEGRITY_STATUS.DEGRADED;
  }
  if (analysis?.status === 'INSUFFICIENT_DATA') {
    status = DATA_INTEGRITY_STATUS.DEGRADED;
  }

  return {
    source: INTERMARKET_ENGINE,
    status,
    generatedAt: analysis?.generatedAt || raw.generatedAt || null,
    bias: mapMacroBias(analysis?.bias),
    rawBias: analysis?.bias ?? 'INSUFFICIENT DATA',
    strength: analysis?.strength ?? 'WEAK',
    score: finiteOrNull(analysis?.score),
    confirmationCount: finiteOrNull(analysis?.confirmationCount) ?? 0,
    conflictCount: finiteOrNull(analysis?.conflictCount) ?? 0,
    independentConfirmationCount: finiteOrNull(analysis?.independentConfirmationCount) ?? 0,
    independentConflictCount: finiteOrNull(analysis?.independentConflictCount) ?? 0,
    dominantFactor: isObject(analysis?.dominantFactor) ? { ...analysis.dominantFactor } : null,
    dataCompleteness: isObject(analysis?.dataCompleteness) ? { ...analysis.dataCompleteness } : null,
    instruments,
    instrumentsById,
    factorMetrics: Array.isArray(analysis?.factorMetrics) ? analysis.factorMetrics.slice() : [],
    conflicts: Array.isArray(analysis?.conflicts) ? analysis.conflicts.slice() : [],
    oil: isObject(analysis?.oil) ? { ...analysis.oil } : null,
    staleInstruments,
    coverage: {
      required: INTERMARKET_REQUIRED_IDS.slice(),
      available,
      notProvided,
      note: notProvided.length > 0
        ? `Provider FAKTOR UP/DOWN GOLD saat ini belum menyediakan: ${notProvided.join(', ')}. Tidak diisi dengan data simulasi.`
        : null,
    },
    goldBaseline: isObject(raw.gold) ? { ...raw.gold } : null,
    attribution,
  };
}

function sanitizeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (_) {
    return null;
  }
}

function terminalQuality({ terminal, bridge }) {
  if (!isObject(terminal) && !isObject(bridge)) return 'UNKNOWN';
  if (terminal?.fatalError === true) return 'OFFLINE';
  if (terminal?.connected !== true) return 'OFFLINE';
  const wsState = terminal?.diagnostics?.websocket?.state || 'none';
  if (terminal?.platformReady === true && (wsState === 'open' || wsState === 'connecting')) return 'HEALTHY';
  if (terminal?.platformReady === true) return 'HEALTHY';
  if (bridge?.online === true) return 'DEGRADED';
  return 'DEGRADED';
}

export function adaptTerminalStatus(rawTerminal, rawBridge = null) {
  const terminal = isObject(rawTerminal) ? rawTerminal : null;
  const bridge = isObject(rawBridge) ? rawBridge : null;
  const ws = terminal?.diagnostics?.websocket || null;
  const chart = terminal?.diagnostics?.chart || null;

  const terminalStatusValue = !terminal
    ? DATA_INTEGRITY_STATUS.UNAVAILABLE
    : (terminal.fatalError === true || terminal.connected !== true
      ? DATA_INTEGRITY_STATUS.UNAVAILABLE
      : terminal.platformReady === true
        ? DATA_INTEGRITY_STATUS.READY
        : DATA_INTEGRITY_STATUS.DEGRADED);

  const bridgeStatusValue = !bridge
    ? DATA_INTEGRITY_STATUS.UNAVAILABLE
    : (bridge.online === true ? DATA_INTEGRITY_STATUS.READY : DATA_INTEGRITY_STATUS.UNAVAILABLE);

  return {
    source: MONITOR_ENGINE,
    status: terminalStatusValue === DATA_INTEGRITY_STATUS.READY && bridgeStatusValue === DATA_INTEGRITY_STATUS.READY
      ? DATA_INTEGRITY_STATUS.READY
      : (terminalStatusValue === DATA_INTEGRITY_STATUS.UNAVAILABLE && bridgeStatusValue === DATA_INTEGRITY_STATUS.UNAVAILABLE
        ? DATA_INTEGRITY_STATUS.UNAVAILABLE
        : DATA_INTEGRITY_STATUS.DEGRADED),
    connectionQuality: terminalQuality({ terminal, bridge }),
    updatedAt: terminal?.updatedAt || bridge?.updatedAt || null,
    xmTerminal: {
      status: terminalStatusValue,
      brokerId: terminal?.brokerId ?? null,
      platformId: terminal?.platformId ?? null,
      platformLabel: terminal?.platformLabel ?? null,
      url: sanitizeUrl(terminal?.url),
      title: terminal?.title ?? null,
      connected: terminal?.connected === true,
      platformReady: terminal?.platformReady === true,
      loginRequired: terminal?.loginRequired === true,
      chartNoData: terminal?.chartNoData === true,
      fatalError: terminal?.fatalError === true,
      error: terminal?.error ?? null,
      sessionPersistent: terminal?.sessionPersistent === true,
      capabilities: isObject(terminal?.capabilities) ? { ...terminal.capabilities } : {},
      chart: isObject(chart) ? { ...chart } : null,
      websocket: isObject(ws) ? { ...ws } : null,
      updatedAt: terminal?.updatedAt ?? null,
    },
    bridge: {
      status: bridgeStatusValue,
      online: bridge?.online === true,
      source: bridge?.source ?? null,
      symbol: bridge?.symbol ?? null,
      endpoint: sanitizeUrl(bridge?.endpoint),
      timeframes: isObject(bridge?.timeframes) ? { ...bridge.timeframes } : {},
      error: bridge?.message ?? null,
      updatedAt: bridge?.updatedAt ?? null,
    },
    attribution: {
      engine: MONITOR_ENGINE,
      provider: 'Electron BrokerWorkspaceManager',
      note: 'Status terminal/bridge bersifat operasional, bukan bukti arah harga.',
    },
  };
}
