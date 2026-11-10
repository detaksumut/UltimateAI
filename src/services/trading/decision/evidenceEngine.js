/**
 * evidenceEngine.js
 * Weighted, de-duplicated evidence aggregation for Tahap 3.
 *
 * Each category consumes a distinct slice of the snapshot. Categories whose
 * source is unavailable/stale are EXCLUDED from the denominator, so a missing
 * source cannot silently inflate or deflate the remaining evidence.
 */

import {
  DECISION_WEIGHTS,
  DECISION_THRESHOLDS,
} from './weights.js';
import {
  clamp,
  directionToEvidence,
  round,
  trendStrength,
} from './marketAnalysis.js';
import { DATA_INTEGRITY_STATUS } from './constants.js';

function category({
  id,
  label,
  weight,
  available,
  direction,
  strength,
  sourceIds,
  reasons,
  unavailableReason = null,
}) {
  return {
    id,
    label,
    baseWeight: weight,
    available: available === true,
    direction: available === true ? (direction ?? 'NEUTRAL') : null,
    strength: available === true ? round(clamp(strength ?? 0, 0, 1), 3) : 0,
    sourceIds: sourceIds.slice(),
    reasons: reasons.slice(),
    unavailableReason,
    normalizedWeight: 0,
    contribution: { buy: 0, sell: 0, neutral: 0 },
  };
}

function zoneQuality(zone) {
  if (!zone) return 0.5;
  const score = Number(zone.score);
  const base = Number.isFinite(score) ? clamp(score / 100, 0, 1) : 0.5;
  const lifecycleBonus = zone.lifecycle === 'FRESH'
    ? 0.1
    : (zone.lifecycle === 'TESTED' ? 0.05 : 0);
  return clamp(base + lifecycleBonus, 0, 1);
}

function buildTrendAlignment(trends) {
  const d1 = trends.D1;
  const h4 = trends.H4;
  const sources = ['XM_OHLC_D1', 'XM_OHLC_H4'];

  if (!d1?.available || !h4?.available || d1.direction === 'UNKNOWN' || h4.direction === 'UNKNOWN') {
    return category({
      id: 'TREND_ALIGNMENT',
      label: 'Trend Alignment (D1/H4)',
      weight: DECISION_WEIGHTS.TREND_ALIGNMENT,
      available: false,
      sourceIds: sources,
      reasons: [],
      unavailableReason: 'D1/H4 belum cukup untuk menetapkan arah utama.',
    });
  }

  if (d1.direction === 'NEUTRAL') {
    return category({
      id: 'TREND_ALIGNMENT',
      label: 'Trend Alignment (D1/H4)',
      weight: DECISION_WEIGHTS.TREND_ALIGNMENT,
      available: true,
      direction: 'NEUTRAL',
      strength: 0.3,
      sourceIds: sources,
      reasons: ['D1 sideways; anchor harian belum memberi arah.'],
    });
  }

  if (h4.direction === 'NEUTRAL') {
    return category({
      id: 'TREND_ALIGNMENT',
      label: 'Trend Alignment (D1/H4)',
      weight: DECISION_WEIGHTS.TREND_ALIGNMENT,
      available: true,
      direction: directionToEvidence(d1.direction),
      strength: 0.35,
      sourceIds: sources,
      reasons: [`D1 ${d1.direction}, H4 belum mengonfirmasi (sideways).`],
    });
  }

  if (d1.direction !== h4.direction) {
    return category({
      id: 'TREND_ALIGNMENT',
      label: 'Trend Alignment (D1/H4)',
      weight: DECISION_WEIGHTS.TREND_ALIGNMENT,
      available: true,
      direction: 'NEUTRAL',
      strength: 0.2,
      sourceIds: sources,
      reasons: [`D1 ${d1.direction} vs H4 ${h4.direction}: konflik arah utama.`],
    });
  }

  const strength = (trendStrength(d1) * 0.6) + (trendStrength(h4) * 0.4);
  return category({
    id: 'TREND_ALIGNMENT',
    label: 'Trend Alignment (D1/H4)',
    weight: DECISION_WEIGHTS.TREND_ALIGNMENT,
    available: true,
    direction: directionToEvidence(d1.direction),
    strength,
    sourceIds: sources,
    reasons: [`D1 dan H4 searah ${d1.direction.toLowerCase()}.`],
  });
}

function buildMarketStructure(structure) {
  if (!structure?.available || structure.direction === 'UNKNOWN') {
    return category({
      id: 'MARKET_STRUCTURE',
      label: 'Market Structure (H1)',
      weight: DECISION_WEIGHTS.MARKET_STRUCTURE,
      available: false,
      sourceIds: ['XM_OHLC_H1'],
      reasons: [],
      unavailableReason: 'Struktur swing H1 belum dapat dibaca.',
    });
  }
  const direction = directionToEvidence(structure.direction);
  return category({
    id: 'MARKET_STRUCTURE',
    label: 'Market Structure (H1)',
    weight: DECISION_WEIGHTS.MARKET_STRUCTURE,
    available: true,
    direction,
    strength: direction === 'NEUTRAL' ? 0.35 : 0.7,
    sourceIds: ['XM_OHLC_H1'],
    reasons: structure.reasons.slice(),
  });
}

function buildSupplyDemand(zoneContext) {
  if (!zoneContext?.available) {
    return category({
      id: 'SUPPLY_DEMAND',
      label: 'Supply/Demand Location',
      weight: DECISION_WEIGHTS.SUPPLY_DEMAND,
      available: false,
      sourceIds: ['SUPPLY_DEMAND'],
      reasons: [],
      unavailableReason: 'Lokasi Supply/Demand tidak tersedia.',
    });
  }

  if (zoneContext.location === 'DEMAND') {
    const quality = zoneQuality(zoneContext.demand);
    return category({
      id: 'SUPPLY_DEMAND',
      label: 'Supply/Demand Location',
      weight: DECISION_WEIGHTS.SUPPLY_DEMAND,
      available: true,
      direction: 'BUY',
      strength: 0.45 + (quality * 0.4),
      sourceIds: ['SUPPLY_DEMAND'],
      reasons: [`Harga berada di zona demand (skor ${zoneContext.demand?.score ?? '—'}).`],
    });
  }

  if (zoneContext.location === 'SUPPLY') {
    const quality = zoneQuality(zoneContext.supply);
    return category({
      id: 'SUPPLY_DEMAND',
      label: 'Supply/Demand Location',
      weight: DECISION_WEIGHTS.SUPPLY_DEMAND,
      available: true,
      direction: 'SELL',
      strength: 0.45 + (quality * 0.4),
      sourceIds: ['SUPPLY_DEMAND'],
      reasons: [`Harga berada di zona supply (skor ${zoneContext.supply?.score ?? '—'}).`],
    });
  }

  return category({
    id: 'SUPPLY_DEMAND',
    label: 'Supply/Demand Location',
    weight: DECISION_WEIGHTS.SUPPLY_DEMAND,
    available: true,
    direction: 'NEUTRAL',
    strength: 0.3,
    sourceIds: ['SUPPLY_DEMAND'],
    reasons: [
      zoneContext.location === 'BOTH'
        ? 'Harga dekat demand dan supply sekaligus; lokasi ambigu.'
        : 'Harga tidak berada dekat zona aktif.',
    ],
  });
}

function buildOrderFlow(orderFlowRead) {
  if (!orderFlowRead?.available) {
    return category({
      id: 'ORDER_FLOW',
      label: 'Order Flow (PAXG proxy)',
      weight: DECISION_WEIGHTS.ORDER_FLOW,
      available: false,
      sourceIds: ['ORDER_FLOW'],
      reasons: [],
      unavailableReason: orderFlowRead?.reasons?.[0] || 'Order Flow tidak tersedia/stale.',
    });
  }
  return category({
    id: 'ORDER_FLOW',
    label: 'Order Flow (PAXG proxy)',
    weight: DECISION_WEIGHTS.ORDER_FLOW,
    available: true,
    direction: orderFlowRead.direction,
    strength: orderFlowRead.strength,
    sourceIds: ['ORDER_FLOW'],
    reasons: orderFlowRead.reasons.slice(),
  });
}

function buildIntermarket(intermarketRead) {
  if (!intermarketRead?.available) {
    return category({
      id: 'INTERMARKET',
      label: 'Intermarket Macro',
      weight: DECISION_WEIGHTS.INTERMARKET,
      available: false,
      sourceIds: ['INTERMARKET'],
      reasons: [],
      unavailableReason: intermarketRead?.reasons?.[0] || 'Intermarket tidak tersedia.',
    });
  }
  return category({
    id: 'INTERMARKET',
    label: 'Intermarket Macro',
    weight: DECISION_WEIGHTS.INTERMARKET,
    available: true,
    direction: intermarketRead.direction,
    strength: intermarketRead.strength,
    sourceIds: ['INTERMARKET'],
    reasons: intermarketRead.reasons.slice(),
  });
}

function buildSetupConfirmation(setupRead) {
  if (!setupRead?.available) {
    return category({
      id: 'SETUP_CONFIRMATION',
      label: 'Setup Confirmation (M15/M5)',
      weight: DECISION_WEIGHTS.SETUP_CONFIRMATION,
      available: false,
      sourceIds: ['XM_OHLC_M15', 'XM_OHLC_M5'],
      reasons: [],
      unavailableReason: setupRead?.reasons?.[0] || 'M15/M5 tidak tersedia.',
    });
  }
  return category({
    id: 'SETUP_CONFIRMATION',
    label: 'Setup Confirmation (M15/M5)',
    weight: DECISION_WEIGHTS.SETUP_CONFIRMATION,
    available: true,
    direction: setupRead.direction,
    strength: setupRead.strength,
    sourceIds: ['XM_OHLC_M15', 'XM_OHLC_M5'],
    reasons: setupRead.reasons.slice(),
  });
}

function buildEntryTrigger(entryRead) {
  if (!entryRead?.available) {
    return category({
      id: 'ENTRY_TRIGGER',
      label: 'Entry Trigger (M1)',
      weight: DECISION_WEIGHTS.ENTRY_TRIGGER,
      available: false,
      sourceIds: ['XM_OHLC_M1', 'SCALPING_M1'],
      reasons: [],
      unavailableReason: entryRead?.reasons?.[0] || 'Entry trigger M1 tidak tersedia.',
    });
  }
  return category({
    id: 'ENTRY_TRIGGER',
    label: 'Entry Trigger (M1)',
    weight: DECISION_WEIGHTS.ENTRY_TRIGGER,
    available: true,
    direction: entryRead.direction,
    strength: entryRead.strength,
    sourceIds: ['XM_OHLC_M1', 'SCALPING_M1'],
    reasons: entryRead.reasons.slice(),
  });
}

function applyNormalizedWeights(categories) {
  const available = categories.filter((item) => item.available);
  const totalWeight = available.reduce((sum, item) => sum + item.baseWeight, 0);

  let buy = 0;
  let sell = 0;
  let neutral = 0;

  for (const item of categories) {
    if (!item.available || totalWeight <= 0) {
      item.normalizedWeight = 0;
      item.contribution = { buy: 0, sell: 0, neutral: 0 };
      continue;
    }
    const normalized = (item.baseWeight / totalWeight) * 100;
    const strength = clamp(item.strength, 0, 1);
    const buyPart = item.direction === 'BUY' ? normalized * strength : 0;
    const sellPart = item.direction === 'SELL' ? normalized * strength : 0;
    const neutralPart = item.direction === 'NEUTRAL'
      ? normalized
      : normalized * (1 - strength);
    item.normalizedWeight = round(normalized, 2);
    item.contribution = {
      buy: round(buyPart, 2),
      sell: round(sellPart, 2),
      neutral: round(neutralPart, 2),
    };
    buy += buyPart;
    sell += sellPart;
    neutral += neutralPart;
  }

  return {
    totalAvailableWeight: round(totalWeight, 2),
    normalized: totalWeight > 0,
    buyEvidenceScore: round(buy, 2),
    sellEvidenceScore: round(sell, 2),
    neutralEvidenceScore: round(neutral, 2),
  };
}

export function buildWeightedEvidence({
  trends,
  structure,
  zoneContext,
  orderFlowRead,
  intermarketRead,
  setupRead,
  entryRead,
}) {
  const categories = [
    buildTrendAlignment(trends),
    buildMarketStructure(structure),
    buildSupplyDemand(zoneContext),
    buildOrderFlow(orderFlowRead),
    buildIntermarket(intermarketRead),
    buildSetupConfirmation(setupRead),
    buildEntryTrigger(entryRead),
  ];
  const scores = applyNormalizedWeights(categories);

  return {
    categories,
    availableCategories: categories.filter((item) => item.available).map((item) => item.id),
    unavailableCategories: categories.filter((item) => !item.available).map((item) => item.id),
    ...scores,
  };
}

export function sourceStatusRank(status) {
  switch (status) {
    case DATA_INTEGRITY_STATUS.READY: return 3;
    case DATA_INTEGRITY_STATUS.DEGRADED: return 2;
    case DATA_INTEGRITY_STATUS.STALE: return 1;
    default: return 0;
  }
}

export { DECISION_THRESHOLDS };
