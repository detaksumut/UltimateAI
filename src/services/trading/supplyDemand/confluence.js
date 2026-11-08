/**
 * confluence.js
 * Multi-timeframe confluence for S&D zones.
 *
 * Timeframe identity is always preserved: a cluster never merges zones into a
 * single anonymous box. Each member keeps its own timeframe, score, lifecycle
 * and proximal/distal levels.
 */

import {
  SD_SIDE,
  SD_TIMEFRAME_WEIGHT,
  mergeConfig,
} from './constants.js';
import { clamp } from './candleValidation.js';

export function distanceToZone(zone, price) {
  if (!Number.isFinite(price)) {
    return { distance: null, distanceAtr: null, position: 'UNKNOWN' };
  }
  let distance = 0;
  let position = 'INSIDE';
  if (price > zone.high) {
    distance = price - zone.high;
    position = 'ABOVE';
  } else if (price < zone.low) {
    distance = zone.low - price;
    position = 'BELOW';
  }
  const distanceAtr = zone.atr > 0 ? distance / zone.atr : null;
  return { distance, distanceAtr, position };
}

function isPreferredSide(side, position) {
  if (side === SD_SIDE.SUPPLY) return position === 'BELOW' || position === 'INSIDE';
  return position === 'ABOVE' || position === 'INSIDE';
}

export function pickNearestZone(zones = [], side, price) {
  const sameSide = zones.filter((zone) => zone.side === side);
  if (sameSide.length === 0) return null;

  const scored = sameSide.map((zone) => ({
    zone,
    ...distanceToZone(zone, price),
    preferred: isPreferredSide(side, distanceToZone(zone, price).position),
  }));

  const preferred = scored.filter((row) => row.preferred);
  const pool = preferred.length ? preferred : scored;
  pool.sort((a, b) => {
    const da = Number.isFinite(a.distance) ? a.distance : Infinity;
    const db = Number.isFinite(b.distance) ? b.distance : Infinity;
    return da - db;
  });

  const best = pool[0];
  return best
    ? {
      ...best.zone,
      distance: best.distance,
      distanceAtr: best.distanceAtr,
      position: best.position,
    }
    : null;
}

export function pickStrongestZone(zones = []) {
  if (zones.length === 0) return null;
  return [...zones].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const wa = SD_TIMEFRAME_WEIGHT[a.timeframe] || 1;
    const wb = SD_TIMEFRAME_WEIGHT[b.timeframe] || 1;
    return wb - wa;
  })[0];
}

function clusterRange(members) {
  return {
    low: Math.min(...members.map((zone) => zone.low)),
    high: Math.max(...members.map((zone) => zone.high)),
  };
}

function clusterAtr(members) {
  const values = members.map((zone) => zone.atr).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function gapToRange(range, zone) {
  if (zone.high < range.low) return range.low - zone.high;
  if (zone.low > range.high) return zone.low - range.high;
  return 0;
}

export function buildConfluenceClusters(zones = [], config = {}, currentPrice = null) {
  const cfg = mergeConfig(config);
  const active = zones.filter((zone) => zone.active !== false && zone.lifecycle !== 'INVALID');
  const clusters = [];

  for (const side of [SD_SIDE.SUPPLY, SD_SIDE.DEMAND]) {
    const sideZones = active
      .filter((zone) => zone.side === side)
      .sort((a, b) => a.low - b.low);

    const sideClusters = [];
    for (const zone of sideZones) {
      let target = null;
      for (const cluster of sideClusters) {
        const range = clusterRange(cluster.members);
        const nearAtr = cfg.confluenceNearAtr * Math.max(clusterAtr(cluster.members), zone.atr || 0);
        if (gapToRange(range, zone) <= nearAtr) {
          target = cluster;
          break;
        }
      }
      if (target) {
        target.members.push(zone);
      } else {
        sideClusters.push({ members: [zone] });
      }
    }

    for (const cluster of sideClusters) {
      const members = [...cluster.members].sort((a, b) => b.score - a.score);
      const range = clusterRange(members);
      const timeframes = [...new Set(members.map((zone) => zone.timeframe))];
      const totalWeight = members.reduce(
        (sum, zone) => sum + (SD_TIMEFRAME_WEIGHT[zone.timeframe] || 1),
        0,
      );
      const weightedScore = totalWeight > 0
        ? members.reduce(
          (sum, zone) => sum + (zone.score * (SD_TIMEFRAME_WEIGHT[zone.timeframe] || 1)),
          0,
        ) / totalWeight
        : 0;
      const confluenceBonus = 1 + (0.08 * Math.max(0, timeframes.length - 1));
      const strength = Math.round(clamp(weightedScore * confluenceBonus, 0, 100));

      const proximal = side === SD_SIDE.SUPPLY
        ? Math.min(...members.map((zone) => zone.proximal))
        : Math.max(...members.map((zone) => zone.proximal));
      const distal = side === SD_SIDE.SUPPLY
        ? Math.max(...members.map((zone) => zone.distal))
        : Math.min(...members.map((zone) => zone.distal));

      const clusterRangeForDistance = { low: range.low, high: range.high };
      const distanceInfo = distanceToZone(
        { ...clusterRangeForDistance, atr: clusterAtr(members) },
        currentPrice,
      );

      clusters.push({
        id: `${side}|${timeframes.join('+')}|${Math.round(range.low * 10000)}-${Math.round(range.high * 10000)}`,
        side,
        low: range.low,
        high: range.high,
        proximal,
        distal,
        strength,
        weightedScore: Math.round(weightedScore * 10) / 10,
        confluenceBonus,
        isConfluence: timeframes.length >= 2,
        confluenceLevel: timeframes.length,
        timeframes,
        members: members.map((zone) => ({
          id: zone.id,
          timeframe: zone.timeframe,
          side: zone.side,
          score: zone.score,
          lifecycle: zone.lifecycle,
          proximal: zone.proximal,
          distal: zone.distal,
          high: zone.high,
          low: zone.low,
          testCount: zone.testCount,
          bos: zone.bos,
        })),
        strongestMember: members[0],
        distance: distanceInfo.distance,
        distanceAtr: distanceInfo.distanceAtr,
        position: distanceInfo.position,
      });
    }
  }

  return clusters.sort((a, b) => {
    if (a.isConfluence !== b.isConfluence) return a.isConfluence ? -1 : 1;
    return b.strength - a.strength;
  });
}
