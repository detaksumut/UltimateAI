/**
 * JiniFinalVerdictPanel.jsx
 * JINI FINAL VERDICT — multi-timeframe XAUUSD, intermarket alignment,
 * order flow & absorption, institutional activity proxy, and final trading verdict.
 *
 * Presentation only. The engine is fail-closed and never grants execution
 * permission: a verdict is analysis, not an entry order. No values are invented.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJiniDecision, displayText } from '../../services/trading/jiniDecisionClient.js';
import { deriveJiniViewState } from '../../services/trading/jiniDecisionViewState.js';

const text = displayText;

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
    padding: '4px 7px',
    cursor: 'pointer',
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
    whiteSpace: 'nowrap',
  },
  mono: { fontVariantNumeric: 'tabular-nums' },
};

const TREND_COLOR = {
  BULLISH: '#34d399',
  BEARISH: '#fb7185',
  NEUTRAL: '#94a3b8',
  UNKNOWN: '#64748b',
};

const QUALITY_COLOR = {
  READY: '#34d399',
  DEGRADED: '#fbbf24',
  UNAVAILABLE: '#fb7185',
};

const VERDICT_COLOR = {
  BUY: '#34d399',
  SELL: '#fb7185',
  WAIT: '#fbbf24',
  NO_TRADE: '#94a3b8',
};

const VERDICT_LABEL = {
  BUY: 'BUY',
  SELL: 'SELL',
  WAIT: 'WAIT',
  NO_TRADE: 'NO TRADE',
};

function Pill({ text: labelText, color = '#94a3b8', active = true, title }) {
  return (
    <span
      style={{
        ...ui.pill,
        color: active ? color : '#64748b',
        background: active ? `${color}18` : 'transparent',
        border: `1px solid ${active ? `${color}55` : 'transparent'}`,
      }}
      title={text(title, '')}
    >
      {text(labelText, '—')}
    </span>
  );
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
}

function formatAge(value) {
  if (!value) return '—';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '—';
  const seconds = Math.floor(Math.max(0, Date.now() - time) / 1000);
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  return `${Math.floor(minutes / 60)} jam lalu`;
}

export default function JiniFinalVerdictPanel({ enabled = true, symbol = 'XAUUSD' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRunAt, setLastRunAt] = useState(null);
  const [lastAttemptAt, setLastAttemptAt] = useState(null);
  const busyRef = useRef(false);
  const abortRef = useRef(null);

  const load = useCallback(async ({ force = false } = {}) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError('');
    setLastAttemptAt(new Date());
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const payload = await fetchJiniDecision({ signal: controller.signal, force, symbol });
      if (controller.signal.aborted) return;
      setData(payload);
      setLastRunAt(new Date());
      setLastAttemptAt(new Date());
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(text(err?.message ?? err, 'Gagal memuat keputusan JINI.'));
        setLastAttemptAt(new Date());
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      busyRef.current = false;
    }
  }, [symbol]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    return () => abortRef.current?.abort();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => load(), 30_000);
    return () => clearInterval(timer);
  }, [enabled, load]);

  const view = deriveJiniViewState({
    data,
    error,
    loading,
    lastSuccessAt: lastRunAt,
    lastAttemptAt,
  });
  const decision = data?.decision || {};
  const snapshot = data?.snapshot || {};
  const synthesis = data?.synthesis || null;
  const preliminary = text(decision.preliminaryDecision, 'NO_TRADE');
  const verdictColor = VERDICT_COLOR[preliminary] || '#94a3b8';
  const alignment = decision.higherTimeframeAlignment || {};
  const quality = text(decision.dataQualityStatus, 'UNAVAILABLE');
  const qualityColor = QUALITY_COLOR[quality] || '#94a3b8';
  const marketIntegrity = text(snapshot.marketDataIntegrity, text(snapshot.overallIntegrity, 'UNKNOWN'));
  const terminalIntegrity = text(snapshot.terminalConnectivity?.status, 'UNAVAILABLE');
  const systemIntegrity = text(snapshot.overallSystemStatus, text(snapshot.overallIntegrity, 'UNKNOWN'));
  const confidence = decision.confidenceCap || {};
  const hardConflicts = Array.isArray(decision.hardConflicts) ? decision.hardConflicts : [];
  const softConflicts = Array.isArray(decision.softConflicts) ? decision.softConflicts : [];
  const reasons = Array.isArray(decision.decisionReasons) ? decision.decisionReasons : [];
  const missing = Array.isArray(decision.missingEvidence) ? decision.missingEvidence : [];
  const execution = decision.executionFeasibility || {};
  const intermarketSource = data?.sources?.intermarket || {};
  const dataOk = view.hasPayload;
  const stale = view.stale;

  // ── Intermarket instruments (DXY, US10Y, OIL) ──────────────────────
  const intermarketAnalysis = data?.sources?.intermarket?.analysis || {};
  const instruments = Array.isArray(intermarketAnalysis.instruments) ? intermarketAnalysis.instruments : [];
  const findInstrument = (id) => instruments.find((inst) => inst?.id === id || inst?.symbol === id) || null;
  const dxyInst = findInstrument('DXY') || findInstrument('dxy');
  const us10yInst = findInstrument('US10Y') || findInstrument('us10y');
  const oilInst = findInstrument('WTI') || findInstrument('wti') || findInstrument('OIL') || findInstrument('oil');

  // ── Order flow & absorption ────────────────────────────────────────
  const orderFlow = data?.sources?.orderFlow || {};
  const orderFlowData = data?.decision?.orderFlowEvidence || {};
  const orderFlowStatus = text(orderFlow.status, orderFlowData?.status || 'UNAVAILABLE');
  const aggressiveBuy = orderFlowData?.classification?.buyBase ?? null;
  const aggressiveSell = orderFlowData?.classification?.sellBase ?? null;
  const buyAbsorption = orderFlowData?.absorption?.buyAbsorption ?? null;
  const sellAbsorption = orderFlowData?.absorption?.sellAbsorption ?? null;
  const cvd = orderFlowData?.cvd ?? null;
  const cvdSign = orderFlowData?.cvdSign ?? 'FLAT';
  const orderFlowBias = text(orderFlowData?.biasSide, 'NEUTRAL');

  // ── Institutional activity proxy ───────────────────────────────────
  const largeBuyerActivity = aggressiveBuy !== null && aggressiveBuy > 0 ? 'ACTIVE' : 'UNAVAILABLE';
  const largeSellerActivity = aggressiveSell !== null && aggressiveSell > 0 ? 'ACTIVE' : 'UNAVAILABLE';
  const institutionalStatus =
    orderFlowStatus === 'UNAVAILABLE'
      ? 'UNAVAILABLE'
      : (buyAbsorption !== null || sellAbsorption !== null) ? 'ABSORPTION_DETECTED' : 'FLOW_ONLY';

  // ── Multi-timeframe trends ─────────────────────────────────────────
  const timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
  const tfData = timeframes.map((tf) => {
    const trend = text(alignment[tf.toLowerCase()], 'UNKNOWN');
    return { tf, trend, color: TREND_COLOR[trend] || '#64748b' };
  });

  // ── Final verdict gating ───────────────────────────────────────────
  const hasHardConflict = hardConflicts.length > 0;
  const hasSoftConflict = softConflicts.length > 0;
  const isDataReady = quality === 'READY' && !stale;
  const verdictAllowed = isDataReady && !hasHardConflict;

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
              JINI — FINAL VERDICT
            </div>
            <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 2 }}>
              XAUUSD multi-TF · intermarket · order flow · institutional proxy · verdict gate · fail-closed
            </div>
          </div>
          <button
            type="button"
            onClick={() => load({ force: true })}
            disabled={loading}
            style={{ ...ui.btn, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'MEMUAT…' : 'REFRESH'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
          <Pill text={text(data?.instrument, symbol)} color="#67e8f9" />
          <Pill text={`MARKET ${marketIntegrity}`} color={QUALITY_COLOR[marketIntegrity] || '#8aa0b8'} />
          <Pill text={`TERMINAL ${terminalIntegrity}`} color={QUALITY_COLOR[terminalIntegrity] || '#8aa0b8'} />
          <Pill text={`SYSTEM ${systemIntegrity}`} color={QUALITY_COLOR[systemIntegrity] || '#8aa0b8'} />
          <Pill text={`DATA ${quality}`} color={qualityColor} />
          {stale && <Pill text="STALE" color="#fb7185" />}
          <Pill
            text={decision.entryPermission === false ? 'NO EXECUTION PERMISSION' : 'CHECK ENGINE'}
            color={decision.entryPermission === false ? '#34d399' : '#fb7185'}
          />
          {data?.cached && <Pill text={`CACHED ${Math.round((data.cacheAgeMs || 0) / 1000)}s`} color="#fbbf24" />}
        </div>

        {stale && (
          <div
            style={{
              marginTop: 7,
              padding: '6px 7px',
              borderRadius: 6,
              border: '1px solid rgba(251,113,133,0.45)',
              background: 'rgba(251,113,133,0.09)',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 900, color: '#fb7185', letterSpacing: '0.05em' }}>
              STALE — BUKAN KEPUTUSAN TERKINI
            </div>
            <div style={{ ...ui.small, fontSize: 8.5, color: '#fecdd3', marginTop: 2 }}>
              {text(view.message)}
            </div>
            <div style={{ ...ui.small, fontSize: 8, color: '#fda4af', marginTop: 2 }}>
              evaluasi terakhir {text(view.lastSuccessAt, '—')} · percobaan terakhir {text(view.lastAttemptAt, '—')}
            </div>
            <div style={{ ...ui.small, fontSize: 8, color: '#fecdd3', marginTop: 2 }}>
              alasan: {text(view.refreshError, 'tidak diketahui')}
            </div>
          </div>
        )}

        {error && !stale && (
          <div style={{ ...ui.small, fontSize: 8.5, color: '#fda4af', marginTop: 6 }}>
            {text(error)} — tidak ada angka pengganti yang ditampilkan.
          </div>
        )}
      </div>

      {!dataOk ? (
        <div style={{ ...ui.card, borderColor: 'rgba(251,113,133,0.35)' }}>
          <div style={{ ...ui.label, marginBottom: 0, color: '#fda4af' }}>DECISION UNAVAILABLE</div>
          <div style={{ ...ui.small, fontSize: 9, color: '#fecdd3', marginTop: 5 }}>
            {text(data?.error || view.refreshError, view.message)}
          </div>
          <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 4 }}>
            Panel tidak membuat data simulasi. Keputusan hanya tampil jika sumber panel tersedia.
          </div>
          <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 3 }}>
            percobaan terakhir {text(view.lastAttemptAt, '—')}
          </div>
        </div>
      ) : (
        <>
          {/* ── 1. XAUUSD MULTI-TIMEFRAME ── */}
          <div style={ui.card}>
            <div style={ui.label}>XAUUSD MULTI-TIMEFRAME</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 4 }}>
              {tfData.map(({ tf, trend, color }) => (
                <div key={tf} style={{ textAlign: 'center', padding: '5px 2px', border: `1px solid ${color}33`, borderRadius: 5 }}>
                  <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>{tf}</div>
                  <div style={{ fontSize: 9, color, fontWeight: 900, marginTop: 1 }}>{trend}</div>
                  <div style={{ fontSize: 7, color: '#64748b', marginTop: 2 }}>{trend === 'UNKNOWN' ? 'DATA TIDAK TERSEDIA' : 'VALIDASI DATA'}</div>
                </div>
              ))}
            </div>
            <div style={{ ...ui.small, fontSize: 8, marginTop: 6, color: alignment.conflict ? '#fda4af' : alignment.aligned ? '#34d399' : '#94a3b8' }}>
              {alignment.conflict ? 'KONFLIK arah antar timeframe.' : alignment.aligned ? 'Selaras dengan anchor.' : 'Belum selaras / belum ada anchor.'}
            </div>
            <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 3 }}>
              {text(alignment.reason, '')}
            </div>
          </div>

          {/* ── 2. INTERMARKET TREND ALIGNMENT ── */}
          <div style={ui.card}>
            <div style={ui.label}>INTERMARKET TREND ALIGNMENT</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[dxyInst, us10yInst, oilInst].filter(Boolean).map((inst) => {
                const direction = text(inst?.direction, 'NEUTRAL');
                const color = TREND_COLOR[direction] || '#64748b';
                const symbol = inst?.symbol || inst?.id || '—';
                const impact = symbol === 'DXY'
                  ? direction === 'BULLISH' ? 'Tejan XAUUSD turun' : direction === 'BEARISH' ? 'Tejan XAUUSD naik' : 'Netral terhadap XAUUSD'
                  : symbol === 'US10Y'
                    ? direction === 'BULLISH' ? 'Tejan XAUUSD tekanan' : direction === 'BEARISH' ? 'Tejan XAUUSD dukungan' : 'Netral terhadap XAUUSD'
                    : direction === 'BULLISH' ? 'Korelasi positif dengan XAUUSD' : direction === 'BEARISH' ? 'Korelasi negatif dengan XAUUSD' : 'Netral terhadap XAUUSD';
                return (
                  <div key={symbol} style={{ flex: '1 1 200px', minWidth: 0, padding: '5px 6px', border: `1px solid ${color}33`, borderRadius: 5 }}>
                    <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>{symbol}</div>
                    <div style={{ fontSize: 9, color, fontWeight: 900, marginTop: 1 }}>{direction}</div>
                    <div style={{ ...ui.small, fontSize: 7, color: '#cbd5e1', marginTop: 2 }}>{impact}</div>
                    <div style={{ ...ui.small, fontSize: 7, color: '#94a3b8', marginTop: 1 }}>
                      status: {text(inst?.status, 'UNAVAILABLE')}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 4 }}>
              Harga dan timestamp tidak ditampilkan di UI utama. Timestamp digunakan di backend untuk validasi freshness dan sinkronisasi.
            </div>
          </div>

          {/* ── 3. ORDER FLOW & ABSORPTION ── */}
          <div style={ui.card}>
            <div style={ui.label}>ORDER FLOW & ABSORPTION</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, marginBottom: 6 }}>
              <div style={{ padding: '5px 6px', border: `1px solid ${aggressiveBuy !== null ? '#34d399' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>AGGRESSIVE BUY</div>
                <div style={{ fontSize: 10, color: aggressiveBuy !== null ? '#34d399' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{aggressiveBuy !== null ? Number(aggressiveBuy).toLocaleString() : 'UNAVAILABLE'}</div>
              </div>
              <div style={{ padding: '5px 6px', border: `1px solid ${aggressiveSell !== null ? '#fb7185' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>AGGRESSIVE SELL</div>
                <div style={{ fontSize: 10, color: aggressiveSell !== null ? '#fb7185' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{aggressiveSell !== null ? Number(aggressiveSell).toLocaleString() : 'UNAVAILABLE'}</div>
              </div>
              <div style={{ padding: '5px 6px', border: `1px solid ${buyAbsorption !== null ? '#fbbf24' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>BUY ABSORPTION</div>
                <div style={{ fontSize: 10, color: buyAbsorption !== null ? '#fbbf24' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{buyAbsorption !== null ? 'TERDETEKSI' : 'UNAVAILABLE'}</div>
              </div>
              <div style={{ padding: '5px 6px', border: `1px solid ${sellAbsorption !== null ? '#fbbf24' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>SELL ABSORPTION</div>
                <div style={{ fontSize: 10, color: sellAbsorption !== null ? '#fbbf24' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{sellAbsorption !== null ? 'TERDETEKSI' : 'UNAVAILABLE'}</div>
              </div>
            <div style={{ padding: '5px 6px', border: `1px solid ${cvd !== null ? '#67e8f9' : '#64748b'}33`, borderRadius: 5, marginBottom: 6 }}>
              <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>CVD (Cumulative Volume Delta)</div>
              <div style={{ fontSize: 11, color: cvd !== null ? '#67e8f9' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{cvd !== null ? Number(cvd).toLocaleString() : 'UNAVAILABLE'} · arah: {cvdSign}</div>
              <div style={{ ...ui.small, fontSize: 7.5, color: '#94a3b8', marginTop: 2 }}>{orderFlowStatus}</div>
            </div>
            {orderFlowStatus === 'UNAVAILABLE' && (
              <div style={{ ...ui.small, fontSize: 8, color: '#fda4af', marginTop: 4 }}>
                Order flow data tidak tersedia dari sumber. Tidak diisi simulasi.
              </div>
            )}
          </div>

          {/* ── 4. INSTITUTIONAL ACTIVITY ── */}
          <div style={ui.card}>
            <div style={ui.label}>INSTITUTIONAL ACTIVITY (PROXY)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, marginBottom: 6 }}>
              <div style={{ padding: '5px 6px', border: `1px solid ${largeBuyerActivity === 'ACTIVE' ? '#34d399' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>LARGE BUYER ACTIVITY</div>
                <div style={{ fontSize: 10, color: largeBuyerActivity === 'ACTIVE' ? '#34d399' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{largeBuyerActivity}</div>
              </div>
              <div style={{ padding: '5px 6px', border: `1px solid ${largeSellerActivity === 'ACTIVE' ? '#fb7185' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>LARGE SELLER ACTIVITY</div>
                <div style={{ fontSize: 10, color: largeSellerActivity === 'ACTIVE' ? '#fb7185' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{largeSellerActivity}</div>
              </div>
              <div style={{ padding: '5px 6px', border: `1px solid ${buyAbsorption !== null ? '#fbbf24' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>BUY ABSORPTION</div>
                <div style={{ fontSize: 10, color: buyAbsorption !== null ? '#fbbf24' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{buyAbsorption !== null ? 'TERDETEKSI' : 'UNAVAILABLE'}</div>
              </div>
              <div style={{ padding: '5px 6px', border: `1px solid ${sellAbsorption !== null ? '#fbbf24' : '#64748b'}33`, borderRadius: 5, textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>SELL ABSORPTION</div>
                <div style={{ fontSize: 10, color: sellAbsorption !== null ? '#fbbf24' : '#94a3b8', fontWeight: 900, marginTop: 1 }}>{sellAbsorption !== null ? 'TERDETEKSI' : 'UNAVAILABLE'}</div>
              </div>
            </div>
          </div>

            <div style={{ padding: '5px 6px', borderRadius: 5, textAlign: 'center', border: `1px solid ${institutionalStatus === 'UNAVAILABLE' ? '#64748b' : institutionalStatus === 'ABSORPTION_DETECTED' ? '#fbbf24' : '#34d399'}33` }}>
              <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>INSTITUTIONAL ACTIVITY STATUS</div>
              <div style={{ fontSize: 10, fontWeight: 900, marginTop: 1, color: institutionalStatus === 'UNAVAILABLE' ? '#94a3b8' : institutionalStatus === 'ABSORPTION_DETECTED' ? '#fbbf24' : '#34d399' }}>
                {institutionalStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : institutionalStatus === 'ABSORPTION_DETECTED' ? 'ABSORPTION DETECTED' : 'FLOW ONLY'}
              </div>
              <div style={{ ...ui.small, fontSize: 7.5, color: '#94a3b8', marginTop: 2 }}>
                Istilah Institutional Activity Proxy — tidak mengklaim identitas institusi atau transaksi spesifik.
              </div>
            </div>
            {orderFlowStatus === 'UNAVAILABLE' && (
              <div style={{ ...ui.small, fontSize: 8, color: '#fda4af', marginTop: 4 }}>
                Data aktivitas institusi tidak tersedia tanpa order flow. Tidak diisi simulasi.
              </div>
            )}
          </div>

          {/* ── 5. FINAL TRADING VERDICT ── */}
          <div style={{ ...ui.card, borderColor: `${verdictColor}44`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -8, left: 12, background: 'rgba(7,18,36,0.9)', padding: '0 6px', borderRadius: 4, border: `1px solid ${verdictColor}66` }}>
              <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, letterSpacing: '0.05em' }}>FINAL TRADING VERDICT</div>
            </div>
            <div style={{ paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 900, color: verdictColor, letterSpacing: '0.02em' }}>
                  {VERDICT_LABEL[preliminary] || preliminary}
                </span>
                <span style={{ ...ui.mono, fontSize: 9, color: '#94a3b8' }}>
                  D1 {text(decision.dailyBias, 'UNKNOWN')} · anchor {text(alignment.anchorDirection, 'NONE')}
                </span>
              </div>
              <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginBottom: 8 }}>
                {text(alignment.reason, '')}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 8 }}>
                <div style={{ padding: '5px 6px', border: `1px solid ${verdictColor}33`, borderRadius: 5 }}>
                  <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>CONFIDENCE</div>
                  <div style={{ ...ui.mono, fontSize: 14, fontWeight: 900, color: '#e2e8f0' }}>{formatPercent(confidence.cappedConfidence)}</div>
                  <div style={{ ...ui.small, fontSize: 7.5, color: '#94a3b8', marginTop: 1 }}>
                    raw {formatPercent(confidence.rawConfidence)} · cap {formatPercent(confidence.capPercent)}
                    {confidence.applied ? ' · DIBATASI' : ''}
                  </div>
                </div>
                <div style={{ padding: '5px 6px', border: `1px solid ${hasHardConflict ? '#fb7185' : '#34d399'}33`, borderRadius: 5 }}>
                  <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>KESERASIAN TIMEFRAME</div>
                  <div style={{ ...ui.mono, fontSize: 12, fontWeight: 900, color: hasHardConflict ? '#fb7185' : '#34d399' }}>
                    {hasHardConflict ? 'KONFLIK TERDETEKSI' : alignment.aligned ? 'SELARAS' : 'BELUM SELARAS'}
                  </div>
                  <div style={{ ...ui.small, fontSize: 7.5, color: '#94a3b8', marginTop: 1 }}>
                    {softConflicts.length > 0 ? `${softConflicts.length} konflik lunak` : 'Tidak ada konflik terdeteksi'}
                  </div>
                </div>
              </div>

              <div style={{ padding: '5px 6px', border: `1px solid ${verdictColor}33`, borderRadius: 5, marginBottom: 8 }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, marginBottom: 3 }}>DOMINASI BUYER / SELLER</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, padding: '4px 6px', borderRadius: 4, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)' }}>
                    <div style={{ fontSize: 7.5, color: '#34d399', fontWeight: 800 }}>BUYER</div>
                    <div style={{ ...ui.mono, fontSize: 11, fontWeight: 900, color: '#e2e8f0' }}>{aggressiveBuy !== null ? Number(aggressiveBuy).toLocaleString() : '—'}</div>
                  </div>
                  <div style={{ flex: 1, padding: '4px 6px', borderRadius: 4, background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.35)' }}>
                    <div style={{ fontSize: 7.5, color: '#fb7185', fontWeight: 800 }}>SELLER</div>
                    <div style={{ ...ui.mono, fontSize: 11, fontWeight: 900, color: '#fecdd3' }}>{aggressiveSell !== null ? Number(aggressiveSell).toLocaleString() : '—'}</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '5px 6px', borderRadius: 5, marginBottom: 8, border: '1px solid rgba(148,163,184,0.2)' }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, marginBottom: 3 }}>ALASAN KEPUTUSAN</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {reasons.length > 0 ? reasons.map((reason, index) => (
                    <div key={`reason-${index}`} style={{ ...ui.small, fontSize: 8, color: '#cbd5e1', marginLeft: 10 }}>
                      • {text(reason, '')}
                    </div>
                  )) : (
                    <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginLeft: 10 }}>
                      • Tidak ada alasan spesifik tercatat.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '5px 6px', borderRadius: 5, border: `1px solid ${!verdictAllowed ? '#fb7185' : '#34d399'}33` }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>IZIN EKSEKUSI</div>
                <div style={{ ...ui.mono, fontSize: 10, fontWeight: 800, color: !verdictAllowed ? '#fb7185' : '#34d399' }}>
                  {!verdictAllowed ? 'EKSEKUSI DILARANG / MENUNGGU SYARAT' : 'SIAP EVALUASI MANUAL'}
                </div>
              </div>
            </div>
          </div>

          <div style={ui.card}>
            <div style={ui.label}>AI SYNTHESIS — INTERPRETASI, BUKAN PENGUBAH KEPUTUSAN</div>
            {synthesis ? (
              <>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                  <Pill text={`SYNTHESIS ${text(data?.synthesisStatus, 'READY')}`} color="#34d399" />
                  <Pill text={`SOURCE ${text(synthesis.finalDecisionSource, '—')}`} color="#67e8f9" />
                  <Pill text={synthesis.decisionLocked ? 'DECISION LOCKED' : 'CHECK LOCK'} color={synthesis.decisionLocked ? '#34d399' : '#fb7185'} />
                </div>
                <div style={{ ...ui.small, fontSize: 8.5, color: '#cbd5e1' }}>
                  {text(synthesis.marketNarrative, '—')}
                </div>
                {synthesis.decisionExplanation && (
                  <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 4 }}>
                    {text(synthesis.decisionExplanation)}
                  </div>
                )}
                <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 4 }}>
                  final {text(data?.finalDecision, '—')} · engine {text(decision.preliminaryDecision, '—')} ·
                  {' '}sintesis tidak mengubah hard gate, confidence, atau izin eksekusi.
                </div>
              </>
            ) : (
              <div style={{ ...ui.small, fontSize: 8.5, color: '#fbbf24' }}>
                Synthesis UNAVAILABLE — keputusan deterministik tetap berlaku.
                {data?.synthesisError ? ` ${text(data.synthesisError)}` : ''}
              </div>
            )}
          </div>
        </>
      )}

      <div style={ui.card}>
        <div style={ui.label}>CATATAN KONSTITUSI</div>
        <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', lineHeight: 1.55 }}>
          <div>• BUY_BIAS / SELL_BIAS bukan izin entry; engine tidak pernah mengeksekusi order.</div>
          <div>• PAXG/USDT adalah proxy; COMEX GC tetap UNAVAILABLE.</div>
          <div>• Sumber yang hilang dilaporkan UNAVAILABLE, tidak diisi simulasi.</div>
          <div>• Hash bukti berubah jika payload berubah; rekam untuk audit.</div>
        </div>
      </div>
    </div>
  );
}
