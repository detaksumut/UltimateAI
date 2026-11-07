/**
 * M1LevelPreviewPanel.jsx
 * Full-width M1 level preview rendered directly under the native XM chart.
 *
 * This component is presentational only. Its candles, zones, and levels come
 * from the single ScalpingM1Panel data source, so no extra fetch or duplicate
 * analysis is created.
 */

import React from 'react';
import SupplyDemandOverlayChart from './SupplyDemandOverlayChart.jsx';

const PREVIEW_HEIGHT = 240;

const ui = {
  section: {
    width: '100%',
    flexShrink: 0,
    borderTop: '1px solid rgba(0,229,255,0.2)',
    background: '#050b16',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: '0.08em',
    color: '#67e8f9',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 6px',
    borderRadius: 999,
    fontSize: 7.5,
    fontWeight: 900,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '3px 14px',
    padding: '4px 8px',
    borderTop: '1px solid rgba(148,163,184,0.1)',
  },
  note: {
    padding: '3px 8px 5px',
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 1.45,
  },
};

function fmtPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return Math.abs(num) >= 100 ? num.toFixed(2) : num.toFixed(4);
}

export default function M1LevelPreviewPanel({ data }) {
  const chartHeight = PREVIEW_HEIGHT;
  const available = data?.available === true;
  const candles = data?.candles || [];
  const zones = data?.zones || [];
  const levels = data?.levels || [];
  const hasChart = available && candles.length > 0;
  const statusColor = available ? '#34d399' : '#fb7185';
  const statusLabel = available ? 'M1 XM READY' : 'DATA UNAVAILABLE';

  return (
    <section style={ui.section} aria-label="Preview level di chart M1">
      <div style={ui.header}>
        <span style={ui.title}>PREVIEW LEVEL DI CHART M1</span>
        <span
          style={{
            ...ui.pill,
            color: statusColor,
            border: `1px solid ${statusColor}55`,
            background: `${statusColor}16`,
          }}
        >
          {statusLabel}
        </span>
        {data?.dataStatus && (
          <span
            style={{
              ...ui.pill,
              color: '#94a3b8',
              border: '1px solid rgba(148,163,184,0.2)',
              background: 'rgba(2,6,23,0.6)',
            }}
          >
            {data.dataStatus}
          </span>
        )}
        {data?.symbol && (
          <span
            style={{
              ...ui.pill,
              color: '#67e8f9',
              border: '1px solid rgba(0,229,255,0.25)',
              background: 'rgba(0,229,255,0.08)',
            }}
          >
            {data.symbol} · M1
          </span>
        )}
        <span style={{ flex: 1 }} />
        {data?.updatedAt && (
          <span style={{ fontSize: 7.5, color: '#64748b' }}>
            update {new Date(data.updatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div style={{ width: '100%' }}>
        {hasChart ? (
          <SupplyDemandOverlayChart
            candles={candles}
            zones={zones}
            levels={levels}
            timeframe="M1"
            height={chartHeight}
          />
        ) : (
          <div
            style={{
              height: chartHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(0,229,255,0.14)',
              borderRadius: 6,
              background: '#050b16',
              color: '#64748b',
              fontSize: 10,
            }}
          >
            {available
              ? 'Menunggu candle M1 XM...'
              : 'OHLC M1 XM tervalidasi belum tersedia.'}
          </div>
        )}
      </div>

      {levels.length > 0 && (
        <div style={ui.legend}>
          <span
            style={{
              ...ui.pill,
              color: '#fb7185',
              border: '1px solid rgba(251,113,133,0.35)',
              background: 'rgba(251,113,133,0.08)',
            }}
          >
            SUPPLY
          </span>
          <span
            style={{
              ...ui.pill,
              color: '#34d399',
              border: '1px solid rgba(52,211,153,0.35)',
              background: 'rgba(52,211,153,0.08)',
            }}
          >
            DEMAND
          </span>
          {levels.map((level) => (
            <span
              key={`${level.label}-${level.price}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 7.5 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: level.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#94a3b8' }}>{level.label}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  color: '#e2e8f0',
                }}
              >
                {fmtPrice(level.price)}
              </span>
            </span>
          ))}
        </div>
      )}

      <div style={ui.note}>
        ENTRY solid, SL dashed, TP dotted. Level ini preview dari zona M1 XM, bukan order.
        Chart JIN memakai OHLC XM tervalidasi; chart native XM tidak diinjeksi.
      </div>
    </section>
  );
}
