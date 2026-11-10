/**
 * conflictGate.js
 * Deterministic hard/soft conflict detection for Tahap 3.
 *
 * Hard conflicts cannot be outvoted by any aggregate score. They force WAIT or
 * NO_TRADE. Soft conflicts reduce confidence via an explicit cap, but must not
 * flip the direction that the higher-timeframe anchor established.
 */

import { CONFIDENCE_CAPS } from './weights.js';
import { DATA_INTEGRITY_STATUS } from './constants.js';

const PRICE_EVIDENCE_SOURCES = Object.freeze([
  'XM_TICK',
  'XM_M1',
  'XM_M5',
  'XM_M15',
  'XM_H1',
  'XM_H4',
  'XM_D1',
  'ORDER_FLOW',
  'SUPPLY_DEMAND',
  'SCALPING_M1',
  'MT5_BRIDGE',
]);

function conflict(severity, code, category, message, extra = {}) {
  return {
    severity,
    code,
    category,
    message,
    ...extra,
  };
}

/**
 * The D1/H4 anchor is the primary hierarchy rule. It deliberately ignores
 * M1/Order Flow; those can only create conflicts, never redefine the anchor.
 */
export function computeAnchor(trends) {
  const d1 = trends?.D1?.direction ?? 'UNKNOWN';
  const h4 = trends?.H4?.direction ?? 'UNKNOWN';
  const d1Directional = d1 === 'BULLISH' || d1 === 'BEARISH';
  const h4Directional = h4 === 'BULLISH' || h4 === 'BEARISH';

  if (!d1Directional) {
    return { direction: null, d1, h4, aligned: false, conflict: false, reason: 'D1 belum memberi arah.' };
  }
  if (!h4Directional) {
    return { direction: null, d1, h4, aligned: false, conflict: false, reason: 'H4 belum mengonfirmasi arah D1.' };
  }
  if (d1 !== h4) {
    return { direction: null, d1, h4, aligned: false, conflict: true, reason: 'D1 dan H4 bertentangan.' };
  }
  return {
    direction: d1 === 'BULLISH' ? 'BUY' : 'SELL',
    d1,
    h4,
    aligned: true,
    conflict: false,
    reason: `D1 dan H4 searah ${d1.toLowerCase()}.`,
  };
}

function detectHardConflicts({
  snapshot,
  anchor,
  trends,
  structure,
  zoneContext,
  orderFlowRead,
  entryRead,
  priceResponse,
  execution,
  dataQuality,
}) {
  const conflicts = [];

  if (dataQuality.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) {
    conflicts.push(conflict(
      'HARD',
      'CRITICAL_DATA_UNAVAILABLE',
      'DATA',
      'Sumber harga kritis (XM tick/D1/H4) tidak tersedia; keputusan dikunci.',
      { missing: dataQuality.missing },
    ));
  }
  if (dataQuality.criticalStale === true) {
    conflicts.push(conflict(
      'HARD',
      'CRITICAL_DATA_STALE',
      'DATA',
      'Sumber harga kritis stale; tidak boleh dipakai untuk keputusan.',
      { stale: dataQuality.stale },
    ));
  }

  if (execution.status === 'WIDE_SPREAD') {
    conflicts.push(conflict(
      'HARD',
      'EXECUTION_SPREAD_TOO_WIDE',
      'EXECUTION',
      `Spread ${execution.spreadPips} melebihi batas ${execution.maxSpreadPips}.`,
      { spreadPips: execution.spreadPips },
    ));
  } else if (execution.status === 'UNAVAILABLE') {
    conflicts.push(conflict(
      'HARD',
      'EXECUTION_PRICE_UNAVAILABLE',
      'EXECUTION',
      'Tick/spread XM tidak tersedia; eksekusi tidak layak.',
    ));
  }

  if (anchor.conflict) {
    conflicts.push(conflict(
      'HARD',
      'D1_H4_CONFLICT',
      'TREND',
      'D1 dan H4 bertentangan; arah utama tidak boleh dipaksakan.',
      { d1: anchor.d1, h4: anchor.h4 },
    ));
  }

  if (anchor.direction && structure?.available) {
    const structureDirection = structure.direction === 'BULLISH'
      ? 'BUY'
      : (structure.direction === 'BEARISH' ? 'SELL' : null);
    if (structureDirection && structureDirection !== anchor.direction) {
      conflicts.push(conflict(
        'HARD',
        'TREND_VS_STRUCTURE_CONFLICT',
        'STRUCTURE',
        'Struktur H1 berlawanan dengan arah D1/H4.',
        { anchor: anchor.direction, structure: structure.direction },
      ));
    }
  }

  if (anchor.direction && zoneContext?.available) {
    const location = zoneContext.location;
    if (anchor.direction === 'BUY' && location === 'SUPPLY') {
      conflicts.push(conflict(
        'HARD',
        'TREND_VS_SUPPLY_DEMAND_CONFLICT',
        'SUPPLY_DEMAND',
        'Arah BUY tetapi harga berada di zona supply.',
      ));
    } else if (anchor.direction === 'SELL' && location === 'DEMAND') {
      conflicts.push(conflict(
        'HARD',
        'TREND_VS_SUPPLY_DEMAND_CONFLICT',
        'SUPPLY_DEMAND',
        'Arah SELL tetapi harga berada di zona demand.',
      ));
    }
  }

  if (orderFlowRead?.available) {
    const aggression = orderFlowRead.aggressionDirection;
    const response = priceResponse?.available ? priceResponse.direction : 'UNKNOWN';
    const absorptionDirection = orderFlowRead.absorption?.direction ?? null;

    if (aggression === 'BUY' && absorptionDirection !== 'BEARISH') {
      if (response === 'FLAT') {
        conflicts.push(conflict(
          'HARD',
          'AGGRESSIVE_BUY_WITHOUT_PRICE_RESPONSE',
          'ORDER_FLOW',
          'Agresi beli dominan tetapi harga tidak naik; konfirmasi BUY tidak sah.',
          { buyPercent: orderFlowRead.buyPercent, response },
        ));
      } else if (response === 'DOWN') {
        conflicts.push(conflict(
          'HARD',
          'AGGRESSIVE_BUY_ABSORBED_BY_FALLING_PRICE',
          'ORDER_FLOW',
          'Agresi beli dominan tetapi harga justru turun.',
          { buyPercent: orderFlowRead.buyPercent, response },
        ));
      }
    }

    if (aggression === 'SELL' && absorptionDirection !== 'BULLISH') {
      if (response === 'FLAT') {
        conflicts.push(conflict(
          'HARD',
          'AGGRESSIVE_SELL_WITHOUT_PRICE_DECLINE',
          'ORDER_FLOW',
          'Agresi jual dominan tetapi harga tidak turun; konfirmasi SELL tidak sah.',
          { sellPercent: orderFlowRead.sellPercent, response },
        ));
      } else if (response === 'UP') {
        conflicts.push(conflict(
          'HARD',
          'AGGRESSIVE_SELL_ABSORBED_BY_RISING_PRICE',
          'ORDER_FLOW',
          'Agresi jual dominan tetapi harga justru naik.',
          { sellPercent: orderFlowRead.sellPercent, response },
        ));
      }
    }

    const providerDirection = orderFlowRead.providerAbsorption?.direction;
    if (providerDirection && zoneContext?.available) {
      if (providerDirection === 'BULLISH' && zoneContext.location === 'SUPPLY') {
        conflicts.push(conflict(
          'HARD',
          'ABSORPTION_VS_ZONE_CONFLICT',
          'ORDER_FLOW',
          'Provider melaporkan absorpsi bullish di zona supply.',
        ));
      } else if (providerDirection === 'BEARISH' && zoneContext.location === 'DEMAND') {
        conflicts.push(conflict(
          'HARD',
          'ABSORPTION_VS_ZONE_CONFLICT',
          'ORDER_FLOW',
          'Provider melaporkan absorpsi bearish di zona demand.',
        ));
      }
    }
  }

  if (anchor.direction && entryRead?.available) {
    if (entryRead.direction && entryRead.direction !== 'NEUTRAL' && entryRead.direction !== anchor.direction) {
      conflicts.push(conflict(
        'HARD',
        'ENTRY_TRIGGER_VS_TREND_CONFLICT',
        'ENTRY',
        'Trigger M1 berlawanan dengan arah D1/H4; bukan entry utama.',
        { anchor: anchor.direction, entry: entryRead.direction },
      ));
    }
  }

  const skew = snapshot?.crossSourceTiming;
  if (skew?.skewStatus === 'MAJOR_SKEW') {
    const affected = Array.isArray(skew.affectedSources) ? skew.affectedSources : [];
    const hitsEvidenceSource = affected.some((source) => PRICE_EVIDENCE_SOURCES.includes(source));
    if (hitsEvidenceSource) {
      conflicts.push(conflict(
        'HARD',
        'MAJOR_TIMESTAMP_SKEW',
        'TIMING',
        'Sumber bukti utama berasal dari waktu yang jauh berbeda (major skew).',
        { affectedSources: affected, referenceSource: skew.referenceSource },
      ));
    }
  }

  return conflicts;
}

function detectSoftConflicts({
  snapshot,
  anchor,
  zoneContext,
  orderFlowRead,
  intermarketRead,
  setupRead,
  entryRead,
  execution,
  weightedEvidence,
  dataQuality,
}) {
  const conflicts = [];
  const push = (code, category, message, capPercent, extra = {}) => {
    conflicts.push(conflict('SOFT', code, category, message, { capPercent, ...extra }));
  };

  if (!orderFlowRead?.available) {
    const stale = orderFlowRead?.status === DATA_INTEGRITY_STATUS.STALE;
    push(
      stale ? 'ORDER_FLOW_STALE' : 'ORDER_FLOW_UNAVAILABLE',
      'ORDER_FLOW',
      stale
        ? 'Order Flow stale; bobotnya dikeluarkan, bukan dianggap netral.'
        : 'Order Flow tidak tersedia; konfirmasi agresor tidak boleh dikarang.',
      stale ? CONFIDENCE_CAPS.ORDER_FLOW_STALE : CONFIDENCE_CAPS.ORDER_FLOW_UNAVAILABLE,
    );
  } else if (orderFlowRead.providerConflict) {
    push(
      'ABSORPTION_UNCONFIRMED',
      'ORDER_FLOW',
      'Provider absorption tidak sesuai bukti volume/harga/lokasi.',
      CONFIDENCE_CAPS.ABSORPTION_UNCONFIRMED,
    );
  } else if (orderFlowRead.providerAbsorption?.status === 'DETECTED' && orderFlowRead.absorption.status !== 'DETECTED') {
    push(
      'ABSORPTION_UNCONFIRMED',
      'ORDER_FLOW',
      'Klaim absorption provider tidak terbukti oleh agresi, respons harga, dan lokasi zona.',
      CONFIDENCE_CAPS.ABSORPTION_UNCONFIRMED,
    );
  }

  if (!intermarketRead?.available) {
    push(
      'INTERMARKET_UNAVAILABLE',
      'INTERMARKET',
      'Intermarket tidak tersedia; kategori dikeluarkan dari denominator.',
      CONFIDENCE_CAPS.INTERMARKET_UNAVAILABLE,
      { notProvided: intermarketRead?.notProvided ?? [] },
    );
  }

  if (!weightedEvidence.categories.find((item) => item.id === 'SUPPLY_DEMAND')?.available) {
    push(
      'SUPPLY_DEMAND_UNAVAILABLE',
      'SUPPLY_DEMAND',
      'Lokasi Supply/Demand tidak tersedia.',
      CONFIDENCE_CAPS.SUPPLY_DEMAND_UNAVAILABLE,
    );
  }

  if (!setupRead?.available) {
    push(
      'SETUP_CONFIRMATION_UNAVAILABLE',
      'SETUP',
      'Konfirmasi M15/M5 tidak tersedia.',
      CONFIDENCE_CAPS.SETUP_CONFIRMATION_UNAVAILABLE,
    );
  }

  if (!entryRead?.available) {
    push(
      'ENTRY_TRIGGER_UNAVAILABLE',
      'ENTRY',
      'Trigger M1 tidak tersedia.',
      CONFIDENCE_CAPS.ENTRY_TRIGGER_UNAVAILABLE,
    );
  }

  if (anchor.direction && orderFlowRead?.available && orderFlowRead.direction
    && orderFlowRead.direction !== 'NEUTRAL'
    && orderFlowRead.direction !== anchor.direction
    && orderFlowRead.strength >= 0.5) {
    push(
      'ORDER_FLOW_VS_TREND',
      'ORDER_FLOW',
      'Order Flow berlawanan dengan arah D1/H4; trend utama tidak boleh dikalahkan order flow.',
      CONFIDENCE_CAPS.ORDER_FLOW_VS_TREND,
      { anchor: anchor.direction, orderFlow: orderFlowRead.direction },
    );
  }

  if (anchor.direction && intermarketRead?.available
    && intermarketRead.direction !== 'NEUTRAL'
    && intermarketRead.direction !== anchor.direction) {
    push(
      'INTERMARKET_VS_TREND',
      'INTERMARKET',
      'Intermarket berlawanan dengan arah D1/H4.',
      CONFIDENCE_CAPS.INTERMARKET_VS_TREND,
    );
  }

  if (anchor.direction && zoneContext?.available && zoneContext.location === 'BOTH') {
    push(
      'TREND_VS_SUPPLY_DEMAND_AMBIGUOUS',
      'SUPPLY_DEMAND',
      'Harga dekat demand dan supply sekaligus; lokasi tidak tegas.',
      CONFIDENCE_CAPS.SUPPLY_DEMAND_UNAVAILABLE,
    );
  }

  if (execution.status === 'DEGRADED') {
    push(
      'EXECUTION_FEASIBILITY_DEGRADED',
      'EXECUTION',
      'Spread masih di bawah batas keras tetapi relatif lebar terhadap ATR.',
      CONFIDENCE_CAPS.EXECUTION_DEGRADED,
    );
  }

  const skew = snapshot?.crossSourceTiming;
  if (skew?.skewStatus === 'MAJOR_SKEW') {
    const affected = Array.isArray(skew.affectedSources) ? skew.affectedSources : [];
    const hitsEvidenceSource = affected.some((source) => PRICE_EVIDENCE_SOURCES.includes(source));
    if (!hitsEvidenceSource) {
      push(
        'MAJOR_SKEW_OPTIONAL_SOURCE',
        'TIMING',
        'Major timestamp skew hanya pada sumber non-inti.',
        CONFIDENCE_CAPS.MAJOR_SKEW_OPTIONAL,
        { affectedSources: affected },
      );
    }
  } else if (skew?.skewStatus === 'MINOR_SKEW') {
    push(
      'MINOR_TIMESTAMP_SKEW',
      'TIMING',
      'Selisih waktu minor antar sumber; dilaporkan, bukan disembunyikan.',
      85,
      { affectedSources: skew.affectedSources ?? [] },
    );
  }

  if (dataQuality.optionalStale?.length > 0) {
    push(
      'OPTIONAL_SOURCE_STALE',
      'DATA',
      `Sumber opsional stale: ${dataQuality.optionalStale.join(', ')}.`,
      80,
    );
  }

  return conflicts;
}

function resolveConfidenceCap(hardConflicts, softConflicts, dataQuality, execution) {
  const reasons = [];
  let capPercent = CONFIDENCE_CAPS.FULL;

  if (dataQuality.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) {
    capPercent = 0;
    reasons.push('Sumber kritis tidak tersedia: confidence 0.');
  } else if (execution.status === 'WIDE_SPREAD' || execution.status === 'UNAVAILABLE') {
    capPercent = 0;
    reasons.push('Eksekusi tidak layak: confidence 0.');
  } else if (hardConflicts.some((item) => item.code === 'CRITICAL_DATA_STALE' || item.code === 'MAJOR_TIMESTAMP_SKEW')) {
    capPercent = 0;
    reasons.push('Data kritis stale/major skew: confidence 0.');
  }

  for (const item of softConflicts) {
    if (Number.isFinite(item.capPercent)) {
      capPercent = Math.min(capPercent, item.capPercent);
      reasons.push(`${item.code} membatasi confidence ke ${item.capPercent}%.`);
    }
  }

  return {
    capPercent,
    applied: capPercent < CONFIDENCE_CAPS.FULL,
    reasons,
  };
}

export function evaluateConflictGate(input) {
  const hardConflicts = detectHardConflicts(input);
  const softConflicts = detectSoftConflicts(input);
  const confidenceCap = resolveConfidenceCap(
    hardConflicts,
    softConflicts,
    input.dataQuality,
    input.execution,
  );
  return { hardConflicts, softConflicts, confidenceCap };
}
