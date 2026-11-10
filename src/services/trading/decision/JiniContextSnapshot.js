/**
 * JiniContextSnapshot.js
 * Consolidated Context Aggregator & Integrity Verifier for JINI Gold Decision Engine.
 *
 * Contract (v2) — JINI_TRADING_CONTEXT_SNAPSHOT:
 *   snapshotId, timestamp, instrument, marketSession, priceData,
 *   timeframeAnalysis, trendContext, supplyDemandEvidence, scalpingEvidence,
 *   orderFlowEvidence, intermarketEvidence, terminalStatus, sourceFreshness,
 *   sourceIntegrity, crossSourceTiming, criticalSourcesMissing,
 *   optionalSourcesMissing, degradedSources, missingSources,
 *   overallIntegrity, evidenceHash.
 *
 * The legacy `sources` subtree from v1 is preserved for backward compatibility.
 *
 * Integrity rules:
 * - All inputs are normalized; no synthetic values are created.
 * - Critical XM sources missing => overallIntegrity UNAVAILABLE (fail-closed).
 * - PAXG proxy and COMEX UNAVAILABLE attribution is non-negotiable.
 * - Cross-source timestamps are compared explicitly; skew is reported, never hidden.
 * - The snapshot is deep-frozen and carries a verifiable evidence hash.
 */

import crypto from 'crypto';
import {
  ENGINE_VERSION,
  DATA_INTEGRITY_STATUS,
  COMEX_INTEGRITY_CONTRACT,
  PROXY_INTEGRITY_CONTRACT,
  FRESHNESS_SLA_MS,
} from './constants.js';
import {
  normalizeMultiTimeframeCandles,
  normalizeOrderFlowSnapshot,
  normalizeTickData,
} from './normalizer.js';
import {
  adaptIntermarketEvidence,
  adaptOrderFlowEvidence,
  adaptScalpingEvidence,
  adaptSupplyDemandEvidence,
  adaptTerminalStatus,
} from './adapters.js';
import { evaluateSourceTiming, toEpochMs } from './timing.js';
import { getMarketSession } from '../marketSession.js';

export const SNAPSHOT_CONTRACT_VERSION = 'jini-context-snapshot-v2';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
const XM_PROVIDER = 'XM Global MT5 (MT5_LOCAL_BRIDGE)';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rawEntryMeta(rawEntry) {
  return isObject(rawEntry) ? rawEntry : {};
}

/**
 * Deep freezes an object to make it completely immutable.
 */
export function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const prop = obj[key];
    if (prop && typeof prop === 'object' && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  }
  return obj;
}

/**
 * Canonical, recursive JSON stringification with sorted object keys.
 * Unlike `JSON.stringify(value, [...keys])`, this keeps nested evidence intact,
 * so two snapshots with different contents can never share the same hash.
 */
export function stableStringify(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Generates a deterministic SHA-256 hash over the full snapshot evidence.
 * `evidenceHash` itself is excluded so the hash can be re-verified later.
 */
export function computeSnapshotEvidenceHash(payload) {
  try {
    const clone = { ...(payload || {}) };
    delete clone.evidenceHash;
    const jsonStr = stableStringify(clone);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  } catch (_) {
    return 'EVIDENCE_HASH_GENERATION_FAILED';
  }
}

function buildTimeframeAnalysis(rawXMCandles, xmCandles) {
  const analysis = {};
  for (const timeframe of TIMEFRAMES) {
    const series = xmCandles[timeframe];
    const meta = rawEntryMeta(rawXMCandles?.[timeframe]);
    const last = series?.lastCandle || null;
    analysis[timeframe] = {
      timeframe,
      count: series?.count ?? 0,
      ready: series?.ready === true,
      freshness: series?.freshness || { status: 'NO_DATA' },
      integrity: series?.integrity || DATA_INTEGRITY_STATUS.UNAVAILABLE,
      lastCandleAt: last?.timestamp || meta.lastCandleAt || null,
      lastClose: last?.close ?? null,
      lastOhlc: last
        ? {
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          volume: last.volume,
        }
        : null,
      source: meta.source || null,
      isXmSource: meta.source ? String(meta.source).toUpperCase() === 'MT5_LOCAL_BRIDGE' : null,
    };
  }
  return analysis;
}

function buildTrendContext({ scalpingEvidence, supplyDemandEvidence, timeframeAnalysis }) {
  const higherTimeframes = {};
  for (const timeframe of ['M5', 'M15', 'H1', 'H4', 'D1']) {
    const tf = timeframeAnalysis[timeframe];
    const sdTf = supplyDemandEvidence?.timeframes?.[timeframe];
    higherTimeframes[timeframe] = {
      lastClose: tf?.lastClose ?? null,
      lastCandleAt: tf?.lastCandleAt ?? null,
      count: tf?.count ?? 0,
      ready: tf?.ready === true,
      integrity: tf?.integrity ?? DATA_INTEGRITY_STATUS.UNAVAILABLE,
      activeZoneCount: Array.isArray(sdTf?.activeZones) ? sdTf.activeZones.length : 0,
    };
  }

  return {
    source: 'SNAPSHOT_AGGREGATION',
    directionalBias: 'NOT_COMPUTED_UNTIL_TAHAP_3',
    m1: scalpingEvidence?.trend || null,
    scalpingSetup: scalpingEvidence?.setupStatus?.code ?? null,
    higherTimeframes,
    note: 'Arah trend D1/H4 belum dihitung di Tahap 2. Snapshot hanya membawa bukti tervalidasi; engine deterministik Tahap 3 yang menetapkan bias.',
  };
}

function buildPriceData({ rawXMTick, xmTick, marketSession, now }) {
  const tickEpoch = toEpochMs(xmTick.timestamp);
  const tickAgeMs = Number.isFinite(tickEpoch) ? Math.max(0, now - tickEpoch) : null;
  return {
    source: xmTick.source,
    provider: XM_PROVIDER,
    valid: xmTick.valid,
    bid: xmTick.bid,
    ask: xmTick.ask,
    mid: xmTick.mid,
    spread: xmTick.spreadPips,
    spreadPips: xmTick.spreadPips,
    spreadAcceptable: xmTick.spreadAcceptable,
    tickTimestamp: xmTick.timestamp,
    tickAgeMs,
    marketClosed: marketSession.marketClosed === true,
    rawTimestampProvided: Boolean(rawXMTick?.timestamp),
    timestampVerified: Boolean(rawXMTick?.timestamp) && Number.isFinite(tickEpoch),
  };
}

function buildSourceIntegrity({ xmTick, xmCandles, orderFlowEvidence, intermarketEvidence, supplyDemandEvidence, scalpingEvidence, terminalStatus }) {
  const integrity = {
    XM_TICK: {
      level: xmTick.valid ? DATA_INTEGRITY_STATUS.READY : DATA_INTEGRITY_STATUS.UNAVAILABLE,
      validated: xmTick.valid,
      attribution: { provider: XM_PROVIDER, source: xmTick.source, priceSource: 'PRIMARY' },
    },
    SUPPLY_DEMAND: {
      level: supplyDemandEvidence.status,
      validated: supplyDemandEvidence.isXmValidated === true,
      attribution: supplyDemandEvidence.attribution,
    },
    SCALPING_M1: {
      level: scalpingEvidence.status,
      validated: scalpingEvidence.isXmValidated === true,
      attribution: scalpingEvidence.attribution,
    },
    ORDER_FLOW: {
      level: orderFlowEvidence.status,
      validated: orderFlowEvidence.classification === 'EXCHANGE_AGGRESSOR',
      isProxy: true,
      isComex: false,
      attribution: orderFlowEvidence.attribution,
      comex: COMEX_INTEGRITY_CONTRACT,
    },
    INTERMARKET: {
      level: intermarketEvidence.status,
      validated: intermarketEvidence.status === DATA_INTEGRITY_STATUS.READY,
      attribution: intermarketEvidence.attribution,
    },
    JINI_MONITOR: {
      level: terminalStatus.status,
      validated: terminalStatus.xmTerminal?.connected === true,
      attribution: terminalStatus.attribution,
    },
    MT5_BRIDGE: {
      level: terminalStatus.bridge?.status || DATA_INTEGRITY_STATUS.UNAVAILABLE,
      validated: terminalStatus.bridge?.online === true,
      attribution: {
        provider: XM_PROVIDER,
        endpoint: terminalStatus.bridge?.endpoint || null,
        source: terminalStatus.bridge?.source || null,
      },
    },
  };

  for (const timeframe of TIMEFRAMES) {
    const series = xmCandles[timeframe];
    integrity[`XM_${timeframe}`] = {
      level: series?.integrity || DATA_INTEGRITY_STATUS.UNAVAILABLE,
      validated: series?.ready === true,
      attribution: { provider: XM_PROVIDER, timeframe },
    };
  }

  return integrity;
}

function buildTimingEntries({ now, marketSession, xmTick, rawXMTick, xmCandles, supplyDemandEvidence, scalpingEvidence, orderFlowEvidence, intermarketEvidence, terminalStatus, rawTerminal, rawBridge }) {
  const marketClosed = marketSession.marketClosed === true;
  // A missing tick timestamp must not be replaced with "now": freshness is
  // derived from the real broker timestamp, otherwise it would fail-open.
  const tickHasTimestamp = Boolean(rawXMTick?.timestamp);
  const entries = [
    {
      id: 'XM_TICK',
      dataAsOf: tickHasTimestamp ? rawXMTick.timestamp : null,
      slaMs: FRESHNESS_SLA_MS.XM_M1,
      status: xmTick.valid && tickHasTimestamp ? undefined : DATA_INTEGRITY_STATUS.UNAVAILABLE,
      marketClosed,
    },
  ];

  for (const timeframe of TIMEFRAMES) {
    const series = xmCandles[timeframe];
    entries.push({
      id: `XM_${timeframe}`,
      dataAsOf: series?.lastCandle?.timestamp || null,
      slaMs: FRESHNESS_SLA_MS[`XM_${timeframe}`] || null,
      status: series?.freshness?.status || 'NO_DATA',
      marketClosed,
      note: series?.freshness?.sessionNote || null,
    });
  }

  entries.push(
    {
      id: 'SUPPLY_DEMAND',
      dataAsOf: supplyDemandEvidence?.generatedAt || supplyDemandEvidence?.lastUpdate || null,
      slaMs: 300_000,
      // Content availability comes from the evidence; freshness is derived from
      // its real timestamp so an old panel cannot be reported as fresh.
      status: supplyDemandEvidence?.status === DATA_INTEGRITY_STATUS.UNAVAILABLE
        ? DATA_INTEGRITY_STATUS.UNAVAILABLE
        : undefined,
    },
    {
      id: 'SCALPING_M1',
      dataAsOf: scalpingEvidence?.generatedAt || null,
      slaMs: FRESHNESS_SLA_MS.XM_M1,
      status: scalpingEvidence?.status === DATA_INTEGRITY_STATUS.UNAVAILABLE
        ? DATA_INTEGRITY_STATUS.UNAVAILABLE
        : undefined,
    },
    {
      id: 'ORDER_FLOW',
      dataAsOf: orderFlowEvidence?.lastTradeAt || null,
      slaMs: FRESHNESS_SLA_MS.ORDER_FLOW_DELAYED,
      status: orderFlowEvidence?.status || DATA_INTEGRITY_STATUS.UNAVAILABLE,
    },
    {
      id: 'INTERMARKET',
      dataAsOf: intermarketEvidence?.generatedAt || null,
      slaMs: FRESHNESS_SLA_MS.INTERMARKET_LIVE,
      status: intermarketEvidence?.status === DATA_INTEGRITY_STATUS.UNAVAILABLE
        ? DATA_INTEGRITY_STATUS.UNAVAILABLE
        : undefined,
    },
    {
      id: 'JINI_MONITOR',
      dataAsOf: rawTerminal?.updatedAt || rawBridge?.updatedAt || terminalStatus?.updatedAt || null,
      slaMs: 300_000,
      status: terminalStatus?.status || DATA_INTEGRITY_STATUS.UNAVAILABLE,
    },
    {
      id: 'MT5_BRIDGE',
      dataAsOf: rawBridge?.updatedAt || null,
      slaMs: FRESHNESS_SLA_MS.XM_M1,
      status: terminalStatus?.bridge?.status || DATA_INTEGRITY_STATUS.UNAVAILABLE,
    },
  );

  return entries;
}

/**
 * Builds the canonical JINI Trading Context Snapshot from raw multi-source inputs.
 */
export function buildJiniTradingContextSnapshot({
  rawXMCandles = {},
  rawXMTick = null,
  rawOrderFlow = null,
  rawIntermarket = null,
  rawSupplyDemand = null,
  rawScalping = null,
  rawTerminal = null,
  rawBridge = null,
  now = Date.now(),
} = {}) {
  const currentTimestampIso = new Date(now).toISOString();
  const snapshotId = `SNAP-XAUUSD-${now}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const marketSession = getMarketSession(now);

  // 1. Normalize XM OHLC & Tick (Primary Price Source)
  const xmCandles = normalizeMultiTimeframeCandles(rawXMCandles, now);
  const xmTick = normalizeTickData(rawXMTick);

  // 2. Normalize Order Flow (PAXG Proxy strictly separated from COMEX)
  const orderFlow = normalizeOrderFlowSnapshot(rawOrderFlow, now);

  // 3. Map existing panel/service outputs without recomputing indicators
  const supplyDemandEvidence = adaptSupplyDemandEvidence(rawSupplyDemand);
  const scalpingEvidence = adaptScalpingEvidence(rawScalping);
  const orderFlowEvidence = adaptOrderFlowEvidence(orderFlow, rawOrderFlow);
  const intermarketEvidence = adaptIntermarketEvidence(rawIntermarket);
  const terminalStatus = adaptTerminalStatus(rawTerminal, rawBridge);

  // 4. Legacy v1 subtrees (kept for backward compatibility)
  const hasIntermarket = isObject(rawIntermarket);
  const intermarket = {
    status: hasIntermarket
      ? (rawIntermarket.status || DATA_INTEGRITY_STATUS.READY)
      : DATA_INTEGRITY_STATUS.UNAVAILABLE,
    macroBias: hasIntermarket
      ? (rawIntermarket.macroBias ?? rawIntermarket.analysis?.bias ?? rawIntermarket.bias ?? 'INSUFFICIENT_DATA')
      : 'INSUFFICIENT_DATA',
    correlationWindowDays: rawIntermarket?.correlationWindowDays
      || rawIntermarket?.analysis?.dataCompleteness?.correlationWindow
      || 180,
    coreFactors: {
      dxy: rawIntermarket?.instruments?.dxy || rawIntermarket?.dxy || null,
      us10y: rawIntermarket?.instruments?.us10y || rawIntermarket?.us10y || null,
      us10y_real: rawIntermarket?.instruments?.us10y_real || rawIntermarket?.us10y_real || null,
      wti: rawIntermarket?.instruments?.wti || rawIntermarket?.wti || null,
      silver: rawIntermarket?.instruments?.xagusd || rawIntermarket?.silver || null,
    },
    updatedAt: rawIntermarket?.generatedAt || rawIntermarket?.updatedAt || currentTimestampIso,
  };

  const hasSupplyDemand = isObject(rawSupplyDemand);
  const supplyDemand = {
    status: hasSupplyDemand
      ? (rawSupplyDemand.status || rawSupplyDemand.dataStatus || DATA_INTEGRITY_STATUS.READY)
      : DATA_INTEGRITY_STATUS.UNAVAILABLE,
    currentPrice: xmTick.mid || rawSupplyDemand?.currentPrice || null,
    nearestDemand: rawSupplyDemand?.nearestDemand || null,
    nearestSupply: rawSupplyDemand?.nearestSupply || null,
    confluenceClusters: Array.isArray(rawSupplyDemand?.confluence)
      ? rawSupplyDemand.confluence
      : (Array.isArray(rawSupplyDemand?.confluenceClusters) ? rawSupplyDemand.confluenceClusters : []),
    timeframes: rawSupplyDemand?.timeframes || {},
  };

  const hasScalping = isObject(rawScalping);
  const scalpingM1 = {
    status: hasScalping
      ? (rawScalping.status || rawScalping.dataStatus || DATA_INTEGRITY_STATUS.READY)
      : DATA_INTEGRITY_STATUS.UNAVAILABLE,
    adx: rawScalping?.trend?.adx ?? rawScalping?.adx ?? null,
    efficiencyRatio: rawScalping?.trend?.efficiencyRatio ?? rawScalping?.efficiencyRatio ?? null,
    atrM1: rawScalping?.trend?.atr ?? rawScalping?.atrM1 ?? null,
    volatilityRegime: hasScalping ? (rawScalping?.volatility?.level || 'NORMAL') : 'UNKNOWN',
    spreadAcceptable: xmTick.spreadAcceptable,
    previewLevels: rawScalping?.previewLevels || null,
  };

  // 5. Data Integrity & Completeness Audit (fail-closed).
  const criticalMissing = [];
  // A tick we cannot time-stamp cannot be proven fresh; fail-closed on price.
  if (!xmTick.valid || !rawXMTick?.timestamp) criticalMissing.push('XM_TICK');
  if (!xmCandles.D1.ready) criticalMissing.push('XM_OHLC_D1');
  if (!xmCandles.H4.ready) criticalMissing.push('XM_OHLC_H4');

  const optionalMissing = [];
  if (!xmCandles.M1.ready) optionalMissing.push('XM_OHLC_M1');
  if (orderFlow.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) optionalMissing.push('ORDER_FLOW_TAPE');
  if (intermarketEvidence.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) optionalMissing.push('INTERMARKET');
  if (supplyDemandEvidence.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) optionalMissing.push('SUPPLY_DEMAND');
  if (scalpingEvidence.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) optionalMissing.push('SCALPING_M1');
  if (terminalStatus.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) optionalMissing.push('JINI_MONITOR');
  if (terminalStatus.bridge?.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) optionalMissing.push('MT5_BRIDGE');

  // A present-but-unreliable source is not the same as a missing source, but it
  // still must prevent the snapshot from claiming READY.
  const degradedSources = [];
  if ([DATA_INTEGRITY_STATUS.STALE, DATA_INTEGRITY_STATUS.DEGRADED].includes(orderFlowEvidence.status)) {
    degradedSources.push('ORDER_FLOW_TAPE');
  }
  if ([DATA_INTEGRITY_STATUS.STALE, DATA_INTEGRITY_STATUS.DEGRADED].includes(intermarketEvidence.status)) {
    degradedSources.push('INTERMARKET');
  }
  if ([DATA_INTEGRITY_STATUS.STALE, DATA_INTEGRITY_STATUS.DEGRADED].includes(supplyDemandEvidence.status)) {
    degradedSources.push('SUPPLY_DEMAND');
  }
  if ([DATA_INTEGRITY_STATUS.STALE, DATA_INTEGRITY_STATUS.DEGRADED].includes(scalpingEvidence.status)) {
    degradedSources.push('SCALPING_M1');
  }
  if ([DATA_INTEGRITY_STATUS.STALE, DATA_INTEGRITY_STATUS.DEGRADED].includes(terminalStatus.status)) {
    degradedSources.push('JINI_MONITOR');
  }

  const missingSources = [...criticalMissing, ...optionalMissing];
  // `overallIntegrity` is the system-level verdict and intentionally includes
  // terminal/operational sources (JINI Monitor, MT5 bridge) for backwards
  // compatibility. Market-data integrity is measured separately so an offline
  // terminal cannot make valid XM candles look degraded.
  const overallIntegrity = criticalMissing.length > 0
    ? DATA_INTEGRITY_STATUS.UNAVAILABLE
    : (optionalMissing.length === 0 && degradedSources.length === 0
      ? DATA_INTEGRITY_STATUS.READY
      : DATA_INTEGRITY_STATUS.DEGRADED);

  const TERMINAL_SOURCE_IDS = ['JINI_MONITOR', 'MT5_BRIDGE'];
  const marketOptionalMissing = optionalMissing.filter((id) => !TERMINAL_SOURCE_IDS.includes(id));
  const marketDegradedSources = degradedSources.filter((id) => !TERMINAL_SOURCE_IDS.includes(id));
  const marketDataIntegrity = criticalMissing.length > 0
    ? DATA_INTEGRITY_STATUS.UNAVAILABLE
    : (marketOptionalMissing.length === 0 && marketDegradedSources.length === 0
      ? DATA_INTEGRITY_STATUS.READY
      : DATA_INTEGRITY_STATUS.DEGRADED);

  const terminalConnectivity = {
    status: terminalStatus.status || DATA_INTEGRITY_STATUS.UNAVAILABLE,
    connectionQuality: terminalStatus.connectionQuality || 'UNKNOWN',
    terminalConnected: terminalStatus.xmTerminal?.connected === true,
    bridgeOnline: terminalStatus.bridge?.online === true,
    bridgeStatus: terminalStatus.bridge?.status || DATA_INTEGRITY_STATUS.UNAVAILABLE,
    source: 'JINI_MONITOR',
    note: terminalStatus.status === DATA_INTEGRITY_STATUS.READY
      ? 'Terminal dan bridge terhubung.'
      : 'Status terminal terpisah dari integritas data pasar; terminal offline tidak mengubah validitas candle XM.',
  };

  const overallSystemStatus = marketDataIntegrity === DATA_INTEGRITY_STATUS.UNAVAILABLE
    ? DATA_INTEGRITY_STATUS.UNAVAILABLE
    : (marketDataIntegrity === DATA_INTEGRITY_STATUS.READY
      && terminalConnectivity.status === DATA_INTEGRITY_STATUS.READY
      ? DATA_INTEGRITY_STATUS.READY
      : DATA_INTEGRITY_STATUS.DEGRADED);

  // 6. Timing / cross-source synchronization
  const timingEntries = buildTimingEntries({
    now,
    marketSession,
    xmTick,
    rawXMTick,
    xmCandles,
    supplyDemandEvidence,
    scalpingEvidence,
    orderFlowEvidence,
    intermarketEvidence,
    terminalStatus,
    rawTerminal,
    rawBridge,
  });
  const { sourceFreshness, crossSourceTiming } = evaluateSourceTiming({ now, entries: timingEntries });

  // 7. Structured evidence blocks
  const timeframeAnalysis = buildTimeframeAnalysis(rawXMCandles, xmCandles);
  const priceData = buildPriceData({ rawXMTick, xmTick, marketSession, now });
  const trendContext = buildTrendContext({ scalpingEvidence, supplyDemandEvidence, timeframeAnalysis });
  const sourceIntegrity = buildSourceIntegrity({
    xmTick,
    xmCandles,
    orderFlowEvidence,
    intermarketEvidence,
    supplyDemandEvidence,
    scalpingEvidence,
    terminalStatus,
  });

  const snapshot = {
    snapshotId,
    snapshotContractVersion: SNAPSHOT_CONTRACT_VERSION,
    engineVersion: ENGINE_VERSION,
    asset: 'XAUUSD',
    symbol: 'GOLD',
    instrument: 'XAUUSD',
    generatedAt: currentTimestampIso,
    timestamp: currentTimestampIso,
    generatedAtEpochMs: now,
    marketSession: {
      marketClosed: marketSession.marketClosed === true,
      reason: marketSession.reason || (marketSession.marketClosed ? 'WEEKEND' : 'OPEN'),
      closeHourUtc: marketSession.closeHourUtc ?? null,
      lastCloseAt: marketSession.lastCloseAt
        ? new Date(marketSession.lastCloseAt).toISOString()
        : null,
    },
    overallIntegrity,
    marketDataIntegrity,
    terminalConnectivity,
    overallSystemStatus,
    criticalSourcesMissing: criticalMissing,
    optionalSourcesMissing: optionalMissing,
    degradedSources,
    missingSources,
    priceData,
    timeframeAnalysis,
    trendContext,
    supplyDemandEvidence,
    scalpingEvidence,
    orderFlowEvidence,
    intermarketEvidence,
    terminalStatus,
    sourceFreshness,
    sourceIntegrity,
    crossSourceTiming,
    // Legacy v1 subtree
    sources: {
      xmPrice: {
        tick: xmTick,
        candles: xmCandles,
      },
      orderFlow: {
        venue: orderFlow.proxy.venue,
        isProxy: true,
        isComex: false,
        proxyContract: PROXY_INTEGRITY_CONTRACT,
        comexContract: COMEX_INTEGRITY_CONTRACT,
        metrics: orderFlow.metrics,
        cvd: orderFlow.cvd,
        imbalance: orderFlowEvidence.imbalance,
        tradesCount: orderFlow.tradesCount,
        freshness: orderFlow.freshness,
        absorption: orderFlow.absorption,
        absorptionDetected: orderFlow.absorptionDetected,
        note: orderFlow.note || null,
      },
      intermarket,
      supplyDemand,
      scalpingM1,
    },
  };

  const evidenceHash = computeSnapshotEvidenceHash(snapshot);
  snapshot.evidenceHash = evidenceHash;

  return deepFreeze(snapshot);
}

/**
 * Validates a snapshot object against the strict constitutional rules.
 */
export function validateSnapshotIntegrity(snapshot) {
  const errors = [];
  const warnings = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['Snapshot is null or non-object'], warnings: [] };
  }

  // 1. Immutability
  if (!Object.isFrozen(snapshot)) {
    warnings.push('Snapshot is not frozen');
  }

  // 2. Evidence hash re-verification (tamper detection)
  if (typeof snapshot.evidenceHash === 'string' && snapshot.evidenceHash.length > 0) {
    const recomputed = computeSnapshotEvidenceHash(snapshot);
    if (recomputed !== snapshot.evidenceHash) {
      errors.push('Evidence hash mismatch: snapshot content does not match its recorded evidenceHash');
    }
  } else {
    warnings.push('Snapshot has no evidenceHash; audit integrity cannot be proven');
  }

  if (snapshot.overallIntegrity === DATA_INTEGRITY_STATUS.UNAVAILABLE) {
    warnings.push('Snapshot overallIntegrity is UNAVAILABLE; upstream must fail-closed to WAIT/NO_TRADE');
  }

  // 3. Primary Price Check
  const tick = snapshot.sources?.xmPrice?.tick;
  if (!tick || !tick.valid) {
    errors.push('XM tick data is invalid or missing');
  }

  // 4. Daily and H4 trend minimum data
  const d1 = snapshot.sources?.xmPrice?.candles?.D1;
  const h4 = snapshot.sources?.xmPrice?.candles?.H4;
  if (!d1 || d1.count < 20) {
    errors.push(`D1 candles count insufficient: ${d1?.count || 0}/20`);
  }
  if (!h4 || h4.count < 10) {
    errors.push(`H4 candles count insufficient: ${h4?.count || 0}/10`);
  }

  // 5. Order Flow Non-Negotiable Contract
  const of = snapshot.sources?.orderFlow;
  if (of) {
    if (of.isComex !== false) {
      errors.push('Constitutional violation: Order Flow must NOT claim to be COMEX GC');
    }
    if (of.isProxy !== true) {
      errors.push('Constitutional violation: PAXG feed must be explicitly labelled as proxy');
    }
    if (of.metrics) {
      const denom = of.metrics.buyVolume + of.metrics.sellVolume;
      if (denom > 0) {
        const expectedBuy = Number(((of.metrics.buyVolume / denom) * 100).toFixed(2));
        if (Math.abs(expectedBuy - of.metrics.buyPercent) > 0.05) {
          errors.push(`Aggressor Buy% formula mismatch: got ${of.metrics.buyPercent}%, expected ${expectedBuy}%`);
        }
      }
    }
  } else {
    warnings.push('Order Flow object is missing in snapshot');
  }

  // 6. Source traceability (provenance) for integrated sources
  if (snapshot.sourceIntegrity) {
    for (const [sourceId, entry] of Object.entries(snapshot.sourceIntegrity)) {
      if (entry && entry.level !== DATA_INTEGRITY_STATUS.UNAVAILABLE && !entry.attribution) {
        warnings.push(`Source ${sourceId} is marked available but has no provenance attribution`);
      }
    }
  } else {
    warnings.push('Snapshot has no sourceIntegrity registry');
  }

  // 7. Cross-source synchronization must be explicit
  if (!snapshot.crossSourceTiming) {
    warnings.push('Snapshot has no crossSourceTiming; skew between sources cannot be audited');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
