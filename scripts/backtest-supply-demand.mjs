#!/usr/bin/env node
/**
 * backtest-supply-demand.mjs
 * Phase 1 S&D backtest / validation runner.
 *
 * Default policy: only MT5_LOCAL_BRIDGE (XM) OHLC is accepted. Use
 * --allow-non-xm only for offline mechanics checks; results are then labelled
 * NON-XM LAB and must never be presented as XM accuracy.
 *
 * Metrics are intentionally descriptive:
 * - first-touch rate
 * - reaction rate after first touch
 * - breakout / invalidation rate
 * - false-zone rate
 * - per-timeframe and per-score/freshness buckets
 *
 * This script does not generate BUY/SELL signals and does not submit orders.
 *
 * Usage:
 *   node scripts/backtest-supply-demand.mjs
 *   node scripts/backtest-supply-demand.mjs --timeframes M5,M15,H1 --split 0.7
 *   node scripts/backtest-supply-demand.mjs --allow-non-xm
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SD_DEFAULT_CONFIG,
  SD_TIMEFRAMES,
  mergeConfig,
} from '../src/services/trading/supplyDemand/constants.js';
import {
  normalizeSymbol,
  normalizeTimeframe,
  validateCandleSeries,
} from '../src/services/trading/supplyDemand/candleValidation.js';
import {
  runBacktestForTimeframe,
  summarizeOutcomes,
} from '../src/services/trading/supplyDemand/zoneDetection.js';
import { fetchXmOhlc } from '../src/services/trading/supplyDemand/xmOhlcClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function pct(value) {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function printMetrics(label, metrics) {
  console.log(
    `  ${label.padEnd(6)} zones=${String(metrics.total).padStart(3)} `
    + `touch=${pct(metrics.touchRate).padStart(6)} `
    + `reaction=${pct(metrics.reactionRate).padStart(6)} `
    + `invalid=${pct(metrics.invalidationRate).padStart(6)} `
    + `false=${pct(metrics.falseZoneRate).padStart(6)} `
    + `precision=${pct(metrics.precision).padStart(6)} `
    + `censored=${metrics.censored}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbol = normalizeSymbol(args.symbol || 'XAUUSD');
  const timeframes = String(args.timeframes || SD_TIMEFRAMES.join(','))
    .split(',')
    .map((tf) => normalizeTimeframe(tf))
    .filter((tf) => SD_TIMEFRAMES.includes(tf));
  const limit = Math.min(500, Math.max(40, Number(args.limit) || 500));
  const splitRatio = Math.min(0.9, Math.max(0.1, Number(args.split) || 0.7));
  const allowNonXmSource = args['allow-non-xm'] === true;
  const endpoint = args.endpoint || null;
  const config = mergeConfig({
    ...SD_DEFAULT_CONFIG,
    ...(args.invalidation ? { invalidationMode: String(args.invalidation).toUpperCase() } : {}),
  });

  console.log('========================================================================');
  console.log('PHASE 1 SUPPLY & DEMAND BACKTEST');
  console.log('========================================================================');
  console.log(`symbol=${symbol} timeframes=${timeframes.join(',')} limit=${limit} split=${splitRatio}`);
  console.log(`policy=${allowNonXmSource ? 'NON-XM LAB (mechanics only)' : 'XM MT5 bridge only'}`);
  console.log(`invalidationMode=${config.invalidationMode}`);
  console.log('');

  const fetched = await Promise.all(timeframes.map(async (timeframe) => [
    timeframe,
    await fetchXmOhlc({
      symbol,
      timeframe,
      limit,
      endpoint,
      allowNonXmSource,
      timeoutMs: 12_000,
    }),
  ]));

  const reportTimeframes = {};
  const failures = {};
  const devOutcomes = [];
  const testOutcomes = [];
  const sources = new Set();

  for (const [timeframe, result] of fetched) {
    if (!result.ok) {
      failures[timeframe] = {
        code: result.code,
        message: result.message,
        source: result.source || null,
      };
      console.log(`${timeframe}: ${result.code} — ${result.message}`);
      continue;
    }

    sources.add(result.source);
    const validation = validateCandleSeries({
      candles: result.candles,
      symbol,
      timeframe,
      source: result.source,
      tick: result.tick,
      now: Date.now(),
      config,
      allowNonXmSource,
    });

    if (!validation.ok) {
      failures[timeframe] = {
        code: validation.code,
        message: validation.message,
        source: result.source,
      };
      console.log(`${timeframe}: ${validation.code} — ${validation.message}`);
      continue;
    }

    const backtest = runBacktestForTimeframe({
      candles: validation.candles,
      symbol,
      timeframe,
      config,
      splitRatio,
    });

    devOutcomes.push(...backtest.devOutcomes);
    testOutcomes.push(...backtest.testOutcomes);

    reportTimeframes[timeframe] = {
      data: {
        source: result.source,
        candles: validation.count,
        freshness: validation.freshness,
        qualityScore: validation.qualityScore,
        completeness: validation.completeness,
        gapRatio: validation.gapRatio,
        firstTime: validation.firstTime,
        lastTime: validation.lastTime,
        warnings: validation.warnings,
      },
      dev: backtest.dev,
      test: backtest.test,
    };

    console.log(`${timeframe} (${result.source}) candles=${validation.count} freshness=${validation.freshness}`);
    printMetrics('dev', backtest.dev);
    printMetrics('test', backtest.test);
  }

  const aggregate = {
    dev: summarizeOutcomes(devOutcomes, config),
    test: summarizeOutcomes(testOutcomes, config),
  };

  console.log('');
  console.log('AGGREGATE');
  printMetrics('dev', aggregate.dev);
  printMetrics('test', aggregate.test);

  const dataAvailable = Object.keys(reportTimeframes).length > 0;
  const report = {
    generatedAt: new Date().toISOString(),
    symbol,
    endpoint: endpoint || 'default-local-router',
    requestedTimeframes: timeframes,
    dataAvailable,
    allowNonXmSource,
    sources: [...sources],
    disclaimer: allowNonXmSource
      ? 'NON-XM LAB: mechanics validation only. Do not claim XM accuracy from this run.'
      : 'XM MT5 bridge data only. Metrics are descriptive, not a guarantee of future accuracy.',
    config,
    timeframes: reportTimeframes,
    failures,
    aggregate,
    notes: [
      'Dev and test segments are split chronologically to reduce overfitting.',
      'Precision here means reacted zones / total evaluable zones, not trade win rate.',
      'Reaction is measured with the configured ATR threshold after the first touch.',
      'No BUY/SELL signal and no order execution are produced by this engine.',
    ],
  };

  const reportsDir = path.join(ROOT, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(reportsDir, `supply-demand-backtest-${stamp}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('');
  console.log(`report=${outputPath}`);
  if (!dataAvailable) {
    console.log('DATA UNAVAILABLE: tidak ada OHLC yang lolos validasi. Tidak ada klaim metrik.');
    process.exitCode = 1;
  } else if (allowNonXmSource) {
    console.log('WARNING: run ini memakai NON-XM LAB data; jangan klaim akurasi XM dari hasil ini.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
