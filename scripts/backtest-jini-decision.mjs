#!/usr/bin/env node
/**
 * backtest-jini-decision.mjs
 * Tahap 5 runner — historical replay + directional backtest + calibration.
 *
 * Reads a local JSON file (no network):
 *   {
 *     "records": [{ "asOf": "...", "snapshot": {...} } | { "asOf": "...", "panels": {...} }],
 *     "forwardCandles": [{ "timestamp": "...", "close": 4000, "high": 4005, "low": 3995, "source": "MT5_LOCAL_BRIDGE" }],
 *     "config": { "replay": {}, "backtest": {}, "calibration": {} }
 *   }
 *
 * Policy: forward candles must be XM MT5 bridge data unless --allow-non-xm is
 * passed (NON-XM LAB, mechanics only). No orders are produced.
 *
 * Usage:
 *   node scripts/backtest-jini-decision.mjs --input reports/history.json
 *   node scripts/backtest-jini-decision.mjs --input history.json --allow-non-xm
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayJiniHistory } from '../src/services/trading/decision/historicalReplay.js';
import { runDirectionalBacktest } from '../src/services/trading/decision/backtest.js';
import { runCalibration } from '../src/services/trading/decision/calibration.js';

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || args.input === true) {
    console.error('Usage: node scripts/backtest-jini-decision.mjs --input <history.json> [--allow-non-xm] [--out <file>]');
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(ROOT, String(args.input));
  const raw = JSON.parse(await readFile(inputPath, 'utf8'));
  const records = Array.isArray(raw.records) ? raw.records : [];
  const forwardCandles = Array.isArray(raw.forwardCandles) ? raw.forwardCandles : [];
  const config = raw.config && typeof raw.config === 'object' ? raw.config : {};
  const allowNonXm = args['allow-non-xm'] === true;

  console.log('========================================================================');
  console.log('JINI DECISION — HISTORICAL REPLAY / BACKTEST / CALIBRATION');
  console.log('========================================================================');
  console.log(`input=${inputPath}`);
  console.log(`records=${records.length} forwardCandles=${forwardCandles.length}`);
  console.log(`policy=${allowNonXm ? 'NON-XM LAB (mechanics only)' : 'XM MT5 bridge only'}`);
  console.log('');

  if (records.length === 0) {
    console.log('DATA UNAVAILABLE: tidak ada record replay. Tidak ada klaim metrik.');
    process.exitCode = 1;
    return;
  }

  const replay = replayJiniHistory(records, config.replay || {});
  const backtest = runDirectionalBacktest({
    replay,
    forwardCandles,
    config: {
      ...(config.backtest || {}),
      allowNonXmSource: allowNonXm || config.backtest?.allowNonXmSource === true,
    },
  });
  const calibration = runCalibration({
    replay,
    backtest,
    config: config.calibration || {},
  });

  console.log(`replay: total=${replay.summary.total} evaluated=${replay.summary.evaluated} rejected=${replay.summary.rejected} lookahead=${replay.summary.lookaheadViolations}`);
  console.log(`decisions: ${JSON.stringify(replay.summary.decisionCounts)}`);
  if (backtest.ok) {
    const metrics = backtest.metrics;
    console.log(`backtest: directional=${metrics.directional} moved=${metrics.moved} hits=${metrics.hits} hitRate=${pct(metrics.hitRate)} flat=${metrics.flat} censored=${metrics.censored} abstain=${metrics.abstentions}`);
    console.log(`calibration: pairs=${calibration.sample.directionalPairs} hitRate=${pct(calibration.sample.hitRate)} weightsApplied=${calibration.flags.weightsApplied}`);
  } else {
    console.log(`backtest: ${backtest.code} — ${backtest.message}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    input: inputPath,
    dataLabel: backtest.ok ? backtest.dataLabel : 'DATA UNAVAILABLE',
    allowNonXm,
    replay,
    backtest,
    calibration,
    disclaimer: allowNonXm
      ? 'NON-XM LAB: mechanics validation only. Do not claim XM accuracy from this run.'
      : 'XM MT5 bridge data only. Metrics are descriptive, not a guarantee of future accuracy.',
  };

  const reportsDir = path.join(ROOT, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const outputPath = args.out
    ? path.resolve(ROOT, String(args.out))
    : path.join(reportsDir, `jini-decision-backtest-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('');
  console.log(`report=${outputPath}`);
  if (!backtest.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
