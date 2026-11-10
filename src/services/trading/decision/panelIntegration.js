/**
 * panelIntegration.js
 * Thin integration bridge between Broker Workspace panel services and the
 * JINI_TRADING_CONTEXT_SNAPSHOT builder.
 *
 * This module only unwraps existing service outputs. It does not fetch, does
 * not recompute indicators, and does not fabricate missing values.
 */

import { buildJiniTradingContextSnapshot } from './JiniContextSnapshot.js';

const SNAPSHOT_TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Converts the multi-timeframe XM client output into snapshot candle inputs.
 * Supports both fetchXmOhlcMulti({ includeDaily:true }) and a plain
 * { timeframe: { candles, source, tick, lastCandleAt } } map.
 */
export function buildXmInputsFromPayloads(xmMulti) {
  const payloads = isObject(xmMulti?.payloads) ? xmMulti.payloads : (isObject(xmMulti) ? xmMulti : {});
  const rawXMCandles = {};

  for (const timeframe of SNAPSHOT_TIMEFRAMES) {
    const payload = payloads[timeframe];
    if (!payload) continue;
    if (Array.isArray(payload)) {
      rawXMCandles[timeframe] = { candles: payload };
      continue;
    }
    if (!Array.isArray(payload.candles)) continue;
    rawXMCandles[timeframe] = {
      candles: payload.candles,
      source: payload.source || null,
      tick: payload.tick || null,
      lastCandleAt: payload.lastCandleAt || null,
    };
  }

  const tick = payloads.M1?.tick
    || payloads.M5?.tick
    || payloads.M15?.tick
    || payloads.H1?.tick
    || payloads.H4?.tick
    || payloads.D1?.tick
    || null;

  return { rawXMCandles, rawXMTick: tick };
}

/**
 * Builds the full JINI_TRADING_CONTEXT_SNAPSHOT from live panel service outputs.
 *
 * @param {object} input
 * @param {object} input.xmMulti Output of fetchXmOhlcMulti (includeDaily:true)
 * @param {object} input.supplyDemand Output of analyzeSupplyDemand(...)
 * @param {object} input.scalping Output of buildScalpingM1Analysis(...)
 * @param {object} input.orderFlow Output of fetchGoldOrderFlow(...)
 * @param {object} input.intermarket Output of fetchGoldIntermarketFactors(...)
 * @param {object} input.terminal BrokerWorkspaceManager getStatus() snapshot
 * @param {object} input.bridge Output of fetchXmBridgeStatus(...)
 * @param {number} input.now
 */
export function buildJiniSnapshotFromPanels({
  xmMulti = null,
  supplyDemand = null,
  scalping = null,
  orderFlow = null,
  intermarket = null,
  terminal = null,
  bridge = null,
  now = Date.now(),
} = {}) {
  const { rawXMCandles, rawXMTick } = buildXmInputsFromPayloads(xmMulti);

  return buildJiniTradingContextSnapshot({
    rawXMCandles,
    rawXMTick: rawXMTick || bridge?.tick || null,
    rawSupplyDemand: supplyDemand,
    rawScalping: scalping,
    rawOrderFlow: orderFlow,
    rawIntermarket: intermarket,
    rawTerminal: terminal,
    rawBridge: bridge,
    now,
  });
}
