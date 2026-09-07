/**
 * persistentMarket.mjs
 * SERVER-SIDE JIN PERSISTENT INTELLIGENCE adapter for market charts.
 *
 * Drives the real Binance multi-host fallback through the Persistent
 * Intelligence Engine so every failure is DIAGNOSED, the NEXT path is chosen
 * by that diagnosis, and the final delivery is honest — never fabricated.
 *
 * Resilience levels actually exercised by this adapter:
 *   L1 Primary host      (data-api.binance.vision)
 *   L2 Official alt host (api.binance.com)
 *   L3 Official alt host (api1.binance.com)
 *   L4 Documented alternative → OPEN SOURCE link (when native chart unavailable)
 *   L8 Report exhausted (honest EXHAUSTED report, no fake chart)
 *
 * The engine's GEOD restriction branch also triggers an on-demand, temporary
 * alternate-network retry IF a network fallback is configured.
 */
import { createPersistentEngine, deriveHonestState, FAILURE_TYPES } from '../../src/services/engineering/sourceResilienceEngine.js';
import { findAssetByPanel } from './MarketDataService.mjs';
import { BINANCE_KLINES_HOSTS, binanceSymbolForPanel, intervalToBinance, fetchBinanceKlinesFromHost } from './MarketChartService.mjs';

const FRESH_MS = 60 * 60 * 1000; // honest LIVE threshold vs last candle close (15 min used server-side)

/**
 * Main entry: resilient chart retrieval with a full, transparent search report.
 * @returns { ok, report, chart }
 *   chart only set when a real validated provider returned data.
 */
export async function getResilientMarketChart({ panelId, interval = '1h', limit = 300, networkProfiles }) {
  const asset = findAssetByPanel(panelId);
  if (!asset) {
    return {
      ok: false,
      report: {
        target: `chart untuk ${panelId}`,
        complete: false,
        exhausted: true,
        report: {
          whatWasFound: 'tidak ada instrumen dikenali',
          whatWasNotFound: `panel '${panelId}' tidak ditemukan`,
          sourcesAttempted: [],
          whyStopped: 'instrumen tidak dikenal — tidak ada jalur yang relevan',
          nextAction: 'periksa kembali panel yang dimaksud'
        },
        steps: []
      },
      chart: null
    };
  }

  const binanceSymbol = binanceSymbolForPanel(asset);
  const intervalReal = intervalToBinance(interval);

  const engine = createPersistentEngine({ label: `${asset.symbol} chart`, networkProfiles });

  const accessors = [];
  if (binanceSymbol) {
    for (const host of BINANCE_KLINES_HOSTS) {
      accessors.push({
        id: `binance:${host}`,
        name: `Binance ${host.replace('https://', '')}`,
        run: async () => fetchBinanceKlinesFromHost(host, binanceSymbol, intervalReal, limit)
      });
    }
  }

  const report = await engine.search({
    target: `chart ${asset.symbol || panelId} (${intervalReal}) dari sumber nyata`,
    expectedCount: null,
    accessors,
    validate: (data) => Array.isArray(data) && data.length > 0,
    extract: (candles) => {
      const last = candles[candles.length - 1];
      const ageSec = (Date.now() - last.closeTime) / 1000;
      const live = ageSec <= 900;
      // STRICT PROTOCOL RULE (XII): LIVE requires an ACTIVE live stream. Binance
      // REST klines are near-real-time but NOT a persistent stream, so the honest
      // label is SNAPSHOT (real data, freshest available), never a fabricated LIVE.
      const state = deriveHonestState({
        liveStreamActive: false,
        freshnessMs: FRESH_MS,
        lastUpdate: last.closeTime,
        dataSource: 'SNAPSHOT'
      });
      return {
        payload: {
          ok: true,
          instrument: { panelId, symbol: asset.symbol, name: asset.name, category: asset.category },
          provider: { id: 'binance', name: 'Binance' },
          chartMode: 'JIN_RENDERED',
          symbol: binanceSymbol,
          interval,
          source: 'Binance Spot Public API (/api/v3/klines)',
          live,
          dataState: state,
          lastUpdate: Date.now(),
          candles
        },
        count: candles.length,
        summaryOfFound: () => `${candles.length} candlestick nyata (${binanceSymbol})`
      };
    },
    summaryOfMissing: `chart candlestick nyata belum tersedia untuk ${asset.symbol} dari provider yang didukung`,
    suggestNext: `Buka OPEN SOURCE untuk ${asset.symbol}, atau coba instrumen crypto lain yang didukung Binance`
  });

  const chart = report.found || null;

  return { ok: report.complete, report, chart };
}

export default { getResilientMarketChart };
