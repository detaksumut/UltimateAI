import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGoldIntermarketFactors } from '../../services/trading/goldIntermarketClient.js';

const INSTRUMENTS = [
  { id: 'dxy', symbol: 'DXY', label: 'US Dollar Index', unit: 'index' },
  { id: 'us10y', symbol: 'US10Y', label: 'US 10Y Yield', unit: 'percent' },
  { id: 'us10y_real', symbol: 'US10Y REAL', label: '10Y Real Yield (TIPS)', unit: 'percent' },
  { id: 'us02y', symbol: 'US02Y', label: 'US 2Y Yield', unit: 'percent' },
  { id: 'wti', symbol: 'WTI', label: 'WTI Crude Oil', unit: 'usd_per_bbl' },
];

const STATUS_COLOR = {
  LIVE: '#34d399',
  DELAYED: '#fbbf24',
  STALE: '#fb7185',
  UNAVAILABLE: '#94a3b8',
};

function formatValue(instrument) {
  if (!Number.isFinite(instrument?.latest)) return '—';
  if (instrument.unit === 'percent') return `${instrument.latest.toFixed(3)}%`;
  if (instrument.unit === 'usd_per_bbl' || instrument.unit === 'usd_per_oz') return `$${instrument.latest.toFixed(2)}`;
  return instrument.latest.toFixed(2);
}

function formatChange(instrument) {
  if (!Number.isFinite(instrument?.change)) return '—';
  if (instrument.changeUnit === 'pp') {
    return `${instrument.change > 0 ? '+' : ''}${instrument.change.toFixed(3)} pp`;
  }
  const absolute = `${instrument.change > 0 ? '+' : ''}${instrument.change.toFixed(2)}`;
  if (Number.isFinite(instrument.changePercent)) {
    return `${absolute} (${instrument.changePercent > 0 ? '+' : ''}${instrument.changePercent.toFixed(2)}%)`;
  }
  return absolute;
}

const fmtTime = value => {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return '—';
  return time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
};

function PulseRow({ definition, instrument, metric }) {
  const status = instrument?.status || 'UNAVAILABLE';
  const statusColor = STATUS_COLOR[status] || '#64748b';
  const changeColor = Number.isFinite(instrument?.change)
    ? (instrument.change > 0 ? '#34d399' : instrument.change < 0 ? '#fb7185' : '#cbd5e1')
    : '#64748b';
  const weighted = Boolean(metric?.weighted);
  const direction = weighted && Number.isFinite(metric?.direction) ? metric.direction : 0;
  const impactColor = direction > 0 ? '#34d399' : direction < 0 ? '#fb7185' : '#475569';
  const impactLabel = direction > 0 ? 'GOLD UP' : direction < 0 ? 'GOLD DOWN' : (metric?.validated ? 'TANPA BOBOT' : '—');

  return (
    <div
      style={{
        background: 'rgba(2,6,23,0.65)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderLeft: `2px solid ${impactColor}`,
        borderRadius: 5,
        padding: '7px 9px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 900, color: '#67e8f9', letterSpacing: '0.04em' }}>
          {definition.symbol}
        </span>
        <span
          title={status}
          style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 900, color: impactColor, letterSpacing: '0.04em' }}>
          {impactLabel}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 9.5, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {definition.label}
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace' }}>
          {formatValue(instrument)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginTop: 2 }}>
        <span style={{ fontSize: 9.5, color: '#475569' }} title="Arah instrumen ini, bukan arah Gold">
          TREN D1 {instrument?.d1?.trend || '—'}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: changeColor, fontFamily: 'monospace' }}>
          {formatChange(instrument)}
        </span>
      </div>
    </div>
  );
}

export default function SidebarMarketPulse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (mounted.current) {
      setLoading(true);
      setError('');
    }
    try {
      const payload = await fetchGoldIntermarketFactors({ signal: controller.signal, timeoutMs: 20000 });
      if (controller.signal.aborted || !mounted.current) return;
      setData(payload);
    } catch (err) {
      if (controller.signal.aborted || !mounted.current) return;
      setError(err?.message || 'Data live belum tersedia.');
    } finally {
      if (!controller.signal.aborted && mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(load, 60000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [load]);

  const rawById = new Map((data?.instruments || []).map(instrument => [instrument.id, instrument]));
  const metricsById = new Map((data?.analysis?.factorMetrics || []).map(metric => [metric.id, metric]));
  const generatedAt = data?.generatedAt || null;
  const statuses = INSTRUMENTS.map(def => rawById.get(def.id)?.status).filter(Boolean);
  const overallStatus = statuses.length === 0
    ? null
    : statuses.includes('UNAVAILABLE')
      ? 'UNAVAILABLE'
      : statuses.includes('STALE')
        ? 'STALE'
        : statuses.includes('DELAYED')
          ? 'DELAYED'
          : 'LIVE';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 2px' }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.05em' }}>
          LIVE FAKTOR INVERS
        </span>
        <span
          title={error || (loading ? 'memuat' : 'live')}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: error ? '#fb7185' : loading ? '#fbbf24' : '#34d399',
          }}
        />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Refresh data live"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: 12,
            cursor: loading ? 'wait' : 'pointer',
            padding: 0,
          }}
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {INSTRUMENTS.map(definition => (
        <PulseRow
          key={definition.id}
          definition={definition}
          instrument={rawById.get(definition.id)}
          metric={metricsById.get(definition.id)}
        />
      ))}

      <div style={{ fontSize: 9.5, color: error ? '#fda4af' : overallStatus && overallStatus !== 'LIVE' ? '#fbbf24' : '#475569', padding: '1px 2px', lineHeight: 1.4 }}>
        {error
          ? 'LIVE OFFLINE · cek LocalRouter'
          : generatedAt
            ? `${overallStatus ? `${overallStatus} · ` : ''}Update ${fmtTime(generatedAt)} WIB`
            : 'Menghubungkan…'}
      </div>
    </div>
  );
}

