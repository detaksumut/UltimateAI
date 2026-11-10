/**
 * aiSynthesis.js
 * Tahap 4 — AI Synthesis & Cognitive Market Reasoning.
 *
 * This layer INTERPRETS the deterministic decision. It is intentionally
 * deterministic itself (rule-based cognitive reasoning, no network, no LLM
 * call) so that:
 *   - tests are reproducible,
 *   - no hallucinated price/volume/candle can enter the reasoning,
 *   - hard gates cannot be overridden.
 *
 * The deterministic engine remains the sole authority for data integrity,
 * hard conflicts, spread/freshness gates, entry permission and execution.
 *
 * The synthesis NEVER produces an entry. BUY_BIAS/SELL_BIAS stay evidence
 * labels. Aggressive Buy, Bullish Absorption and BUY Entry are kept distinct.
 */

import crypto from 'crypto';
import { DATA_INTEGRITY_STATUS } from './constants.js';
import { deepFreeze, stableStringify } from './JiniContextSnapshot.js';
import { round } from './marketAnalysis.js';

export const SYNTHESIS_CONTRACT_VERSION = 'jini-ai-synthesis-v1';

const BUY_WORDS = new Set(['BUY', 'BULLISH', 'UP', 'BULLISH_GOLD']);
const SELL_WORDS = new Set(['SELL', 'BEARISH', 'DOWN', 'BEARISH_GOLD']);

function label(value) {
  switch (value) {
    case 'BULLISH': return 'bullish';
    case 'BEARISH': return 'bearish';
    case 'NEUTRAL': return 'netral';
    case 'BULLISH_GOLD': return 'bullish untuk GOLD';
    case 'BEARISH_GOLD': return 'bearish untuk GOLD';
    case 'MIXED': return 'campuran';
    case 'INSUFFICIENT_DATA': return 'data tidak cukup';
    case 'UP': return 'naik';
    case 'DOWN': return 'turun';
    case 'FLAT': return 'datar';
    case 'DEMAND': return 'demand';
    case 'SUPPLY': return 'supply';
    case 'NONE': return 'tidak dekat zona aktif';
    case 'BOTH': return 'demand dan supply sekaligus';
    case 'BUY': return 'BUY';
    case 'SELL': return 'SELL';
    case 'READY': return 'siap';
    case 'DEGRADED': return 'terbatas';
    case 'STALE': return 'stale';
    case 'UNAVAILABLE': return 'tidak tersedia';
    case 'FEASIBLE': return 'layak';
    case 'WIDE_SPREAD': return 'spread terlalu lebar';
    default: return String(value ?? 'tidak diketahui').toLowerCase();
  }
}

function pct(value) {
  return Number.isFinite(value) ? `${round(value, 2)}%` : '—';
}

function num(value) {
  return Number.isFinite(value) ? String(round(value, 4)) : '—';
}

function signed(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = round(value, 4);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function directionOf(value) {
  if (BUY_WORDS.has(value)) return 'BUY';
  if (SELL_WORDS.has(value)) return 'SELL';
  return null;
}

function opposite(direction) {
  if (direction === 'BUY') return 'SELL';
  if (direction === 'SELL') return 'BUY';
  return null;
}

function relate(candidate, reference) {
  if (!candidate || !reference) return 'UNDEFINED';
  if (candidate === reference) return 'SUPPORTS';
  if (candidate === opposite(reference)) return 'OPPOSES';
  return 'NEUTRAL';
}

function buildDailyTrendInterpretation(decision) {
  const align = decision.higherTimeframeAlignment;
  const d1 = align.d1;
  const h4 = align.h4;

  let text;
  if (align.aligned) {
    text = `D1 ${label(d1)} dan H4 ${label(h4)} searah. Anchor harian adalah ${align.anchorDirection}, sehingga hierarki utama menetapkan prioritas ${align.anchorDirection}, bukan arah dari M1/Order Flow.`;
  } else if (align.conflict) {
    text = `D1 ${label(d1)} tetapi H4 ${label(h4)}. Arah utama bertentangan, sehingga tidak ada anchor yang sah dan keputusan ditahan.`;
  } else {
    text = `D1 ${label(d1)} dengan H4 ${label(h4)}. H4 belum mengonfirmasi arah D1, sehingga anchor belum dianggap utuh.`;
  }

  return {
    direction: d1,
    h4Confirmation: h4,
    aligned: align.aligned === true,
    conflict: align.conflict === true,
    anchorDirection: align.anchorDirection,
    text,
    keyPoints: [
      `D1: ${label(d1)}`,
      `H4: ${label(h4)}`,
      align.aligned ? 'D1/H4 selaras' : (align.conflict ? 'D1/H4 konflik' : 'H4 belum konfirmasi'),
    ],
    limitations: align.aligned ? [] : ['Arah utama belum utuh; bias tidak boleh dipaksakan.'],
  };
}

function buildStructureInterpretation(decision) {
  const structure = decision.diagnostics.structure;
  const anchor = decision.higherTimeframeAlignment.anchorDirection;

  if (!structure?.available) {
    return {
      direction: 'UNKNOWN',
      relationToAnchor: 'UNKNOWN',
      text: 'Struktur swing H1 belum dapat dibaca; tidak ada klaim higher high/lower low.',
      keyPoints: structure?.reasons || [],
      limitations: ['Struktur H1 tidak dipakai sebagai bukti arah.'],
    };
  }

  const structureDirection = directionOf(structure.direction);
  const relation = relate(structureDirection, anchor);
  const relationText = relation === 'SUPPORTS'
    ? 'mendukung anchor'
    : (relation === 'OPPOSES' ? 'berlawanan dengan anchor' : 'tidak memberi konfirmasi tegas');

  return {
    direction: structure.direction,
    relationToAnchor: relation,
    text: `Struktur H1 ${label(structure.direction)}; struktur ${relationText}. ${structure.reasons.join(' ')}`,
    keyPoints: structure.reasons.slice(),
    limitations: relation === 'OPPOSES'
      ? ['Konflik trend vs struktur adalah hard gate; skor tidak boleh mengalahkannya.']
      : [],
  };
}

function buildSupplyDemandInterpretation(decision) {
  const zone = decision.diagnostics.zoneContext;

  if (!zone?.available) {
    return {
      available: false,
      location: 'UNKNOWN',
      text: 'Lokasi Supply/Demand tidak tersedia; harga tidak diklaim berada di zona mana pun.',
      keyPoints: zone?.reasons || [],
      limitations: ['Lokasi zona tidak dipakai sebagai bukti.'],
    };
  }

  const demand = zone.demand;
  const supply = zone.supply;
  const zoneText = zone.location === 'DEMAND'
    ? `Harga berada di zona demand (skor ${num(demand?.score)}, lifecycle ${demand?.lifecycle ?? '—'})`
    : zone.location === 'SUPPLY'
      ? `Harga berada di zona supply (skor ${num(supply?.score)}, lifecycle ${supply?.lifecycle ?? '—'})`
      : zone.location === 'BOTH'
        ? 'Harga dekat demand dan supply sekaligus sehingga lokasi ambigu'
        : 'Harga tidak berada dekat zona aktif';

  return {
    available: true,
    location: zone.location,
    price: zone.price,
    proximity: zone.proximity,
    demand: zone.demand,
    supply: zone.supply,
    text: `${zoneText}. Jarak demand ${num(zone.demandDistance)}, jarak supply ${num(zone.supplyDistance)}, ambang proximity ${num(zone.proximity)}.`,
    keyPoints: [
      `Lokasi: ${label(zone.location)}`,
      `Demand ${num(demand?.low)}–${num(demand?.high)}`,
      `Supply ${num(supply?.low)}–${num(supply?.high)}`,
    ],
    limitations: zone.location === 'BOTH'
      ? ['Lokasi ambigu; arah lokasi tidak tegas.']
      : [],
  };
}

function buildOrderFlowInterpretation(decision) {
  const of = decision.diagnostics.orderFlowRead;
  const response = decision.diagnostics.priceResponse;

  if (!of?.available) {
    return {
      available: false,
      status: of?.status ?? DATA_INTEGRITY_STATUS.UNAVAILABLE,
      text: `Order Flow ${label(of?.status)}. Tidak ada agresi BUY/SELL yang diklaim; kategori ini dikeluarkan dari penilaian dan tidak diisi data simulasi.`,
      keyPoints: of?.reasons || [],
      limitations: ['Tanpa tape, konfirmasi agresor tidak boleh dikarang.'],
    };
  }

  const responseText = response?.available
    ? `Respons harga M1 ${label(response.direction)} (${num(response.changePct)}% pada ${response.lookback} bar)`
    : 'Respons harga M1 belum dapat diukur';

  let relationship;
  if (of.absorption?.status === 'DETECTED') {
    relationship = `Agresi ${label(of.aggressionDirection)} terserap dan membentuk absorption ${label(of.absorption.direction)}; ini bukan entry.`;
  } else if (of.aggressionDirection && response?.available) {
    const aggression = of.aggressionDirection;
    if ((aggression === 'BUY' && response.direction === 'UP')
      || (aggression === 'SELL' && response.direction === 'DOWN')) {
      relationship = `Agresi ${aggression} dikonfirmasi oleh arah harga.`;
    } else if (response.direction === 'FLAT') {
      relationship = `Agresi ${aggression} tidak diikuti pergerakan harga; konfirmasi arah belum sah.`;
    } else {
      relationship = `Agresi ${aggression} bergerak berlawanan dengan respons harga; ada indikasi penyerapan, tetapi belum tentu absorption tervalidasi.`;
    }
  } else {
    relationship = 'Tidak ada dominasi agresor yang cukup untuk menyimpulkan arah.';
  }

  return {
    available: true,
    status: of.status,
    buyPercent: of.buyPercent,
    sellPercent: of.sellPercent,
    delta: of.delta,
    cvd: of.cvd,
    imbalance: of.imbalance,
    aggressionDirection: of.aggressionDirection,
    absorptionDirection: of.absorption?.direction ?? null,
    text: `Agresi BUY ${pct(of.buyPercent)} vs SELL ${pct(of.sellPercent)} (PAXG proxy). Delta ${signed(of.delta)}, CVD ${signed(of.cvd)}, imbalance ${signed(of.imbalance)}. ${responseText}. ${relationship} Delta/CVD/imbalance hanya konfirmasi internal, bukan kategori bobot terpisah.`,
    keyPoints: [
      `BUY ${pct(of.buyPercent)} / SELL ${pct(of.sellPercent)}`,
      `Respons harga: ${response?.direction ?? 'UNKNOWN'}`,
      `Absorption: ${of.absorption?.status ?? 'NONE'}`,
    ],
    limitations: [
      'PAXG/USDT adalah proxy, bukan tape COMEX GC.',
      'Agresi tidak otomatis berarti harga akan bergerak searah.',
    ],
  };
}

function buildAbsorptionInterpretation(decision) {
  const of = decision.diagnostics.orderFlowRead;
  const absorption = of?.absorption;

  if (!of?.available) {
    return {
      detected: false,
      direction: null,
      text: 'Absorption tidak dapat dinilai karena Order Flow tidak tersedia.',
      proof: [],
      limitations: ['Tidak ada klaim absorption tanpa tape.'],
    };
  }

  if (absorption?.status !== 'DETECTED') {
    const providerClaim = of.providerAbsorption?.status === 'DETECTED';
    return {
      detected: false,
      direction: null,
      text: providerClaim
        ? 'Provider mengklaim absorption, tetapi bukti agresi + respons harga + lokasi zona tidak memenuhi syarat; klaim tidak dipakai.'
        : 'Tidak ada absorption tervalidasi. Agresi tanpa respons harga tidak otomatis disebut absorption.',
      proof: [],
      limitations: providerClaim
        ? ['Klaim provider tidak menggantikan pembuktian deterministik.']
        : [],
    };
  }

  const directionText = absorption.direction === 'BULLISH'
    ? 'Bullish absorption: tekanan jual agresif terserap di demand dan harga tidak turun.'
    : 'Bearish absorption: tekanan beli agresif terserap di supply dan harga tidak naik.';

  return {
    detected: true,
    direction: absorption.direction,
    pattern: absorption.pattern,
    text: `${directionText} Ini adalah bukti penyerapan, bukan izin BUY/SELL entry.`,
    proof: absorption.reasons.slice(),
    limitations: ['Absorption tetap bias; entry memerlukan gate deterministic yang terpisah.'],
  };
}

function buildIntermarketInterpretation(decision) {
  const im = decision.diagnostics.intermarketRead;
  const anchor = decision.higherTimeframeAlignment.anchorDirection;

  if (!im?.available) {
    return {
      available: false,
      bias: im?.bias ?? 'INSUFFICIENT_DATA',
      relationToAnchor: 'UNKNOWN',
      text: 'Intermarket tidak tersedia atau belum cukup data; kategori dikeluarkan dan tidak diisi simulasi.',
      keyPoints: [],
      notProvided: im?.notProvided ?? [],
      limitations: [
        im?.notProvided?.length
          ? `Belum tersedia dari provider: ${im.notProvided.join(', ')}.`
          : 'Tidak ada data intermarket yang dipakai.',
      ],
    };
  }

  const relation = relate(im.direction, anchor);
  const relationText = relation === 'SUPPORTS'
    ? 'mendukung anchor'
    : (relation === 'OPPOSES' ? 'bertentangan dengan anchor' : 'tidak memberi arah tegas');

  return {
    available: true,
    bias: im.bias,
    direction: im.direction,
    score: im.score,
    strength: im.strength,
    relationToAnchor: relation,
    text: `Intermarket ${label(im.bias)} (skor ${num(im.score)}, kekuatan ${im.strengthLabel ?? '—'}) dan ${relationText}. Korelasi bukan kausalitas.`,
    keyPoints: [
      `Bias: ${label(im.bias)}`,
      `Relasi ke anchor: ${relation}`,
      `Konfirmasi ${num(im.confirmationCount)}, konflik ${num(im.conflictCount)}`,
    ],
    notProvided: im.notProvided ?? [],
    limitations: [
      'Feed publik dapat tertunda.',
      im.notProvided?.length ? `Tidak dianalisis karena tidak tersedia: ${im.notProvided.join(', ')}.` : null,
    ].filter(Boolean),
  };
}

function buildEntrySetupInterpretation(decision) {
  const setup = decision.diagnostics.setupRead;
  const entry = decision.diagnostics.entryRead;
  const execution = decision.executionFeasibility;
  const anchor = decision.higherTimeframeAlignment.anchorDirection;
  const entryRelation = relate(entry?.direction, anchor);
  const setupRelation = relate(setup?.direction, anchor);

  return {
    setupDirection: setup?.direction ?? null,
    setupRelation,
    entryDirection: entry?.direction ?? null,
    entryRelation,
    entryTriggerSource: entry?.source ?? null,
    executionStatus: execution.status,
    text: `Konfirmasi M15/M5 ${setup?.available ? `${label(setup.direction)} (${setupRelation.toLowerCase()})` : 'tidak tersedia'}; trigger M1 ${entry?.available ? `${label(entry.direction)} (${entryRelation.toLowerCase()})` : 'tidak tersedia'}. Eksekusi ${label(execution.status)} dengan spread ${num(execution.spreadPips)} dan spread/ATR ${num(execution.spreadToAtr)}.`,
    keyPoints: [
      `Setup M15/M5: ${setup?.direction ?? 'UNAVAILABLE'}`,
      `Entry trigger M1: ${entry?.direction ?? 'UNAVAILABLE'}`,
      `Spread gate: ${execution.status}`,
    ],
    limitations: ['Tidak ada izin entry pada Tahap 4; bias bukan eksekusi.'],
  };
}

function categoryStatement(category) {
  const reasons = category.reasons.length ? ` ${category.reasons.join(' ')}` : '';
  return `${category.label} (${category.direction}, kekuatan ${round(category.strength, 2)}, bobot ${round(category.normalizedWeight, 2)}).${reasons}`;
}

function buildEvidenceLists(decision) {
  const target = decision.higherTimeframeAlignment.anchorDirection
    || (decision.preliminaryDecision === 'BUY_BIAS' ? 'BUY' : null)
    || (decision.preliminaryDecision === 'SELL_BIAS' ? 'SELL' : null);

  const supporting = [];
  const contradicting = [];
  const neutral = [];

  if (target) {
    for (const category of decision.weightedEvidence) {
      if (!category.available) continue;
      const item = {
        id: category.id,
        direction: category.direction,
        weight: category.normalizedWeight,
        strength: category.strength,
        statement: categoryStatement(category),
      };
      if (category.direction === target) supporting.push(item);
      else if (category.direction === opposite(target)) contradicting.push(item);
      else neutral.push(item);
    }
  }

  for (const conflict of decision.hardConflicts) {
    contradicting.push({
      id: conflict.code,
      direction: null,
      severity: 'HARD',
      weight: null,
      strength: null,
      statement: `${conflict.code}: ${conflict.message}`,
    });
  }

  for (const conflict of decision.softConflicts) {
    contradicting.push({
      id: conflict.code,
      direction: null,
      severity: 'SOFT',
      weight: null,
      strength: null,
      statement: `${conflict.code}: ${conflict.message}`,
    });
  }

  if (!target) {
    // WAIT/NO_TRADE without an anchor: the gate itself is the supporting reason.
    for (const conflict of [...decision.hardConflicts, ...decision.softConflicts]) {
      supporting.push({
        id: conflict.code,
        direction: null,
        severity: conflict.severity,
        weight: null,
        strength: null,
        statement: `${conflict.code}: ${conflict.message}`,
      });
    }
  }

  return { supporting, contradicting, neutral };
}

function hardGateNames(decision) {
  return decision.hardConflicts.map((item) => item.code);
}

function buildScenarios(decision, evidence) {
  const final = decision.preliminaryDecision;
  const anchor = decision.higherTimeframeAlignment.anchorDirection;
  const zone = decision.diagnostics.zoneContext;
  const of = decision.diagnostics.orderFlowRead;
  const response = decision.diagnostics.priceResponse;
  const execution = decision.executionFeasibility;
  const blockers = hardGateNames(decision);

  if (final === 'NO_TRADE') {
    return {
      primaryScenario: {
        id: 'PRIMARY',
        name: 'CAPITAL_PROTECTION',
        bias: 'NO_TRADE',
        status: 'BLOCKED',
        thesis: `Hard gate aktif (${blockers.join(', ') || decision.dataQualityStatus}). Tidak ada skenario trade sampai data kritis, freshness, dan eksekusi pulih. Skor tidak boleh membuka gate ini.`,
        evidenceFor: evidence.supporting,
        evidenceAgainst: evidence.contradicting,
        triggerConditions: [
          'XM tick/D1/H4 kembali READY dan sinkron',
          'Spread kembali dalam batas eksekusi',
          'Tidak ada hard conflict yang tersisa',
        ],
        invalidationConditions: ['Hard gate tetap aktif', 'Data kritis tetap stale/tidak tersedia'],
        entryPermission: false,
        executable: false,
      },
      alternativeScenario: {
        id: 'ALTERNATIVE',
        name: 'REVALIDATION_AFTER_GATE_CLEARS',
        bias: 'NO_TRADE',
        status: 'BLOCKED',
        thesis: 'Jika gate pulih, deterministic engine harus mengevaluasi ulang snapshot baru. AI tidak boleh menetapkan arah lebih awal.',
        evidenceFor: [],
        evidenceAgainst: evidence.supporting,
        triggerConditions: ['Snapshot baru dengan data kritis segar', 'Hard gate bersih'],
        invalidationConditions: ['Gate belum pulih'],
        entryPermission: false,
        executable: false,
      },
      invalidationScenario: {
        id: 'INVALIDATION',
        name: 'NO_TRADE_INVALIDATED_BY_GATE_CLEARANCE',
        bias: 'NO_TRADE',
        status: 'CONDITIONAL',
        thesis: 'NO_TRADE berakhir hanya ketika deterministic engine menghasilkan evaluasi baru tanpa hard conflict. Itu pun belum menjadi izin entry.',
        evidenceFor: blockers.map((code) => ({ id: code, statement: `Gate ${code} masih aktif.` })),
        evidenceAgainst: [],
        triggerConditions: ['Data kritikal READY', 'Spread feasible', 'Tidak ada hard conflict'],
        invalidationConditions: ['Gate tetap aktif'],
        entryPermission: false,
        executable: false,
      },
    };
  }

  if (final === 'WAIT' || !anchor) {
    const reason = decision.higherTimeframeAlignment.conflict
      ? 'D1 dan H4 bertentangan'
      : (blockers.length > 0
        ? `hard conflict: ${blockers.join(', ')}`
        : 'anchor belum terbentuk atau tidak ada trigger yang sah');

    return {
      primaryScenario: {
        id: 'PRIMARY',
        name: 'WAIT_FOR_RESOLUTION',
        bias: 'WAIT',
        status: 'WAIT',
        thesis: `Bias ditahan karena ${reason}. Menunggu resolusi lebih baik daripada memaksakan arah dari skor.`,
        evidenceFor: evidence.supporting,
        evidenceAgainst: evidence.contradicting,
        triggerConditions: [
          'Konflik utama terselesaikan pada snapshot berikutnya',
          'Tidak ada hard conflict baru',
          'Anchor D1/H4 kembali selaras',
        ],
        invalidationConditions: [
          'Hard conflict bertambah',
          'Data kritis menjadi UNAVAILABLE/STALE sehingga berubah menjadi NO_TRADE',
        ],
        entryPermission: false,
        executable: false,
      },
      alternativeScenario: {
        id: 'ALTERNATIVE',
        name: 'RESOLUTION_SCENARIO',
        bias: 'WAIT',
        status: 'CONDITIONAL',
        thesis: anchor
          ? `Jika konflik hilang dan struktur kembali searah anchor ${anchor}, bias ${anchor} dapat dievaluasi ulang oleh deterministic engine.`
          : 'Jika D1/H4 akhirnya sepakat, arah hasil kesepakatan itu yang boleh dievaluasi ulang; bukan arah pilihan AI.',
        evidenceFor: evidence.contradicting.filter((item) => item.severity === 'SOFT'),
        evidenceAgainst: evidence.supporting,
        triggerConditions: ['D1/H4 sepakat', 'Struktur H1 tidak berlawanan', 'Trigger M1 searah'],
        invalidationConditions: ['D1/H4 tetap konflik', 'Hard gate baru muncul'],
        entryPermission: false,
        executable: false,
      },
      invalidationScenario: {
        id: 'INVALIDATION',
        name: 'WAIT_INVALIDATED_TO_NO_TRADE',
        bias: 'NO_TRADE',
        status: 'CONDITIONAL',
        thesis: 'WAIT berubah menjadi NO_TRADE jika data kritis atau eksekusi gagal, atau tetap WAIT selama konflik belum selesai. AI tidak mengubah status ini sendiri.',
        evidenceFor: blockers.map((code) => ({ id: code, statement: `Hard conflict ${code}.` })),
        evidenceAgainst: [],
        triggerConditions: ['Muncul critical data failure atau spread gate'],
        invalidationConditions: ['Konflik terselesaikan tanpa gate baru'],
        entryPermission: false,
        executable: false,
      },
    };
  }

  const isBuy = final === 'BUY_BIAS';
  const bias = isBuy ? 'BUY_BIAS' : 'SELL_BIAS';
  const zoneSide = isBuy ? 'demand' : 'supply';
  const invalidationZone = zone?.location === (isBuy ? 'DEMAND' : 'SUPPLY');

  const primary = {
    id: 'PRIMARY',
    name: isBuy ? 'BULLISH_CONTINUATION' : 'BEARISH_CONTINUATION',
    bias,
    status: 'BIAS_ONLY',
    thesis: `Jika harga mempertahankan ${zoneSide} dan trigger M1 tetap searah, bias ${isBuy ? 'bullish' : 'bearish'} dapat berlanjut. Ini tetap bias, bukan izin entry.`,
    evidenceFor: evidence.supporting,
    evidenceAgainst: evidence.contradicting,
    triggerConditions: [
      `Harga bertahan di area ${zoneSide}`,
      `Trigger M1 ${isBuy ? 'bullish' : 'bearish'} tanpa konflik baru`,
      'Tidak ada hard conflict baru',
      'Spread tetap dalam batas eksekusi',
    ],
    invalidationConditions: [
      `D1/H4 berubah ${isBuy ? 'bearish' : 'bullish'}`,
      `Harga close menembus distal ${zoneSide}`,
      of?.absorption?.status === 'DETECTED'
        ? 'Absorption yang mendukung gagal dikonfirmasi pada snapshot berikutnya'
        : 'Agresi berbalik arah tanpa respons harga yang sesuai',
      'Data kritis menjadi stale/tidak tersedia',
    ],
    entryPermission: false,
    executable: false,
  };

  const alternative = {
    id: 'ALTERNATIVE',
    name: isBuy ? 'PULLBACK_OR_RANGE' : 'REBOUND_OR_RANGE',
    bias,
    status: 'BIAS_ONLY',
    thesis: `Jika ${invalidationZone ? `harga kehilangan ${zoneSide}` : `lokasi ${zoneSide} tidak tercapai`} atau trigger M1 melemah, skenario alternatif adalah ${isBuy ? 'pullback/range' : 'rebound/range'}. Bias ditunda, bukan dibalik secara paksa.`,
    evidenceFor: evidence.contradicting,
    evidenceAgainst: evidence.supporting,
    triggerConditions: [
      `Harga gagal mempertahankan ${zoneSide}`,
      'Trigger M1 kehilangan momentum',
      'Respons harga tidak lagi searah agresi',
    ],
    invalidationConditions: [
      `Harga kembali ke ${zoneSide} dengan trigger searah`,
      'Konflik hilang dan anchor tetap utuh',
    ],
    entryPermission: false,
    executable: false,
  };

  const invalidation = {
    id: 'INVALIDATION',
    name: isBuy ? 'BULLISH_BIAS_INVALIDATION' : 'BEARISH_BIAS_INVALIDATION',
    bias: isBuy ? 'SELL_BIAS' : 'BUY_BIAS',
    status: 'CONDITIONAL',
    thesis: `Bias ${isBuy ? 'bullish' : 'bearish'} gugur jika ${isBuy ? 'D1/H4 berubah bearish, struktur H1 membentuk lower low, atau demand ditembus dengan close' : 'D1/H4 berubah bullish, struktur H1 membentuk higher high, atau supply ditembus dengan close'}. Perubahan arah hanya sah setelah deterministic engine mengevaluasi ulang.`,
    evidenceFor: evidence.contradicting,
    evidenceAgainst: evidence.supporting,
    triggerConditions: [
      `D1/H4 ${isBuy ? 'bearish' : 'bullish'}`,
      `Struktur H1 ${isBuy ? 'bearish' : 'bullish'}`,
      `Close melewati distal ${zoneSide}`,
      'Hard conflict baru muncul',
    ],
    invalidationConditions: [
      `Harga kembali ke ${zoneSide} dan trend utama tetap ${isBuy ? 'bullish' : 'bearish'}`,
    ],
    entryPermission: false,
    executable: false,
  };

  return {
    primaryScenario: primary,
    alternativeScenario: alternative,
    invalidationScenario: invalidation,
    executionStatusNote: execution.status,
    priceResponseNote: response?.direction ?? 'UNKNOWN',
  };
}

function severityRank(level) {
  switch (level) {
    case 'BLOCKED': return 4;
    case 'HIGH': return 3;
    case 'ELEVATED': return 2;
    case 'MODERATE': return 1;
    default: return 0;
  }
}

function buildRiskAssessment(decision) {
  const risks = [];
  const push = (id, severity, description, evidence) => {
    risks.push({ id, severity, description, evidence });
  };

  for (const conflict of decision.hardConflicts) {
    push(
      `HARD_${conflict.code}`,
      'HIGH',
      conflict.message,
      conflict,
    );
  }
  for (const conflict of decision.softConflicts) {
    push(
      `SOFT_${conflict.code}`,
      'ELEVATED',
      conflict.message,
      { capPercent: conflict.capPercent },
    );
  }
  if (decision.dataQualityStatus !== DATA_INTEGRITY_STATUS.READY) {
    push(
      'DATA_QUALITY',
      decision.dataQualityStatus === DATA_INTEGRITY_STATUS.UNAVAILABLE ? 'HIGH' : 'ELEVATED',
      `Kualitas data ${label(decision.dataQualityStatus)}. ${decision.dataQuality.reasons.join(' ')}`,
      decision.dataQuality,
    );
  }
  if (decision.executionFeasibility.status !== 'FEASIBLE') {
    push(
      'EXECUTION',
      decision.executionFeasibility.feasible ? 'ELEVATED' : 'HIGH',
      decision.executionFeasibility.reasons.join(' '),
      decision.executionFeasibility,
    );
  }
  if (decision.confidenceCap.applied) {
    push(
      'CONFIDENCE_LIMIT',
      'ELEVATED',
      `Confidence dibatasi ke ${decision.confidenceCap.capPercent}% karena ${decision.confidenceCap.reasons.join(' ')}`,
      decision.confidenceCap,
    );
  }
  if (decision.missingEvidence.length > 0) {
    push(
      'MISSING_EVIDENCE',
      'ELEVATED',
      `${decision.missingEvidence.length} bukti/sumber tidak lengkap; keterbatasan harus dinyatakan, bukan diisi asumsi.`,
      decision.missingEvidence,
    );
  }
  if (decision.diagnostics.zoneContext?.location === 'BOTH') {
    push('ZONE_AMBIGUITY', 'ELEVATED', 'Harga dekat demand dan supply sekaligus; lokasi tidak tegas.', decision.diagnostics.zoneContext);
  }
  if (decision.diagnostics.orderFlowRead?.providerConflict) {
    push('ABSORPTION_CLAIM_CONFLICT', 'ELEVATED', 'Klaim absorption provider tidak sesuai bukti deterministik.', decision.diagnostics.orderFlowRead);
  }

  let level = 'MODERATE';
  if (decision.preliminaryDecision === 'NO_TRADE') level = 'BLOCKED';
  else if (decision.hardConflicts.length > 0) level = 'HIGH';
  else if (risks.length > 0) level = 'ELEVATED';

  const largest = risks.slice().sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] || null;

  return {
    level,
    headline: largest ? largest.description : 'Tidak ada risiko kritis yang terdeteksi pada bukti saat ini; bias tetap bukan izin entry.',
    largestRisk: largest,
    risks,
    mitigations: [
      'Jangan entry selama hard gate/NO_TRADE aktif.',
      'Tunggu snapshot baru yang segar dan sinkron sebelum evaluasi ulang.',
      'Gunakan deterministic engine sebagai satu-satunya pemberi entry/execution permission.',
    ],
    note: 'Risk assessment ini bukan saran ukuran posisi dan bukan probabilitas kemenangan.',
  };
}

function buildMarketAnswers(decision, interpretations, risk) {
  const align = decision.higherTimeframeAlignment;
  const zone = decision.diagnostics.zoneContext;
  const of = decision.diagnostics.orderFlowRead;
  const response = decision.diagnostics.priceResponse;
  const im = decision.diagnostics.intermarketRead;
  const setup = decision.diagnostics.setupRead;
  const entry = decision.diagnostics.entryRead;

  return [
    {
      id: 'DIRECTION',
      question: 'Apa arah GOLD hari berjalan?',
      answer: `D1 ${label(align.d1)}; anchor ${align.anchorDirection || 'belum sah'}.`,
    },
    {
      id: 'D1_H4_SUPPORT',
      question: 'Apakah D1 dan H4 mendukung arah tersebut?',
      answer: align.aligned
        ? `Ya, D1 ${label(align.d1)} dan H4 ${label(align.h4)} searah.`
        : (align.conflict ? `Tidak, D1 ${label(align.d1)} vs H4 ${label(align.h4)} bertentangan.` : `Belum, H4 ${label(align.h4)} belum mengonfirmasi D1 ${label(align.d1)}.`),
    },
    {
      id: 'PRICE_LOCATION',
      question: 'Di mana posisi harga terhadap Supply/Demand?',
      answer: zone?.available
        ? `Harga ${num(zone.price)} berada di ${label(zone.location)}; jarak demand ${num(zone.demandDistance)}, supply ${num(zone.supplyDistance)}.`
        : 'Lokasi zona tidak tersedia; tidak diklaim.',
    },
    {
      id: 'DOMINANCE',
      question: 'Apakah buyer atau seller sedang mendominasi?',
      answer: of?.available
        ? `BUY ${pct(of.buyPercent)} vs SELL ${pct(of.sellPercent)} pada tape PAXG proxy.`
        : 'Tidak diketahui karena Order Flow tidak tersedia.',
    },
    {
      id: 'AGGRESSION_RESPONSE',
      question: 'Apakah agresi transaksi menghasilkan pergerakan harga?',
      answer: of?.available
        ? `Agresi ${of.aggressionDirection || 'tidak dominan'}; respons harga ${label(response?.direction)}${response?.available ? ` (${num(response.changePct)}%)` : ''}.`
        : 'Tidak dapat dinilai tanpa Order Flow.',
    },
    {
      id: 'ABSORPTION_EXHAUSTION',
      question: 'Apakah terjadi absorption atau exhaustion?',
      answer: interpretations.absorptionInterpretation.text,
    },
    {
      id: 'INTERMARKET',
      question: 'Apakah intermarket mendukung atau bertentangan?',
      answer: im?.available
        ? `Intermarket ${label(im.bias)}; relasi ke anchor ${im.relationToAnchor}.`
        : 'Intermarket tidak tersedia; tidak ada klaim dukungan/pertentangan.',
    },
    {
      id: 'SETUP_READINESS',
      question: 'Apakah setup sudah siap dieksekusi?',
      answer: `Belum ada izin entry (entryPermission=false). Setup M15/M5 ${setup?.available ? label(setup.direction) : 'tidak tersedia'}, trigger M1 ${entry?.available ? label(entry.direction) : 'tidak tersedia'}, eksekusi ${label(decision.executionFeasibility.status)}.`,
    },
    {
      id: 'LARGEST_RISK',
      question: 'Apa risiko terbesar jika posisi dibuka sekarang?',
      answer: risk.headline,
    },
  ];
}

function buildConceptDistinctions(decision) {
  const of = decision.diagnostics.orderFlowRead;
  const response = decision.diagnostics.priceResponse;

  const aggressiveBuyDetected = of?.available
    && (of.aggressionDirection === 'BUY' || (Number.isFinite(of.buyPercent) && of.buyPercent >= 65));
  const aggressiveBuyConfirmed = aggressiveBuyDetected && response?.direction === 'UP';
  const aggressiveSellDetected = of?.available
    && (of.aggressionDirection === 'SELL' || (Number.isFinite(of.sellPercent) && of.sellPercent >= 65));
  const aggressiveSellConfirmed = aggressiveSellDetected && response?.direction === 'DOWN';
  const bullishAbsorption = of?.absorption?.direction === 'BULLISH';
  const bearishAbsorption = of?.absorption?.direction === 'BEARISH';

  return {
    aggressiveBuy: {
      detected: aggressiveBuyDetected,
      confirmedByPrice: aggressiveBuyConfirmed,
      status: !aggressiveBuyDetected
        ? 'NO_AGGRESSIVE_BUY'
        : (aggressiveBuyConfirmed ? 'AGGRESSION_CONFIRMED_BY_PRICE' : 'AGGRESSION_WITHOUT_PRICE_RESPONSE'),
      explanation: aggressiveBuyDetected
        ? 'Pembeli agresif terdeteksi, tetapi agresi saja belum berarti harga akan naik; konfirmasi harus datang dari respons harga dan lokasi.'
        : 'Tidak ada dominasi pembeli agresif pada tape yang tersedia.',
    },
    aggressiveSell: {
      detected: aggressiveSellDetected,
      confirmedByPrice: aggressiveSellConfirmed,
      status: !aggressiveSellDetected
        ? 'NO_AGGRESSIVE_SELL'
        : (aggressiveSellConfirmed ? 'AGGRESSION_CONFIRMED_BY_PRICE' : 'AGGRESSION_WITHOUT_PRICE_RESPONSE'),
      explanation: aggressiveSellDetected
        ? 'Penjual agresif terdeteksi, tetapi agresi saja belum berarti harga akan turun.'
        : 'Tidak ada dominasi penjual agresif pada tape yang tersedia.',
    },
    bullishAbsorption: {
      detected: bullishAbsorption,
      status: bullishAbsorption ? 'PROVEN_BY_AGGRESSION_PRICE_AND_ZONE' : 'NOT_PROVEN',
      explanation: bullishAbsorption
        ? 'Tekanan jual agresif tertahan di demand dan harga tidak turun; ini absorption, bukan BUY entry.'
        : 'Tidak ada bukti bullish absorption yang memenuhi agresi jual + respons harga + lokasi demand.',
    },
    bearishAbsorption: {
      detected: bearishAbsorption,
      status: bearishAbsorption ? 'PROVEN_BY_AGGRESSION_PRICE_AND_ZONE' : 'NOT_PROVEN',
      explanation: bearishAbsorption
        ? 'Tekanan beli agresif tertahan di supply dan harga tidak naik; ini absorption, bukan SELL entry.'
        : 'Tidak ada bukti bearish absorption yang memenuhi agresi beli + respons harga + lokasi supply.',
    },
    buyEntry: {
      allowed: false,
      status: 'NOT_PERMITTED',
      explanation: 'BUY entry memerlukan trend, lokasi, konfirmasi, trigger, eksekusi, dan tidak ada hard conflict. Tahap 4 tidak memberi izin entry.',
      requirements: [
        'D1/H4 searah bullish',
        'Struktur H1 mendukung',
        'Harga di demand',
        'Trigger M1 bullish',
        'Spread/ATR layak',
        'Tidak ada hard conflict',
      ],
    },
    sellEntry: {
      allowed: false,
      status: 'NOT_PERMITTED',
      explanation: 'SELL entry memerlukan trend, lokasi, konfirmasi, trigger, eksekusi, dan tidak ada hard conflict. Tahap 4 tidak memberi izin entry.',
      requirements: [
        'D1/H4 searah bearish',
        'Struktur H1 mendukung',
        'Harga di supply',
        'Trigger M1 bearish',
        'Spread/ATR layak',
        'Tidak ada hard conflict',
      ],
    },
    note: 'Aggressive Buy, Bullish Absorption, dan BUY Entry adalah tiga kondisi berbeda dan tidak boleh disamakan.',
  };
}

function buildDecisionExplanation(decision, interpretations, risk) {
  const final = decision.preliminaryDecision;
  const reasons = [];
  reasons.push(`Deterministic engine menetapkan ${final}; AI Synthesis tidak mengubah keputusan ini.`);
  reasons.push(`Anchor ${decision.higherTimeframeAlignment.anchorDirection || 'NONE'}: D1 ${label(decision.higherTimeframeAlignment.d1)}, H4 ${label(decision.higherTimeframeAlignment.h4)}.`);
  reasons.push(interpretations.orderFlowInterpretation.text);
  if (decision.hardConflicts.length > 0) {
    reasons.push(`Hard gate aktif: ${decision.hardConflicts.map((item) => item.code).join(', ')}.`);
  }
  if (decision.softConflicts.length > 0) {
    reasons.push(`Soft conflict: ${decision.softConflicts.map((item) => item.code).join(', ')}.`);
  }
  reasons.push(`Confidence cap ${decision.confidenceCap.capPercent}%; skor BUY ${decision.buyEvidenceScore}, SELL ${decision.sellEvidenceScore}, NEUTRAL ${decision.neutralEvidenceScore}.`);
  reasons.push(`Risiko utama: ${risk.headline}`);
  reasons.push('Keputusan akhir konsisten dengan deterministic engine; tidak ada izin entry/eksekusi.');
  return reasons.join(' ');
}

function buildMarketNarrative(interpretations, decision, risk) {
  return [
    interpretations.dailyTrendInterpretation.text,
    interpretations.marketStructureInterpretation.text,
    interpretations.supplyDemandInterpretation.text,
    interpretations.orderFlowInterpretation.text,
    interpretations.absorptionInterpretation.text,
    interpretations.intermarketInterpretation.text,
    interpretations.entrySetupInterpretation.text,
    `Keputusan deterministic: ${decision.preliminaryDecision}. ${risk.headline}`,
  ].join(' ');
}

export function computeSynthesisEvidenceHash(payload) {
  try {
    const clone = { ...(payload || {}) };
    delete clone.evidenceHash;
    delete clone.generatedAt;
    return crypto.createHash('sha256').update(stableStringify(clone)).digest('hex');
  } catch (_) {
    return 'SYNTHESIS_HASH_GENERATION_FAILED';
  }
}

/**
 * Synthesizes cognitive reasoning from a deterministic decision.
 * `decision` must come from evaluateJiniDecision; it carries diagnostics.
 */
export function synthesizeJiniDecision(decision, { now = Date.now() } = {}) {
  if (!decision || !decision.preliminaryDecision) {
    throw new Error('AI Synthesis requires a deterministic decision object.');
  }

  const interpretations = {
    dailyTrendInterpretation: buildDailyTrendInterpretation(decision),
    marketStructureInterpretation: buildStructureInterpretation(decision),
    supplyDemandInterpretation: buildSupplyDemandInterpretation(decision),
    orderFlowInterpretation: buildOrderFlowInterpretation(decision),
    absorptionInterpretation: buildAbsorptionInterpretation(decision),
    intermarketInterpretation: buildIntermarketInterpretation(decision),
    entrySetupInterpretation: buildEntrySetupInterpretation(decision),
  };

  const evidence = buildEvidenceLists(decision);
  const scenarios = buildScenarios(decision, evidence);
  const risk = buildRiskAssessment(decision);
  const conceptDistinctions = buildConceptDistinctions(decision);
  const marketAnswers = buildMarketAnswers(decision, interpretations, risk);
  const decisionExplanation = buildDecisionExplanation(decision, interpretations, risk);
  const marketNarrative = buildMarketNarrative(interpretations, decision, risk);

  const generatedAt = new Date(Number.isFinite(Number(now)) ? Number(now) : Date.now()).toISOString();

  const synthesis = {
    synthesisContractVersion: SYNTHESIS_CONTRACT_VERSION,
    engineVersion: decision.engineVersion,
    instrument: decision.instrument,
    generatedAt,
    inputDecisionHash: decision.evidenceHash,
    finalDecision: decision.preliminaryDecision,
    finalDecisionSource: 'DETERMINISTIC_ENGINE',
    decisionLocked: true,
    decisionConsistency: {
      engineDecision: decision.preliminaryDecision,
      finalDecision: decision.preliminaryDecision,
      matches: true,
      aiMayOverride: false,
    },
    marketNarrative,
    ...interpretations,
    primaryScenario: scenarios.primaryScenario,
    alternativeScenario: scenarios.alternativeScenario,
    invalidationScenario: scenarios.invalidationScenario,
    riskAssessment: risk,
    decisionExplanation,
    supportingEvidence: evidence.supporting,
    contradictingEvidence: evidence.contradicting,
    neutralEvidence: evidence.neutral,
    missingEvidence: decision.missingEvidence.slice(),
    marketAnswers,
    conceptDistinctions,
    hardGateSnapshot: {
      dataQualityStatus: decision.dataQualityStatus,
      executionStatus: decision.executionFeasibility.status,
      hardConflicts: decision.hardConflicts.map((item) => item.code),
      softConflicts: decision.softConflicts.map((item) => item.code),
      confidenceCapPercent: decision.confidenceCap.capPercent,
    },
    limitations: [
      'AI Synthesis bersifat deterministik dan tidak memanggil LLM/network; tujuannya reproducibility dan fail-closed.',
      'Tidak ada harga, volume, atau candle yang dikarang.',
      'PAXG/USDT tetap proxy; COMEX GC tidak diklaim.',
      'Tidak ada izin entry maupun auto-trading.',
      'Skor bukan probabilitas kemenangan.',
    ],
    entryPermission: false,
    executionAllowed: false,
    autoTrade: false,
    isSignal: false,
    strategyApproved: false,
    note: 'AI Synthesis hanya menafsirkan bukti. BUY_BIAS/SELL_BIAS bukan BUY/SELL entry.',
  };

  synthesis.evidenceHash = computeSynthesisEvidenceHash(synthesis);
  return deepFreeze(synthesis);
}

export function validateSynthesis(synthesis, decision) {
  const errors = [];
  const warnings = [];
  const required = [
    'marketNarrative',
    'dailyTrendInterpretation',
    'marketStructureInterpretation',
    'supplyDemandInterpretation',
    'orderFlowInterpretation',
    'absorptionInterpretation',
    'intermarketInterpretation',
    'primaryScenario',
    'alternativeScenario',
    'invalidationScenario',
    'riskAssessment',
    'decisionExplanation',
    'supportingEvidence',
    'contradictingEvidence',
    'missingEvidence',
  ];

  for (const field of required) {
    if (synthesis?.[field] == null) errors.push(`Missing required synthesis field: ${field}`);
  }

  if (decision && synthesis.finalDecision !== decision.preliminaryDecision) {
    errors.push('AI Synthesis changed the deterministic decision');
  }
  if (synthesis.decisionLocked !== true || synthesis.finalDecisionSource !== 'DETERMINISTIC_ENGINE') {
    errors.push('AI Synthesis must lock the final decision to the deterministic engine');
  }
  if (synthesis.entryPermission !== false
    || synthesis.executionAllowed !== false
    || synthesis.autoTrade !== false
    || synthesis.isSignal !== false
    || synthesis.strategyApproved !== false) {
    errors.push('AI Synthesis must never grant entry/execution privileges');
  }
  if (['BUY_BIAS', 'SELL_BIAS'].includes(synthesis.finalDecision)
    && (decision?.hardConflicts || []).length > 0) {
    errors.push('AI Synthesis cannot keep a directional bias while a hard conflict exists');
  }
  for (const key of ['primaryScenario', 'alternativeScenario', 'invalidationScenario']) {
    if (synthesis?.[key]?.entryPermission !== false || synthesis?.[key]?.executable !== false) {
      errors.push(`Scenario ${key} must not be executable`);
    }
  }
  if (typeof synthesis?.evidenceHash !== 'string' || synthesis.evidenceHash.length !== 64) {
    errors.push('Synthesis evidenceHash is missing or malformed');
  } else if (computeSynthesisEvidenceHash(synthesis) !== synthesis.evidenceHash) {
    errors.push('Synthesis evidenceHash mismatch');
  }
  const text = String(synthesis?.marketNarrative || '');
  if (/\bCOMEX\b/i.test(text)) {
    warnings.push('Narrative mentions COMEX; verify it is explicitly marked UNAVAILABLE and not claimed as the feed.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export default synthesizeJiniDecision;
