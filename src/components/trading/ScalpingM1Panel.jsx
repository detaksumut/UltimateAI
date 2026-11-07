/**
 * ScalpingM1Panel.jsx
 * JIN SCALPING - M1 panel for Trading Studio.
 *
 * Scope: display-only M1 context, validated XM metrics, S&D context, and
 * PREVIEW-ONLY levels. No BUY/SELL signal, no strategy change, no auto-order.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SD_SIDE } from '../../services/trading/supplyDemand/constants.js';
import { fetchXmOhlcMulti } from '../../services/trading/supplyDemand/xmOhlcClient.js';
import {
  SCALPING_M1_TIMEFRAMES,
  buildScalpingM1Analysis,
} from '../../services/trading/scalping/scalpingM1.js';
import { buildPreviewLevels } from '../../services/trading/scalping/previewLevels.js';
import SupplyDemandOverlayChart from '../broker-workspace/SupplyDemandOverlayChart.jsx';

const ui = {
  card: {
    border: '1px solid rgba(0,229,255,0.2)',
    borderRadius: 8,
    background: '#050b16',
    padding: 9,
  },
  section: {
    border: '1px solid rgba(0,229,255,0.14)',
    borderRadius: 7,
    background: 'rgba(7,18,36,0.72)',
    padding: 8,
  },
  label: {
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: '0.08em',
    color: 'rgba(148,163,184,0.78)',
  },
  small: {
    fontSize: 8.5,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  btn: {
    border: '1px solid rgba(0,229,255,0.3)',
    borderRadius: 5,
    background: 'rgba(0,229,255,0.07)',
    color: '#67e8f9',
    fontSize: 8.5,
    fontWeight: 900,
    padding: '4px 7px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};

const LIFECYCLE_COLOR = {
  FRESH: '#38bdf8',
  TESTED: '#34d399',
  WEAKENED: '#fbbf24',
  INVALID: '#fb7185',
};

function fmtPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return Math.abs(num) >= 100 ? num.toFixed(2) : num.toFixed(4);
}

function fmtPct(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${Math.round(num * 100)}%`;
}

function sideColor(side) {
  return side === SD_SIDE.SUPPLY ? '#fb7185' : '#34d399';
}

function trendColor(trend) {
  if (trend === 'BULLISH') return '#34d399';
  if (trend === 'BEARISH') return '#fb7185';
  return '#94a3b8';
}

function conditionColor(condition) {
  if (condition === 'TRENDING') return '#67e8f9';
  if (condition === 'RANGING') return '#fbbf24';
  return '#94a3b8';
}

function syncColor(sync) {
  if (sync === 'ALIGNED') return '#34d399';
  if (sync === 'CONFLICT') return '#fb7185';
  return '#94a3b8';
}

function setupColor(code) {
  if (code === 'PREVIEW_ONLY') return '#67e8f9';
  if (code === 'SPREAD_WIDE') return '#fbbf24';
  if (code === 'HTF_CONFLICT') return '#fb7185';
  if (code === 'WAITING_FOR_ZONE') return '#94a3b8';
  return '#fb7185';
}

function Pill({ children, color = '#94a3b8' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: 999,
        border: `1px solid ${color}55`,
        background: `${color}16`,
        color,
        fontSize: 7.5,
        fontWeight: 900,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Metric({ label, value, sub, color = '#e2e8f0' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={ui.label}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ ...ui.small, fontSize: 7.5, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, source, children, accent = '#00e5ff' }) {
  return (
    <div style={ui.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ ...ui.label, color: accent }}>{title}</div>
        <span style={{ flex: 1 }} />
      </div>
      {children}
      {source && (
        <div style={{ ...ui.small, fontSize: 7, color: '#475569', marginTop: 6 }}>
          Sumber: {source}
        </div>
      )}
    </div>
  );
}

function ZoneLine({ zone }) {
  if (!zone) return <div style={{ ...ui.small, fontSize: 8, color: '#64748b' }}>Tidak ada zona aktif.</div>;
  return (
    <div style={{ border: `1px solid ${sideColor(zone.side)}33`, background: `${sideColor(zone.side)}0d`, borderRadius: 5, padding: '5px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: sideColor(zone.side) }}>{zone.timeframe} {zone.side}</span>
        <Pill color={LIFECYCLE_COLOR[zone.lifecycle] || '#94a3b8'}>{zone.lifecycle}</Pill>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontWeight: 900, color: '#e2e8f0' }}>{zone.score}</span>
      </div>
      <div style={{ ...ui.small, fontSize: 8, marginTop: 2 }}>
        {fmtPrice(zone.proximal)} / {fmtPrice(zone.distal)} · retest {zone.testCount || 0}x
      </div>
    </div>
  );
}

function ScenarioCard({ title, scenario }) {
  if (!scenario?.available) {
    return (
      <div style={{ border: '1px solid rgba(148,163,184,0.16)', borderRadius: 6, padding: 7, background: 'rgba(2,6,23,0.55)' }}>
        <div style={ui.label}>{title}</div>
        <div style={{ ...ui.small, fontSize: 8, color: '#64748b', marginTop: 4 }}>
          {scenario?.status || 'DATA UNAVAILABLE'}
        </div>
        {(scenario?.warnings || []).slice(0, 2).map((warning) => (
          <div key={warning} style={{ ...ui.small, fontSize: 7.5, color: '#64748b', marginTop: 2 }}>{warning}</div>
        ))}
      </div>
    );
  }

  const rrColor = scenario.riskReward >= 2 ? '#34d399' : scenario.riskReward >= 1.5 ? '#fbbf24' : '#fb7185';

  return (
    <div style={{ border: `1px solid ${sideColor(scenario.side)}33`, borderRadius: 6, padding: 7, background: `${sideColor(scenario.side)}0a` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <div style={{ ...ui.label, color: sideColor(scenario.side) }}>{title}</div>
        <span style={{ flex: 1 }} />
        <Pill color="#67e8f9">PREVIEW</Pill>
      </div>
      <div style={{ ...ui.mono, fontSize: 9, marginTop: 5, display: 'grid', gap: 2 }}>
        <div style={{ display: 'flex' }}><span style={{ color: '#94a3b8', width: 42 }}>ENTRY</span><span style={{ color: '#e2e8f0' }}>{fmtPrice(scenario.entry)}</span></div>
        <div style={{ display: 'flex' }}><span style={{ color: '#94a3b8', width: 42 }}>SL</span><span style={{ color: '#fb7185' }}>{fmtPrice(scenario.stopLoss)}</span></div>
        <div style={{ display: 'flex' }}><span style={{ color: '#94a3b8', width: 42 }}>TP</span><span style={{ color: '#34d399' }}>{fmtPrice(scenario.takeProfit)}</span></div>
        <div style={{ display: 'flex' }}><span style={{ color: '#94a3b8', width: 42 }}>RR</span><span style={{ color: rrColor, fontWeight: 900 }}>{Number.isFinite(scenario.riskReward) ? scenario.riskReward.toFixed(2) : '—'}</span></div>
      </div>
      <div style={{ ...ui.small, fontSize: 7.5, marginTop: 4 }}>
        {scenario.timeframe} {scenario.side} · score {scenario.zoneScore} · {scenario.zoneLifecycle}
      </div>
      <div style={{ ...ui.small, fontSize: 7.5, color: '#64748b' }}>
        TP source: {scenario.targetSource}
      </div>
      {(scenario.warnings || []).filter((warning) => !warning.startsWith('PREVIEW ONLY')).slice(0, 2).map((warning) => (
        <div key={warning} style={{ ...ui.small, fontSize: 7.5, color: '#fbbf24', marginTop: 2 }}>{warning}</div>
      ))}
    </div>
  );
}

export default function ScalpingM1Panel({
  symbol = 'XAUUSD',
  pollMs = 15_000,
  enabled = true,
  showPreview = true,
  onPreviewChange,
}) {
  const [state, setState] = useState({ analysis: null, failures: {}, payloads: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);
  const abortRef = useRef(null);

  const runAnalysis = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchXmOhlcMulti({
        symbol,
        timeframes: SCALPING_M1_TIMEFRAMES,
        limit: 500,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const analysis = buildScalpingM1Analysis({
        symbol,
        payloads: data.payloads,
        now: Date.now(),
      });
      setState({ analysis, failures: data.failures || {}, payloads: data.payloads || {} });
      setLastRunAt(new Date());
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err?.message || 'Gagal membaca OHLC XM.');
      setState({ analysis: null, failures: {}, payloads: {} });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (!enabled) return undefined;
    runAnalysis();
    return () => abortRef.current?.abort();
  }, [enabled, runAnalysis]);

  useEffect(() => {
    if (!enabled || pollMs <= 0) return undefined;
    const timer = setInterval(() => runAnalysis(), pollMs);
    return () => clearInterval(timer);
  }, [enabled, pollMs, runAnalysis]);

  const analysis = state.analysis;
  const failures = state.failures || {};
  const payloads = state.payloads || {};
  const dataAvailable = analysis?.ok === true;
  const failureEntries = Object.entries(failures);
  const chartCandles = useMemo(() => payloads?.M1?.candles || [], [payloads]);
  const chartZones = useMemo(() => analysis?.supplyDemand?.activeZones || [], [analysis]);
  const previewLevels = useMemo(() => buildPreviewLevels(analysis?.scenarios), [analysis]);

  const previewSnapshot = useMemo(() => ({
    available: dataAvailable,
    symbol,
    candles: chartCandles,
    zones: chartZones,
    levels: previewLevels,
    source: analysis?.scenarios?.dataSource || analysis?.dataSource || '',
    dataStatus: analysis?.dataStatus || '',
    updatedAt: lastRunAt ? lastRunAt.getTime() : null,
  }), [
    dataAvailable,
    symbol,
    chartCandles,
    chartZones,
    previewLevels,
    analysis?.scenarios?.dataSource,
    analysis?.dataSource,
    analysis?.dataStatus,
    lastRunAt,
  ]);

  useEffect(() => {
    if (typeof onPreviewChange === 'function') onPreviewChange(previewSnapshot);
  }, [onPreviewChange, previewSnapshot]);

  return (
    <section
      aria-label="JIN Scalping M1"
      style={{ ...ui.card, display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#67e8f9', letterSpacing: '0.06em' }}>
            JIN SCALPING – M1
          </div>
          <div style={{ ...ui.small, fontSize: 8, marginTop: 2 }}>
            Khusus M1 · preview level · bukan sinyal · eksekusi manual
          </div>
        </div>
        <button type="button" onClick={runAnalysis} disabled={loading} style={{ ...ui.btn, opacity: loading ? 0.5 : 1 }}>
          {loading ? 'MEMUAT.' : 'REFRESH'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <Pill color={dataAvailable && analysis?.isXmValidated ? '#34d399' : '#fb7185'}>
          {dataAvailable && analysis?.isXmValidated ? 'XM MT5 BRIDGE' : 'DATA UNAVAILABLE'}
        </Pill>
        <Pill color={dataAvailable ? '#67e8f9' : '#fb7185'}>
          {analysis?.dataStatus || (loading ? 'MEMUAT' : 'NO DATA')}
        </Pill>
        {lastRunAt && <Pill color="#64748b">{lastRunAt.toLocaleTimeString()}</Pill>}
      </div>

      {error && (
        <div style={{ ...ui.small, fontSize: 8, color: '#fda4af' }}>{error}</div>
      )}

      {!dataAvailable && (
        <div
          style={{
            border: '1px solid rgba(251,113,133,0.4)',
            borderRadius: 6,
            background: 'rgba(80,7,20,0.32)',
            padding: '7px 8px',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: '#fb7185' }}>
            DATA UNAVAILABLE - TIDAK ADA SETUP DIBUAT
          </div>
          <div style={{ ...ui.small, fontSize: 8, color: '#fecdd3', marginTop: 3 }}>
            {analysis?.message || 'OHLC M1 XM tervalidasi belum tersedia.'}
          </div>
          {failureEntries.length > 0 && (
            <div style={{ ...ui.small, fontSize: 7.5, color: '#94a3b8', marginTop: 4 }}>
              {failureEntries.map(([timeframe, failure]) => (
                <div key={timeframe}>{timeframe}: {failure?.code || 'FETCH_FAILED'} - {failure?.message || 'tidak tersedia'}</div>
              ))}
            </div>
          )}
          <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 5 }}>
            Jalankan XM MT5 + EA <strong>JIN_OHLC_Bridge</strong> agar endpoint
            {' '}<code>/api/trading/ohlc</code> mengembalikan source <strong>MT5_LOCAL_BRIDGE</strong>.
          </div>
        </div>
      )}

      {dataAvailable && (
        <>
          <Section title="TREND & KONDISI M1" source={analysis.trend?.dataSource}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
              <Metric
                label="TREND"
                value={analysis.trend?.available ? analysis.trend.trend : 'DATA UNAVAILABLE'}
                color={trendColor(analysis.trend?.trend)}
                sub={analysis.trend?.available ? `EMA ${analysis.trend.emaFast?.toFixed(2)} / ${analysis.trend.emaSlow?.toFixed(2)}` : 'Candle M1 belum cukup'}
              />
              <Metric
                label="KONDISI PASAR"
                value={analysis.trend?.available ? analysis.trend.condition : 'DATA UNAVAILABLE'}
                color={conditionColor(analysis.trend?.condition)}
                sub={analysis.trend?.available && Number.isFinite(analysis.trend.adx) ? `ADX ${analysis.trend.adx.toFixed(1)}` : 'ADX belum tersedia'}
              />
              <Metric
                label="SLOPE EMA"
                value={analysis.trend?.available ? `${analysis.trend.emaSlopeAtr.toFixed(2)} ATR` : '—'}
                sub="EMA 9 vs EMA 21"
              />
              <Metric
                label="EFFICIENCY"
                value={analysis.trend?.available && Number.isFinite(analysis.trend.efficiencyRatio) ? analysis.trend.efficiencyRatio.toFixed(2) : '—'}
                sub="Kaufman efficiency ratio(20)"
              />
            </div>
          </Section>

          <Section title="SPREAD & VOLATILITAS" source={analysis.volatility?.dataSource || analysis.spread?.dataSource}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
              <Metric
                label="SPREAD"
                value={analysis.spread?.available ? fmtPrice(analysis.spread.spread) : 'DATA UNAVAILABLE'}
                color={analysis.spread?.status === 'WIDE' ? '#fbbf24' : analysis.spread?.available ? '#34d399' : '#fb7185'}
                sub={analysis.spread?.available
                  ? `${fmtPct(analysis.spread.spreadPctOfAtr)} ATR · ${analysis.spread.status}`
                  : analysis.spread?.reason || 'Tick XM belum tersedia'}
              />
              <Metric
                label="VOLATILITAS"
                value={analysis.volatility?.available ? analysis.volatility.level : 'DATA UNAVAILABLE'}
                color={analysis.volatility?.level === 'HIGH' ? '#fbbf24' : analysis.volatility?.level === 'LOW' ? '#38bdf8' : '#34d399'}
                sub={analysis.volatility?.available ? `ATR ${fmtPrice(analysis.volatility.atr)} · P${fmtPct(analysis.volatility.percentile)}` : 'ATR M1 belum cukup'}
              />
              <Metric
                label="BID / ASK"
                value={analysis.spread?.available ? `${fmtPrice(analysis.spread.bid)} / ${fmtPrice(analysis.spread.ask)}` : '—'}
                sub="Tick XM bridge"
              />
              <Metric
                label="ATR M1"
                value={analysis.volatility?.available ? fmtPrice(analysis.volatility.atr) : '—'}
                sub={analysis.volatility?.available ? `rata-rata ${fmtPrice(analysis.volatility.average)}` : '—'}
              />
            </div>
          </Section>

          <Section title="SUPPLY & DEMAND M1" source={analysis.supplyDemand?.dataSource}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
              <div>
                <div style={ui.label}>NEAREST DEMAND</div>
                <ZoneLine zone={analysis.supplyDemand?.nearestDemand} />
              </div>
              <div>
                <div style={ui.label}>NEAREST SUPPLY</div>
                <ZoneLine zone={analysis.supplyDemand?.nearestSupply} />
              </div>
            </div>
            <div style={{ ...ui.small, fontSize: 8, marginTop: 6 }}>
              Strongest M1: {analysis.supplyDemand?.strongest
                ? `${analysis.supplyDemand.strongest.side} ${analysis.supplyDemand.strongest.score} · ${analysis.supplyDemand.strongest.lifecycle}`
                : '—'}
            </div>
            <div style={{ ...ui.small, fontSize: 8, marginTop: 2 }}>
              Lifecycle: FRESH {analysis.supplyDemand?.lifecycleCounts?.FRESH || 0} · TESTED {analysis.supplyDemand?.lifecycleCounts?.TESTED || 0} · WEAKENED {analysis.supplyDemand?.lifecycleCounts?.WEAKENED || 0} · INVALID {analysis.supplyDemand?.lifecycleCounts?.INVALID || 0}
            </div>
            <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
              {(analysis.supplyDemand?.activeZones || []).slice(0, 6).map((zone) => (
                <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: sideColor(zone.side) }}>{zone.timeframe} {zone.side}</span>
                  <Pill color={LIFECYCLE_COLOR[zone.lifecycle] || '#94a3b8'}>{zone.lifecycle}</Pill>
                  <span style={{ ...ui.small, fontSize: 8 }}>{fmtPrice(zone.proximal)} / {fmtPrice(zone.distal)}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0' }}>{zone.score}</span>
                </div>
              ))}
              {(analysis.supplyDemand?.activeZones || []).length === 0 && (
                <div style={{ ...ui.small, fontSize: 8, color: '#64748b' }}>Tidak ada zona M1 aktif.</div>
              )}
            </div>
          </Section>

          {showPreview && (
            <Section title="PREVIEW LEVEL DI CHART M1" source={analysis.scenarios?.dataSource}>
              <SupplyDemandOverlayChart
                candles={chartCandles}
                zones={chartZones}
                levels={previewLevels}
                timeframe="M1"
                height={180}
              />
              {previewLevels.length > 0 && (
                <div style={{ display: 'grid', gap: 2, marginTop: 5 }}>
                  {previewLevels.map((level) => (
                    <div
                      key={`${level.label}-${level.price}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 7.5 }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: level.color, flexShrink: 0 }} />
                      <span style={{ color: '#94a3b8' }}>{level.label}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ ...ui.mono, color: '#e2e8f0' }}>{fmtPrice(level.price)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 5, lineHeight: 1.45 }}>
                ENTRY solid, SL dashed, TP dotted. Level ini preview dari zona M1 XM, bukan order.
                Chart JIN memakai OHLC XM tervalidasi; chart native XM tidak diinjeksi.
              </div>
            </Section>
          )}

          <Section title="KONTEKS HIGHER TIMEFRAME" source={analysis.context?.dataSource}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={ui.label}>SYNC M1</span>
              <Pill color={syncColor(analysis.context?.sync)}>{analysis.context?.sync || 'NO_HTF_CONTEXT'}</Pill>
              <span style={{ ...ui.small, fontSize: 7.5 }}>
                {analysis.context?.aligned?.length || 0} aligned · {analysis.context?.conflicting?.length || 0} conflict
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
              {(analysis.context?.zones || []).map((contextZone) => (
                <div key={`${contextZone.timeframe}-${contextZone.id}`} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: sideColor(contextZone.side) }}>{contextZone.timeframe} {contextZone.side}</span>
                  <span style={{ ...ui.small, fontSize: 8 }}>{fmtPrice(contextZone.proximal)} / {fmtPrice(contextZone.distal)}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ ...ui.small, fontSize: 7.5 }}>{contextZone.relation} · {Number.isFinite(contextZone.distanceAtr) ? `${contextZone.distanceAtr.toFixed(2)} ATR` : '—'}</span>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0' }}>{contextZone.score}</span>
                </div>
              ))}
              {(analysis.context?.zones || []).length === 0 && (
                <div style={{ ...ui.small, fontSize: 8, color: '#64748b' }}>Tidak ada zona higher timeframe dekat harga.</div>
              )}
            </div>
            <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 5 }}>
              Identitas TF dipertahankan; zona tidak digabung menjadi satu box anonim.
            </div>
          </Section>

          <Section title="ZONA ENTRY POTENSIAL · SL / TP / RR" source={analysis.scenarios?.dataSource}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
              <ScenarioCard title="DEMAND SCENARIO" scenario={analysis.scenarios?.demand} />
              <ScenarioCard title="SUPPLY SCENARIO" scenario={analysis.scenarios?.supply} />
            </div>
            <div style={{ ...ui.small, fontSize: 8, color: '#fbbf24', marginTop: 6 }}>
              PREVIEW ONLY - level ini bukan sinyal BUY/SELL. Tidak ada auto-order.
            </div>
          </Section>

          <Section title="STATUS SETUP" source={analysis.setupStatus?.dataSource}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Pill color={setupColor(analysis.setupStatus?.code)}>{analysis.setupStatus?.code || 'DATA UNAVAILABLE'}</Pill>
              <span style={{ ...ui.small, fontSize: 7.5 }}>min RR {analysis.setupStatus?.minimumRR}</span>
            </div>
            <div style={{ ...ui.small, fontSize: 8, color: '#cbd5e1', marginTop: 5 }}>
              {analysis.setupStatus?.message}
            </div>
            <div style={{ ...ui.small, fontSize: 7.5, color: '#64748b', marginTop: 4 }}>
              Flags: {(analysis.setupStatus?.flags || []).join(' · ')}
            </div>
            <div style={{ ...ui.small, fontSize: 8, color: '#fda4af', marginTop: 4 }}>
              Signal allowed: TIDAK · Auto-order: TIDAK · Strategy approved: TIDAK
            </div>
          </Section>

          <details style={{ ...ui.section, padding: 8 }}>
            <summary style={{ ...ui.label, cursor: 'pointer' }}>SUMBER DATA PER METRIK</summary>
            <div style={{ display: 'grid', gap: 3, marginTop: 6 }}>
              {Object.entries(analysis.dataSources || {}).map(([key, value]) => (
                <div key={key} style={{ ...ui.small, fontSize: 7.5 }}>
                  <strong style={{ color: '#cbd5e1' }}>{key}</strong>: {value}
                </div>
              ))}
            </div>
          </details>

          <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', lineHeight: 1.55 }}>
            <strong style={{ color: '#64748b' }}>Batas:</strong> panel ini tidak menghasilkan sinyal BUY/SELL,
            tidak mengubah strategi, dan tidak mengirim order. Entry/SL/TP/RR adalah preview turunan zona M1;
            aturan strategi scalping belum disetujui. Sumber live hanya diakui jika OHLC berasal dari
            MT5_LOCAL_BRIDGE dan tervalidasi. Screenshot tidak pernah diubah menjadi OHLC.
          </div>
        </>
      )}
    </section>
  );
}
