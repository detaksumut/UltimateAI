/**
 * SupplyDemandDetector.js
 * Algorithmic Supply and Demand Zone Detector for Scalping (M1 & M5).
 *
 * Concepts:
 * - Demand Zone (Buy / Bullish Origin):
 *   Terbentuk dari base candle kecil yang diikuti impulsive bullish expansion (rally kuat)
 *   yang menembus high sebelumnya atau memiliki body > 2x ATR.
 * - Supply Zone (Sell / Bearish Origin):
 *   Terbentuk dari base candle kecil yang diikuti impulsive bearish expansion (drop kuat)
 *   yang menembus low sebelumnya atau memiliki body > 2x ATR.
 *
 * Rules:
 * - Freshness tracking: Zona yang belum pernah di-retest dianggap FRESH (probabilitas tertinggi).
 * - Tested count: Menghitung berapa kali harga menyentuh zona (1-2x = TESTED, >3x = WEAK/MITIGATED).
 * - Broken/Invalidated: Jika harga menembus di atas Supply zone atau di bawah Demand zone.
 */

export function detectSupplyDemandZones(candles = [], timeframe = 'M1') {
  if (!Array.isArray(candles) || candles.length < 15) {
    return {
      supply: [],
      demand: [],
      nearestSupply: null,
      nearestDemand: null,
      scalpSignal: null,
    };
  }

  const n = candles.length;
  const currentPrice = candles[n - 1].close;

  // 1. Calculate Average True Range (ATR 14) for impulse threshold
  let sumTr = 0;
  for (let i = Math.max(1, n - 15); i < n; i++) {
    const prev = candles[i - 1].close;
    const cur = candles[i];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev),
      Math.abs(cur.low - prev)
    );
    sumTr += tr;
  }
  const atr = Math.max(0.2, sumTr / 14);

  const rawZones = [];

  // 2. Scan for explosive impulse candles (Rally-Base-Rally, Drop-Base-Drop, Drop-Base-Rally, Rally-Base-Drop)
  for (let i = 2; i < n - 1; i++) {
    const base = candles[i - 1];
    const impulse = candles[i];
    const impulseNext = candles[i + 1] || impulse;

    const baseBody = Math.abs(base.close - base.open);
    const impulseBody = Math.abs(impulse.close - impulse.open);
    const twoBarMove = impulseNext.close - base.open;

    // Check for Bullish Impulse (Demand Creation)
    // Syarat: Candle impulse hijau kuat dengan body > 1.4x ATR dan bergerak tajam ke atas
    if (impulse.close > impulse.open && (impulseBody >= atr * 1.2 || twoBarMove >= atr * 1.8)) {
      const zoneHigh = Math.max(base.open, base.close, base.high * 0.9998);
      const zoneLow = Math.min(base.open, base.close, base.low);
      const zoneHeight = zoneHigh - zoneLow;

      if (zoneHeight > 0 && zoneHeight < atr * 4) {
        rawZones.push({
          type: 'DEMAND',
          timeframe,
          startIndex: i - 1,
          timestamp: base.timestamp,
          high: zoneHigh,
          low: zoneLow,
          mid: (zoneHigh + zoneLow) / 2,
          originPrice: base.close,
          strength: impulseBody >= atr * 2 ? 'HIGH' : 'NORMAL',
        });
      }
    }

    // Check for Bearish Impulse (Supply Creation)
    // Syarat: Candle impulse merah kuat dengan body > 1.4x ATR dan bergerak tajam ke bawah
    if (impulse.close < impulse.open && (impulseBody >= atr * 1.2 || -twoBarMove >= atr * 1.8)) {
      const zoneHigh = Math.max(base.open, base.close, base.high);
      const zoneLow = Math.min(base.open, base.close, base.low * 1.0002);
      const zoneHeight = zoneHigh - zoneLow;

      if (zoneHeight > 0 && zoneHeight < atr * 4) {
        rawZones.push({
          type: 'SUPPLY',
          timeframe,
          startIndex: i - 1,
          timestamp: base.timestamp,
          high: zoneHigh,
          low: zoneLow,
          mid: (zoneHigh + zoneLow) / 2,
          originPrice: base.close,
          strength: impulseBody >= atr * 2 ? 'HIGH' : 'NORMAL',
        });
      }
    }
  }

  // 3. Test and Filter Zones against subsequent price action
  const activeSupply = [];
  const activeDemand = [];

  for (const zone of rawZones) {
    let testCount = 0;
    let broken = false;

    for (let j = zone.startIndex + 2; j < n; j++) {
      const c = candles[j];

      if (zone.type === 'DEMAND') {
        // Price penetrates below zone low -> Demand Broken
        if (c.close < zone.low) {
          broken = true;
          break;
        }
        // Price taps into zone
        if (c.low <= zone.high && c.high >= zone.low) {
          testCount++;
        }
      } else {
        // Price penetrates above zone high -> Supply Broken
        if (c.close > zone.high) {
          broken = true;
          break;
        }
        // Price taps into zone
        if (c.high >= zone.low && c.low <= zone.high) {
          testCount++;
        }
      }
    }

    if (!broken && testCount <= 3) {
      const status = testCount === 0 ? 'FRESH' : testCount === 1 ? 'TESTED 1x' : 'WEAK';
      const enriched = { ...zone, testCount, status };
      if (zone.type === 'SUPPLY') activeSupply.push(enriched);
      else activeDemand.push(enriched);
    }
  }

  // Sort Supply by distance above current price (nearest first)
  const suppliesAbove = activeSupply
    .filter(z => z.low >= currentPrice - atr * 0.2)
    .sort((a, b) => a.low - b.low);

  // Sort Demand by distance below current price (nearest first)
  const demandsBelow = activeDemand
    .filter(z => z.high <= currentPrice + atr * 0.2)
    .sort((a, b) => b.high - a.high);

  const nearestSupply = suppliesAbove[0] || null;
  const nearestDemand = demandsBelow[0] || null;

  // 4. Scalp Opportunity Detection
  let scalpSignal = null;
  if (nearestDemand && currentPrice >= nearestDemand.low && currentPrice <= nearestDemand.high + atr * 0.4) {
    const risk = currentPrice - nearestDemand.low + atr * 0.3;
    const target = nearestSupply ? nearestSupply.low : currentPrice + risk * 2;
    scalpSignal = {
      action: 'BUY_AT_DEMAND',
      side: 'BUY',
      zone: nearestDemand,
      entry: currentPrice,
      stopLoss: nearestDemand.low - atr * 0.3,
      takeProfit: target,
      riskReward: ((target - currentPrice) / Math.max(0.1, risk)).toFixed(1),
      note: `Harga memasuki Demand ${timeframe} (${nearestDemand.status}). Siap pantulan Rejection Long.`
    };
  } else if (nearestSupply && currentPrice <= nearestSupply.high && currentPrice >= nearestSupply.low - atr * 0.4) {
    const risk = nearestSupply.high - currentPrice + atr * 0.3;
    const target = nearestDemand ? nearestDemand.high : currentPrice - risk * 2;
    scalpSignal = {
      action: 'SELL_AT_SUPPLY',
      side: 'SELL',
      zone: nearestSupply,
      entry: currentPrice,
      stopLoss: nearestSupply.high + atr * 0.3,
      takeProfit: target,
      riskReward: ((currentPrice - target) / Math.max(0.1, risk)).toFixed(1),
      note: `Harga memasuki Supply ${timeframe} (${nearestSupply.status}). Siap penolakan Rejection Short.`
    };
  }

  return {
    timeframe,
    currentPrice,
    atr,
    supply: suppliesAbove.slice(0, 3),
    demand: demandsBelow.slice(0, 3),
    nearestSupply,
    nearestDemand,
    scalpSignal
  };
}

