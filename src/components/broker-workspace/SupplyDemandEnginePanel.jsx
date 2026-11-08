/**
 * SupplyDemandEnginePanel.jsx
 * JINI panel for Phase 1 Automatic Supply & Demand zones.
 *
 * Scope: display only. No BUY/SELL generator, no strategy change, no orders.
 * Data gate: only XM MT5 bridge OHLC is accepted for live zones.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SD_SIDE,
  SD_TIMEFRAMES,
} from '../../services/trading/supplyDemand/constants.js';
import { analyzeSupplyDemand } from '../../services/trading/supplyDemand/SupplyDemandEngine.js';
import {
  buildConfluenceClusters,
  pickNearestZone,
  pickStrongestZone,
} from '../../services/trading/supplyDemand/confluence.js';
import { fetchXmOhlcMulti } from '../../services/trading/supplyDemand/xmOhlcClient.js';
import SupplyDemandOverlayChart from './SupplyDemandOverlayChart.jsx';

const ui = {
  card: {
    border: '1px solid rgba(0,229,255,0.16)',
    borderRadius: 8,
    background: 'rgba(7,18,36,0.75)',
    padding: 9,
  },
  label: {
    fontSize: 8.5,
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: 'rgba(148,163,184,0.72)',
    marginBottom: 5,
  },
  small: {
    fontSize: 9.5,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  btn: {
    border: '1px solid rgba(0,229,255,0.3)',
    borderRadius: 5,
    background: 'rgba(0,229,255,0.07)',
    color: '#67e8f9',
    fontSize: 9,
    fontWeight: 800,
    padding: '4px 6px',
    cursor: 'pointer',
  },
  btnActive: {
    border: '1px solid #00e5ff',
    background: 'rgba(0,229,255,0.18)',
    color: '#e0f7ff',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    borderRadius: 999,
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: '0.04em',
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

function sideBg(side) {
  return side === SD_SIDE.SUPPLY ? 'rgba(242,54,69,0.12)' : 'rgba(8,153,129,0.12)';
}

function LifecyclePill({ lifecycle }) {
  const color = LIFECYCLE_COLOR[lifecycle] || '#94a3b8';
  return (
    <span style={{ ...ui.pill, color, background: `${color}18`, border: `1px solid ${color}55` }}>
      {lifecycle}
    </span>
  );
}

function ScoreBar({ factor }) {
  const pct = Math.max(0, Math.min(100, (factor.points / factor.weight) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
      <div style={{ width: 92, fontSize: 8, color: '#94a3b8', flexShrink: 0 }}>{factor.label}</div>
      <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(148,163,184,0.14)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 60 ? '#34d399' : pct >= 30 ? '#fbbf24' : '#64748b' }} />
      </div>
      <div style={{ width: 34, textAlign: 'right', fontSize: 8, color: '#cbd5e1' }}>
        {factor.points.toFixed(1)}/{factor.weight}
      </div>
    </div>
  );
}

function ZoneRow({ zone, expanded, onToggle }) {
  const color = sideColor(zone.side);
  return (
    <div
      style={{
        border: `1px solid ${color}33`,
        borderRadius: 6,
        background: sideBg(zone.side),
        padding: '6px 7px',
        marginBottom: 5,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onToggle(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: 8.5, fontWeight: 900, color }}>{zone.timeframe}</span>
        <span style={{ fontSize: 8.5, fontWeight: 900, color }}>{zone.side}</span>
        <LifecyclePill lifecycle={zone.lifecycle} />
        <span style={{ fontSize: 8.5, color: '#cbd5e1' }}>
          {fmtPrice(zone.proximal)} / {fmtPrice(zone.distal)}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontWeight: 900, color: zone.score >= 70 ? '#6ee7b7' : zone.score >= 50 ? '#fbbf24' : '#94a3b8' }}>
          {zone.score}
        </span>
      </div>
      <div style={{ ...ui.small, fontSize: 8.5, marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>width {zone.widthAtr.toFixed(2)} ATR</span>
        <span>retest {zone.testCount}x ({zone.heldRetestCount || 0} tertahan)</span>
        {zone.testCount > 0 && zone.firstTestTime && (
          <span>first {new Date(zone.firstTestTime).toLocaleTimeString()}</span>
        )}
        <span>BOS {zone.bos ? 'YA' : 'TIDAK'}</span>
        {Number.isFinite(zone.distance) && (
          <span>jarak {fmtPrice(zone.distance)} ({Number.isFinite(zone.distanceAtr) ? `${zone.distanceAtr.toFixed(2)} ATR` : '—'})</span>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: 6, borderTop: '1px solid rgba(148,163,184,0.14)', paddingTop: 6 }}>
          <div style={{ ...ui.label, marginBottom: 4 }}>SCORE BREAKDOWN</div>
          {(zone.scoreBreakdown || []).map((factor) => (
            <ScoreBar key={factor.key} factor={factor} />
          ))}
          <div style={{ ...ui.small, fontSize: 8.5, marginTop: 5, color: '#cbd5e1' }}>
            {zone.reasons.map((reason) => (
              <div key={reason}>• {reason}</div>
            ))}
          </div>
          <div style={{ ...ui.small, fontSize: 8, marginTop: 4, color: '#64748b' }}>
            origin {new Date(zone.originTime).toLocaleString()} • departure {new Date(zone.departureTime).toLocaleString()}
            {zone.invalidatedAt ? ` • invalid ${new Date(zone.invalidatedAt).toLocaleString()}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

function NearestCard({ title, zone, emptyText }) {
  return (
    <div style={{ ...ui.card, flex: 1, minWidth: 0 }}>
      <div style={ui.label}>{title}</div>
      {!zone ? (
        <div style={{ ...ui.small, fontSize: 9, color: '#64748b' }}>{emptyText}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: sideColor(zone.side) }}>{zone.timeframe} {zone.side}</span>
            <LifecyclePill lifecycle={zone.lifecycle} />
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 900, color: '#e2e8f0' }}>{zone.score}</span>
          </div>
          <div style={{ ...ui.small, fontSize: 9, marginTop: 4 }}>
            Proximal {fmtPrice(zone.proximal)} • Distal {fmtPrice(zone.distal)}
          </div>
          <div style={{ ...ui.small, fontSize: 9, color: '#cbd5e1' }}>
            Jarak {fmtPrice(zone.distance)} {Number.isFinite(zone.distanceAtr) ? `(${zone.distanceAtr.toFixed(2)} ATR)` : ''}
            {' '}• posisi {zone.position}
          </div>
        </>
      )}
    </div>
  );
}

function StrongestCard({ zone }) {
  if (!zone) {
    return (
      <div style={ui.card}>
        <div style={ui.label}>STRONGEST TESTED ZONE</div>
        <div style={{ ...ui.small, fontSize: 9, color: '#64748b' }}>Belum ada zona TESTED.</div>
      </div>
    );
  }
  return (
    <div style={{ ...ui.card, borderColor: `${sideColor(zone.side)}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={ui.label}>STRONGEST TESTED ZONE</div>
        <span style={{ flex: 1 }} />
        <LifecyclePill lifecycle={zone.lifecycle} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: sideColor(zone.side) }}>{zone.timeframe} {zone.side}</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: zone.score >= 70 ? '#6ee7b7' : '#fbbf24' }}>{zone.score}</span>
        <span style={{ fontSize: 8.5, color: '#64748b' }}>/100</span>
        <span style={{ flex: 1 }} />
        <span style={{ ...ui.small, fontSize: 9 }}>BOS {zone.bos ? 'YA' : 'TIDAK'}</span>
      </div>
      <div style={{ ...ui.small, fontSize: 9, marginTop: 3 }}>
        Proximal {fmtPrice(zone.proximal)} • Distal {fmtPrice(zone.distal)} • width {zone.widthAtr.toFixed(2)} ATR
      </div>
      <div style={{ marginTop: 6 }}>
        {(zone.scoreBreakdown || []).map((factor) => (
          <ScoreBar key={factor.key} factor={factor} />
        ))}
      </div>
      {zone.reasons?.length > 0 && (
        <div style={{ ...ui.small, fontSize: 8.5, marginTop: 5, color: '#cbd5e1' }}>
          {zone.reasons.slice(0, 3).map((reason) => <div key={reason}>• {reason}</div>)}
        </div>
      )}
    </div>
  );
}

function ConfluenceCard({ clusters, visibleTimeframes }) {
  const visible = clusters.filter((cluster) => (
    cluster.members.some((member) => visibleTimeframes[member.timeframe])
  ));
  return (
    <div style={ui.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={ui.label}>MULTI-TIMEFRAME CONFLUENCE</div>
        <span style={{ flex: 1 }} />
        <span style={{ ...ui.small, fontSize: 8.5, color: '#64748b' }}>
          {visible.filter((cluster) => cluster.isConfluence).length} cluster ≥2 TF
        </span>
      </div>
      {visible.length === 0 ? (
        <div style={{ ...ui.small, fontSize: 9, color: '#64748b' }}>
          Belum ada cluster zona aktif pada timeframe yang dipilih.
        </div>
      ) : (
        visible.slice(0, 6).map((cluster) => (
          <div
            key={cluster.id}
            style={{
              border: `1px solid ${sideColor(cluster.side)}33`,
              borderRadius: 6,
              background: sideBg(cluster.side),
              padding: '6px 7px',
              marginBottom: 5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8.5, fontWeight: 900, color: sideColor(cluster.side) }}>
                {cluster.side} {cluster.isConfluence ? `CONFLUENCE ${cluster.confluenceLevel} TF` : 'SINGLE TF'}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 900, color: '#e2e8f0' }}>{cluster.strength}</span>
            </div>
            <div style={{ ...ui.small, fontSize: 8.5, marginTop: 3 }}>
              {fmtPrice(cluster.low)} – {fmtPrice(cluster.high)} • proximal {fmtPrice(cluster.proximal)} • distal {fmtPrice(cluster.distal)}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {cluster.members.map((member) => (
                <span
                  key={member.id}
                  style={{
                    ...ui.pill,
                    color: visibleTimeframes[member.timeframe] ? sideColor(cluster.side) : '#64748b',
                    background: 'rgba(2,6,23,0.55)',
                    border: '1px solid rgba(148,163,184,0.2)',
                  }}
                  title={`${member.timeframe} score ${member.score} • ${member.lifecycle}`}
                >
                  {member.timeframe} {member.score}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function SupplyDemandEnginePanel({
  symbol = 'XAUUSD',
  pollMs = 20_000,
  enabled = true,
}) {
  const [state, setState] = useState({
    analysis: null,
    payloads: {},
    failures: {},
    endpoint: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);
  const [visibleTimeframes, setVisibleTimeframes] = useState(() => (
    Object.fromEntries(SD_TIMEFRAMES.map((tf) => [tf, true]))
  ));
  const [expandedZone, setExpandedZone] = useState(null);
  const [showMap, setShowMap] = useState(true);
  const [chartTimeframe, setChartTimeframe] = useState('M5');
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
        timeframes: SD_TIMEFRAMES,
        limit: 500,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const analysis = analyzeSupplyDemand({
        symbol,
        timeframes: SD_TIMEFRAMES,
        payloads: data.payloads,
        currentPrice: null,
        now: Date.now(),
      });

      setState({
        analysis,
        payloads: data.payloads,
        failures: data.failures,
        endpoint: data.endpoint,
      });
      setLastRunAt(new Date());

      const ready = analysis.readyTimeframes || [];
      if (ready.length > 0) {
        setChartTimeframe((previous) => (
          ready.includes(previous) ? previous : (ready.includes('M5') ? 'M5' : ready[0])
        ));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err?.message || 'Gagal memuat OHLC XM.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    runAnalysis();
    return () => abortRef.current?.abort();
  }, [runAnalysis]);

  useEffect(() => {
    if (!enabled || pollMs <= 0) return undefined;
    const timer = setInterval(() => runAnalysis(), pollMs);
    return () => clearInterval(timer);
  }, [enabled, pollMs, runAnalysis]);

  const analysis = state.analysis;
  const failures = state.failures || {};
  const activeZones = useMemo(() => (
    (analysis?.activeZones || []).filter((zone) => visibleTimeframes[zone.timeframe])
  ), [analysis, visibleTimeframes]);

  const testedZones = useMemo(() => (
    activeZones.filter((zone) => zone.lifecycle === 'TESTED').sort((a, b) => b.score - a.score)
  ), [activeZones]);

  const supplyZones = useMemo(() => (
    testedZones.filter((zone) => zone.side === SD_SIDE.SUPPLY)
  ), [testedZones]);
  const demandZones = useMemo(() => (
    testedZones.filter((zone) => zone.side === SD_SIDE.DEMAND)
  ), [testedZones]);

  const testedConfluence = useMemo(() => (
    analysis?.config
      ? buildConfluenceClusters(testedZones, analysis.config, analysis?.currentPrice)
      : []
  ), [testedZones, analysis?.config, analysis?.currentPrice]);

  const visibleClusters = useMemo(() => (
    testedConfluence.filter((cluster) => (
      cluster.members.some((member) => visibleTimeframes[member.timeframe])
    ))
  ), [testedConfluence, visibleTimeframes]);

  const testedStrongest = useMemo(() => pickStrongestZone(testedZones), [testedZones]);
  const testedNearestSupply = useMemo(() => (
    pickNearestZone(testedZones, SD_SIDE.SUPPLY, analysis?.currentPrice)
  ), [testedZones, analysis?.currentPrice]);
  const testedNearestDemand = useMemo(() => (
    pickNearestZone(testedZones, SD_SIDE.DEMAND, analysis?.currentPrice)
  ), [testedZones, analysis?.currentPrice]);

  const chartCandles = state.payloads?.[chartTimeframe]?.candles || [];
  const chartZones = useMemo(() => (
    testedZones.filter((zone) => (
      zone.timeframe === chartTimeframe && visibleTimeframes[chartTimeframe]
    ))
  ), [testedZones, chartTimeframe, visibleTimeframes]);

  const toggleTimeframe = (timeframe) => {
    setVisibleTimeframes((prev) => ({ ...prev, [timeframe]: !prev[timeframe] }));
  };

  const toggleZone = (zoneId) => {
    setExpandedZone((prev) => (prev === zoneId ? null : zoneId));
  };

  const dataAvailable = analysis?.dataAvailable === true;
  const nonXmFailure = Object.values(failures).some((failure) => failure?.code === 'NON_XM_SOURCE');
  const failureEntries = Object.entries(failures);

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        padding: '10px 10px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ ...ui.card, borderColor: 'rgba(0,229,255,0.32)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#67e8f9', letterSpacing: '0.06em' }}>
              AUTOMATIC SUPPLY &amp; DEMAND
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
              Phase 1 • {symbol} • deteksi zona, bukan sinyal
            </div>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            style={{ ...ui.btn, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'MEMUAT…' : 'REFRESH'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
          <span
            style={{
              ...ui.pill,
              color: dataAvailable ? '#6ee7b7' : '#fda4af',
              background: dataAvailable ? 'rgba(16,185,129,0.12)' : 'rgba(80,7,20,0.35)',
              border: `1px solid ${dataAvailable ? 'rgba(52,211,153,0.4)' : 'rgba(251,113,133,0.4)'}`,
            }}
          >
            {dataAvailable ? (analysis?.isXmValidated ? 'XM MT5 BRIDGE' : 'NON-XM (LAB)') : 'DATA UNAVAILABLE'}
          </span>
          <span style={{ ...ui.pill, color: '#94a3b8', background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.2)' }}>
            {analysis?.partial ? 'PARTIAL' : dataAvailable ? 'ALL TF READY' : 'NO ZONES'}
          </span>
          {lastRunAt && (
            <span style={{ ...ui.pill, color: '#64748b', background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.16)' }}>
              {lastRunAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {!dataAvailable && !loading && (
          <div
            style={{
              marginTop: 7,
              border: '1px solid rgba(251,113,133,0.4)',
              borderRadius: 6,
              background: 'rgba(80,7,20,0.32)',
              padding: '7px 8px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 900, color: '#fda4af', letterSpacing: '0.04em' }}>
              DATA UNAVAILABLE — TIDAK ADA ZONA DIBUAT
            </div>
            <div style={{ ...ui.small, fontSize: 9, color: '#fecdd3', marginTop: 3 }}>
              {analysis?.message || 'OHLC XM tidak tersedia.'}
            </div>
            {nonXmFailure && (
              <div style={{ ...ui.small, fontSize: 8.5, color: '#fbbf24', marginTop: 4 }}>
                Fallback non-XM terdeteksi dan sengaja ditolak. Zona tidak boleh dibuat dari feed OANDA/Yahoo.
              </div>
            )}
            {failureEntries.length > 0 && (
              <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 4 }}>
                {failureEntries.map(([timeframe, failure]) => (
                  <div key={timeframe}>• {timeframe}: {failure.code} — {failure.message}</div>
                ))}
              </div>
            )}
            <div style={{ ...ui.small, fontSize: 8.5, color: '#94a3b8', marginTop: 5 }}>
              Jalankan XM MT5 + EA <strong>JIN_OHLC_Bridge</strong> agar endpoint
              {' '}<code>/api/trading/ohlc</code> mengembalikan source <strong>MT5_LOCAL_BRIDGE</strong>.
            </div>
          </div>
        )}

        {dataAvailable && analysis?.partial && (
          <div style={{ ...ui.small, fontSize: 8.5, color: '#fbbf24', marginTop: 6 }}>
            Timeframe belum siap: {analysis.missingTimeframes.join(', ')}. Zona hanya dihitung dari TF yang valid.
          </div>
        )}

        {error && (
          <div style={{ ...ui.small, fontSize: 9, color: '#fda4af', marginTop: 6 }}>{error}</div>
        )}
      </div>

      <div style={ui.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={ui.label}>TIMEFRAME AKTIF</div>
          <span style={{ flex: 1 }} />
          <span style={{ ...ui.small, fontSize: 8, color: '#64748b' }}>klik untuk sembunyikan zona per TF</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {SD_TIMEFRAMES.map((timeframe) => {
            const entry = analysis?.timeframes?.[timeframe];
            const ready = entry?.ok === true;
            const count = (entry?.activeZones || []).filter((zone) => zone.lifecycle === 'TESTED').length;
            const active = visibleTimeframes[timeframe];
            return (
              <button
                key={timeframe}
                type="button"
                onClick={() => toggleTimeframe(timeframe)}
                disabled={!ready}
                title={ready ? `${count} zona TESTED` : (entry?.message || 'Data belum tersedia')}
                style={{
                  ...(active ? ui.btnActive : ui.btn),
                  opacity: ready ? 1 : 0.35,
                  padding: '5px 2px',
                  fontSize: 8.5,
                }}
              >
                {timeframe}
                <div style={{ fontSize: 7.5, color: ready ? (active ? '#a5f3fc' : '#67e8f9') : '#64748b' }}>
                  {ready ? `${count} Z` : 'N/A'}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
          {SD_TIMEFRAMES.map((timeframe) => {
            const entry = analysis?.timeframes?.[timeframe];
            if (!entry) return null;
            return (
              <span
                key={timeframe}
                style={{
                  ...ui.pill,
                  fontSize: 7.5,
                  color: entry.ok ? '#6ee7b7' : '#fda4af',
                  background: 'rgba(2,6,23,0.55)',
                  border: '1px solid rgba(148,163,184,0.16)',
                }}
                title={entry.message}
              >
                {timeframe} {entry.ok ? `${entry.freshness}${entry.qualityScore != null ? ` • Q${entry.qualityScore}` : ''}` : entry.status}
              </span>
            );
          })}
        </div>
      </div>

      {dataAvailable && (
        <>
          <div style={ui.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={ui.label}>ZONE MAP (XM OHLC)</div>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setShowMap((prev) => !prev)} style={ui.btn}>
                {showMap ? 'SEMBUNYIKAN' : 'TAMPILKAN'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: showMap ? 5 : 0 }}>
              {SD_TIMEFRAMES.map((timeframe) => {
                const ready = analysis?.timeframes?.[timeframe]?.ok === true;
                return (
                  <button
                    key={timeframe}
                    type="button"
                    onClick={() => setChartTimeframe(timeframe)}
                    disabled={!ready}
                    style={{
                      ...(chartTimeframe === timeframe ? ui.btnActive : ui.btn),
                      opacity: ready ? 1 : 0.3,
                      fontSize: 8,
                      padding: '3px 5px',
                    }}
                  >
                    {timeframe}
                  </button>
                );
              })}
            </div>
            {showMap && (
              <SupplyDemandOverlayChart
                candles={chartCandles}
                zones={chartZones}
                timeframe={chartTimeframe}
                height={190}
              />
            )}
            {showMap && (
              <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>
                Overlay JIN dari OHLC XM tervalidasi. Chart XM native adalah layer WebContentsView terpisah,
                jadi overlay HTML langsung tidak dipaksakan agar tombol BUY/SELL/SL/TP tidak tertutup.
              </div>
            )}
          </div>

          <StrongestCard zone={testedStrongest} />

          <div style={{ display: 'flex', gap: 6 }}>
            <NearestCard
              title="NEAREST TESTED SUPPLY"
              zone={testedNearestSupply}
              emptyText="Tidak ada zona supply TESTED."
            />
            <NearestCard
              title="NEAREST TESTED DEMAND"
              zone={testedNearestDemand}
              emptyText="Tidak ada zona demand TESTED."
            />
          </div>

          <div style={ui.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={ui.label}>TESTED SUPPLY ZONES</div>
              <span style={{ flex: 1 }} />
              <span style={{ ...ui.small, fontSize: 8, color: '#fb7185' }}>{supplyZones.length} zona</span>
            </div>
            {supplyZones.length === 0 ? (
              <div style={{ ...ui.small, fontSize: 9, color: '#64748b' }}>Tidak ada zona supply TESTED pada TF terpilih.</div>
            ) : supplyZones.slice(0, 8).map((zone) => (
              <ZoneRow
                key={zone.id}
                zone={zone}
                expanded={expandedZone === zone.id}
                onToggle={() => toggleZone(zone.id)}
              />
            ))}
          </div>

          <div style={ui.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={ui.label}>TESTED DEMAND ZONES</div>
              <span style={{ flex: 1 }} />
              <span style={{ ...ui.small, fontSize: 8, color: '#34d399' }}>{demandZones.length} zona</span>
            </div>
            {demandZones.length === 0 ? (
              <div style={{ ...ui.small, fontSize: 9, color: '#64748b' }}>Tidak ada zona demand TESTED pada TF terpilih.</div>
            ) : demandZones.slice(0, 8).map((zone) => (
              <ZoneRow
                key={zone.id}
                zone={zone}
                expanded={expandedZone === zone.id}
                onToggle={() => toggleZone(zone.id)}
              />
            ))}
          </div>

          <ConfluenceCard clusters={visibleClusters} visibleTimeframes={visibleTimeframes} />

          <div style={ui.card}>
            <div style={ui.label}>ZONE LIFECYCLE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
              <div
                style={{
                  border: '1px solid #34d39933',
                  borderRadius: 5,
                  background: '#34d3990f',
                  padding: '5px 4px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: '#34d399' }}>
                  {testedZones.length}
                </div>
                <div style={{ fontSize: 7.5, fontWeight: 800, color: '#94a3b8' }}>TESTED</div>
              </div>
            </div>
            <div style={{ ...ui.small, fontSize: 8, color: '#64748b', marginTop: 5, lineHeight: 1.45 }}>
              TESTED = 1 retest valid. Hanya zona TESTED yang ditampilkan di daftar atas.
            </div>
          </div>

          <div style={{ ...ui.small, fontSize: 8, color: '#475569', lineHeight: 1.55 }}>
            <strong style={{ color: '#64748b' }}>Batas Phase 1:</strong> engine ini tidak menghasilkan sinyal
            BUY/SELL, tidak mengubah strategi, dan tidak mengirim order. Zona dihitung hanya dari OHLC XM
            tervalidasi; screenshot tidak pernah diubah menjadi OHLC. Overlay dirender di chart JIN dari OHLC
            XM; chart native XM tidak diinjeksi.
          </div>
        </>
      )}
    </div>
  );
}
