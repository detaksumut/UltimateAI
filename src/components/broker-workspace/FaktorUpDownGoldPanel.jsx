/**
 * FaktorUpDownGoldPanel.jsx
 * FAKTOR UP/DOWN GOLD — Broker Workspace tab.
 *
 * Presentation only. Data is fetched from the LocalRouter endpoint
 * /trading/gold-intermarket-factors which normalizes real providers
 * (Yahoo Finance + FRED). No simulated values and no client-side fallback.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchGoldIntermarketFactors,
  displayText,
} from '../../services/trading/goldIntermarketClient.js';

// Single hardened renderer: never emits "[object Object]" for provider data.
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

const BIAS_COLOR = {
  UP: '#34d399',
  DOWN: '#fb7185',
  MIXED: '#fbbf24',
  'INSUFFICIENT DATA': '#94a3b8',
  'MENUNGGU DATA': '#64748b',
};

const TREND_COLOR = {
  BULLISH: '#34d399',
  BEARISH: '#fb7185',
  SIDEWAYS: '#fbbf24',
  UNKNOWN: '#64748b',
};

const STATUS_COLOR = {
  LIVE: '#34d399',
  DELAYED: '#fbbf24',
  STALE: '#fb7185',
  UNAVAILABLE: '#94a3b8',
};

// Active category badge colours. Inactive badges render as muted plain text.
const ROLE_COLOR = {
  CORE: '#38bdf8',
  CONFIRMATION: '#8aa0b8',
  CONDITIONAL: '#a78bfa',
};

const STABILITY_COLOR = {
  STABLE: '#34d399',
  WEAK: '#fbbf24',
  UNSTABLE: '#fb7185',
  UNKNOWN: '#64748b',
};

const IMPACT_COLOR = {
  'Mendukung Gold UP': '#34d399',
  'Menekan Gold DOWN': '#fb7185',
  'Belum dinilai': '#64748b',
};

const RISK_COLOR = {
  'RISK-ON': '#34d399',
  'RISK-OFF': '#fb7185',
  MIXED: '#fbbf24',
  UNKNOWN: '#64748b',
};

const ALIGN_COLOR = {
  CONFIRMS: '#34d399',
  OPPOSES: '#fb7185',
  CONTEXT_ONLY: '#fbbf24',
  UNKNOWN: '#64748b',
};

const ROLE_LABEL = {
  CORE: 'INTI',
  CONFIRMATION: 'KONFIRMASI',
  CONDITIONAL: 'KONDISIONAL',
};

const INFLATION_LABEL = {
  OIL_UP_WITH_INFLATION_EXPECTATION_UP: 'Oil naik beriringan dengan breakeven inflasi naik',
  OIL_DOWN_WITH_INFLATION_EXPECTATION_DOWN: 'Oil turun beriringan dengan breakeven inflasi turun',
  BREAKEVEN_FLAT: 'Breakeven inflasi datar',
  DIVERGENT: 'Arah Oil dan breakeven inflasi tidak searah',
  UNKNOWN: 'Tidak dapat dinilai (data belum lengkap)',
};

const EXPECTED_INSTRUMENTS = [
  {
    id: 'dxy', symbol: 'DXY', label: 'US Dollar Index', kind: 'price', unit: 'index',
    role: 'CORE', influenceGroup: 'USD', provider: 'Yahoo Finance', providerSymbol: 'DX-Y.NYB',
  },
  {
    id: 'us10y', symbol: 'US10Y', label: 'US 10Y Treasury Yield', kind: 'yield', unit: 'percent',
    role: 'CONFIRMATION', influenceGroup: 'RATES', provider: 'Yahoo Finance', providerSymbol: '^TNX',
  },
  {
    id: 'us10y_real', symbol: 'US10Y_REAL', label: 'US 10Y Real Yield (TIPS)', kind: 'yield', unit: 'percent',
    role: 'CORE', influenceGroup: 'RATES', provider: 'FRED', providerSymbol: 'DFII10',
  },
  {
    id: 'us02y', symbol: 'US02Y', label: 'US 2Y Treasury Yield', kind: 'yield', unit: 'percent',
    role: 'CONFIRMATION', influenceGroup: 'RATES', provider: 'FRED', providerSymbol: 'DGS2',
  },
  {
    id: 'wti', symbol: 'WTI', label: 'WTI Crude Oil', kind: 'price', unit: 'usd_per_bbl',
    role: 'CONDITIONAL', influenceGroup: 'OIL', provider: 'Yahoo Finance', providerSymbol: 'CL=F',
  },
];

function signed(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function formatValue(instrument) {
  if (!instrument || !Number.isFinite(instrument.latest)) return '—';
  if (instrument.unit === 'percent') return `${instrument.latest.toFixed(3)}%`;
  if (instrument.unit === 'usd_per_bbl') return `$${instrument.latest.toFixed(2)}`;
  if (instrument.unit === 'usd_per_oz') return `$${instrument.latest.toFixed(2)}`;
  return instrument.latest.toFixed(2);
}

function formatChange(instrument) {
  if (!instrument || !Number.isFinite(instrument.change)) return '—';
  if (instrument.changeUnit === 'pp') return `${signed(instrument.change)} pp`;
  const absolute = `${instrument.change > 0 ? '+' : ''}${instrument.change.toFixed(2)}`;
  if (Number.isFinite(instrument.changePercent)) {
    return `${absolute} (${signed(instrument.changePercent, 2)}%)`;
  }
  return absolute;
}

function formatCorrelation(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}

function formatWeight(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(0)}%` : '—';
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function formatPercent(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function formatCompact(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

function formatTime(value) {
  if (!value) return '—';
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return text(value);
  return time.toLocaleString('id-ID', { hour12: false });
}

function formatAge(value, now = Date.now()) {
  if (!value) return '—';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '—';
  const minutes = Math.floor(Math.max(0, now - time) / 60_000);
  if (minutes < 1) return '<1 mnt';
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

function stabilityText(metric, key = 'correlationD1') {
  const stability = metric?.[key]?.stability;
  if (!stability || stability.status === 'UNKNOWN') return 'UNKNOWN';
  const first = formatCorrelation(stability.firstHalf);
  const second = formatCorrelation(stability.secondHalf);
  return `${stability.status} (${first} → ${second})`;
}

function impactText(metric) {
  if (!metric) return 'Belum dinilai';
  if (!metric.validated) return 'Belum dinilai (korelasi belum tervalidasi)';
  if (!metric.weighted) return 'Belum dinilai (korelasi di bawah ambang bobot)';
  if (metric.direction > 0) return `Mendukung Gold UP · ${metric.impactStrength || '—'}`;
  if (metric.direction < 0) return `Menekan Gold DOWN · ${metric.impactStrength || '—'}`;
  return 'Netral (perubahan nol atau baseline tidak tersedia)';
}

function skeletonInstrument(def, pending) {
  return {
    ...def,
    status: 'UNAVAILABLE',
    latest: null,
    previousClose: null,
    change: null,
    changeUnit: def.kind === 'yield' ? 'pp' : 'price',
    changePercent: null,
    d1: { trend: 'UNKNOWN', available: false, bars: 0 },
    h4: { trend: 'UNKNOWN', available: false, bars: 0, reason: 'Menunggu data provider.' },
    updatedAt: null,
    lastObservationDate: null,
    validation: { ok: false, hasData: false, warnings: ['Belum ada data dari provider.'] },
    error: null,
    pending,
  };
}

function Pill({ text: labelText, color, title, active = true }) {
  return (
    <span
      style={{
        ...ui.pill,
        color: active ? color : '#64748b',
        background: active ? `${color}18` : 'transparent',
        // Keep 1px width when inactive so the badge area does not resize.
        border: `1px solid ${active ? `${color}55` : 'transparent'}`,
      }}
      title={text(title, '')}
    >
      {text(labelText, '—')}
    </span>
  );
}

function TrendPill({ trend }) {
  const label = text(trend, 'UNKNOWN');
  return <Pill text={label} color={TREND_COLOR[label] || '#64748b'} />;
}

function RolePill({ role }) {
  const label = ROLE_LABEL[role] || text(role, '—');
  return (
    <Pill
      text={label}
      color={ROLE_COLOR[role] || '#64748b'}
      active={Boolean(ROLE_COLOR[role])}
      title={`Peran: ${label}`}
    />
  );
}

function StatusPill({ status }) {
  const label = text(status, 'UNAVAILABLE');
  return (
    <Pill
      text={label}
      color={STATUS_COLOR[label] || '#94a3b8'}
      active={Boolean(STATUS_COLOR[label])}
      title={`Status data: ${label}`}
    />
  );
}

function InstrumentCard({ instrument, metric, now }) {
  const changeColor = Number.isFinite(instrument.change)
    ? (instrument.change > 0 ? '#34d399' : instrument.change < 0 ? '#fb7185' : '#cbd5e1')
    : '#64748b';
  const warnings = instrument.validation?.warnings || [];
  const status = text(instrument.status, 'UNAVAILABLE');
  const impact = impactText(metric);
  return (
    <div style={{ ...ui.card, minWidth: 0, borderColor: status === 'UNAVAILABLE' ? 'rgba(251,113,133,0.35)' : 'rgba(0,229,255,0.16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: '#67e8f9', letterSpacing: '0.04em' }}>{text(instrument.symbol)}</span>
        <RolePill role={instrument.role} />
        <span style={{ flex: 1 }} />
        <StatusPill status={status} />
      </div>
      <div style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 2 }}>{text(instrument.label)}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
        <span style={{ ...ui.mono, fontSize: 15, fontWeight: 900, color: '#e2e8f0' }}>{formatValue(instrument)}</span>
        <span style={{ ...ui.mono, fontSize: 9, fontWeight: 800, color: changeColor }}>{formatChange(instrument)}</span>
      </div>
      {!Number.isFinite(instrument.latest) && (
        <div style={{ ...ui.small, fontSize: 8, color: '#fda4af', marginTop: 2 }}>
          {instrument.pending ? 'Menunggu respons provider.' : 'Harga/yield belum tersedia.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
        <span style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, alignSelf: 'center' }}>D1</span>
        <TrendPill trend={instrument.d1?.trend} />
        <span style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, alignSelf: 'center' }}>H4</span>
        {instrument.h4?.available
          ? <TrendPill trend={instrument.h4?.trend} />
          : <Pill text="N/A" color="#64748b" title={instrument.h4?.reason || 'H4 tidak tersedia'} />}
      </div>

      <div style={{ ...ui.small, fontSize: 8, marginTop: 5, color: IMPACT_COLOR[impact.split(' · ')[0]] || '#94a3b8' }}>
        Pengaruh: {impact}
      </div>

      <div style={{ ...ui.small, fontSize: 8, marginTop: 3, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <span>corr D1 {formatCorrelation(metric?.correlationD1?.r)} ({metric?.correlationD1?.n ?? 0} obs)</span>
        <span>stab {stabilityText(metric)}</span>
        <span>corr H4 {formatCorrelation(metric?.correlationH4?.r)}</span>
        <span>bobot {formatWeight(metric?.weight)}</span>
        <span>grup {text(instrument.influenceGroup)}</span>
      </div>

      <div style={{ ...ui.small, fontSize: 7.5, marginTop: 4, color: '#64748b' }}>
        {formatTime(instrument.updatedAt)} · usia {formatAge(instrument.updatedAt, now)} · {text(instrument.provider)}
        {instrument.providerSymbol ? ` · ${text(instrument.providerSymbol)}` : ''}
        {instrument.sourceUrl ? (
          <a href={instrument.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', marginLeft: 4 }}>
            sumber
          </a>
        ) : null}
        {instrument.proxy ? ` · proxy ${text(instrument.proxy)}` : ''}
        {instrument.marketState && instrument.marketState !== 'DAILY_ONLY' ? ` · sesi ${text(instrument.marketState)}` : ''}
      </div>

      {instrument.statusDetail && status !== 'LIVE' && (
        <div style={{ ...ui.small, fontSize: 7.5, color: status === 'UNAVAILABLE' ? '#fda4af' : '#64748b', marginTop: 2 }}>
          {text(instrument.statusDetail)}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ ...ui.small, fontSize: 7.5, color: '#fbbf24', marginTop: 3 }}>
          Validasi: {warnings.map((warning) => text(warning)).join(' · ')}
        </div>
      )}
      {instrument.error && (
        <div style={{ ...ui.small, fontSize: 8, color: '#fda4af', marginTop: 3 }}>{text(instrument.error)}</div>
      )}
    </div>
  );
}

function FactorList({ title, items, tone, emptyText }) {
  const color = tone === 'up' ? '#34d399' : '#fb7185';
  return (
    <div style={ui.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ ...ui.label, color: `${color}cc` }}>{title}</div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: '#64748b' }}>{items.length} faktor</span>
      </div>
      {items.length === 0 ? (
        <div style={{ ...ui.small, fontSize: 9, color: '#64748b' }}>{emptyText}</div>
      ) : items.map((item) => (
        <div
          key={`${title}-${item.id}`}
          style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 5, marginTop: 5 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 900, color }}>{text(item.symbol)}</span>
            <span style={{ fontSize: 8.5, color: '#cbd5e1' }}>{text(item.label)}</span>
            <Pill text={item.impactStrength || '—'} color={color} />
            <span style={{ flex: 1 }} />
            <span style={{ ...ui.mono, fontSize: 8, color: '#94a3b8' }}>kontrib {signed(item.contribution, 3)}</span>
          </div>
          <div style={{ ...ui.small, fontSize: 8.5, marginTop: 2 }}>{text(item.reason)}</div>
          <div style={{ ...ui.small, fontSize: 7.5, marginTop: 2, color: '#64748b' }}>
            perubahan {signed(item.change, item.changeUnit === 'pp' ? 3 : 2)}
            {item.changeUnit === 'pp' ? ' pp' : ''}
            {Number.isFinite(item.changePercent) ? ` (${signed(item.changePercent, 2)}%)` : ''}
            {' '}· corr {formatCorrelation(item.correlationD1)}
            {' '}· stab {text(item.stability?.status, 'UNKNOWN')}
            {' '}· bobot {formatWeight(item.weight)}
            {' '}· grup {text(item.influenceGroup)}
          </div>
        </div>
      ))}
    </div>
  );
}

function OilCard({ oil }) {
  if (!oil) return null;
  const direction = text(oil.direction, 'UNKNOWN');
  const color = direction === 'UP' ? '#fb7185' : direction === 'DOWN' ? '#34d399' : '#fbbf24';
  const strength = text(oil.strength, 'UNKNOWN');
  const geopolitical = oil.geopolitical || {};
  return (
    <div style={{ ...ui.card, borderColor: 'rgba(251,191,36,0.28)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ ...ui.label, marginBottom: 0, color: 'rgba(251,191,36,0.85)' }}>ANALISIS OIL TERHADAP GOLD</div>
        <span style={{ flex: 1 }} />
        <Pill text={oil.symbol} color="#fbbf24" title="WTI (CL=F) — tidak diganti Brent" />
        <Pill text={oil.available ? strength : 'UNAVAILABLE'} color={oil.validated ? '#38bdf8' : '#64748b'} />
      </div>
      {!oil.available ? (
        <div style={{ ...ui.small, fontSize: 9, color: '#fda4af', marginTop: 5 }}>
          Data Oil tidak tersedia. Tidak ada nilai pengganti yang dikarang.
        </div>
      ) : (
        <>
          <div style={{ ...ui.small, fontSize: 9, marginTop: 4 }}>
            Arah <strong style={{ color }}>{direction}</strong> · kecepatan {text(oil.speed, '—')} · bobot {formatWeight(oil.weight)} ·
            {' '}korelasi D1 {formatCorrelation(oil.correlationD1)}
          </div>
          <div style={{ ...ui.small, fontSize: 8.5, marginTop: 3, color: '#cbd5e1' }}>
            {INFLATION_LABEL[oil.inflationLink?.status] || INFLATION_LABEL.UNKNOWN}
            {Number.isFinite(oil.inflationLink?.breakevenNow) && (
              <> · breakeven 10Y {oil.inflationLink.breakevenNow.toFixed(3)}% ({signed(oil.inflationLink.breakevenChange)} pp)</>
            )}
          </div>
          <div style={{ ...ui.small, fontSize: 8, marginTop: 2, color: '#94a3b8' }}>
            vs DXY: {text(oil.vsDxy, 'UNKNOWN')} · vs US10Y: {text(oil.vsUs10y, 'UNKNOWN')}
          </div>
          <div style={{ ...ui.small, fontSize: 8, marginTop: 2, color: '#64748b' }}>
            Geopolitik / risk sentiment: {text(geopolitical.status, 'UNKNOWN')} — {text(geopolitical.note, 'belum dinilai')}
          </div>
          <div style={{ ...ui.small, fontSize: 7.5, marginTop: 3, color: '#475569' }}>
            {text(oil.inflationLink?.note, '')}
          </div>
        </>
      )}
    </div>
  );
}

function CryptoAssetRow({ asset, now }) {
  if (!asset) return null;
  const futures = asset.futures || {};
  const changeColor = Number.isFinite(asset.priceChangePercent24h)
    ? (asset.priceChangePercent24h > 0 ? '#34d399' : asset.priceChangePercent24h < 0 ? '#fb7185' : '#cbd5e1')
    : '#64748b';
  const futuresUnavailable = futures.status === 'UNAVAILABLE' || !futures.available;
  return (
    <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: 6, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: '#67e8f9' }}>{text(asset.symbol)}</span>
        <span style={{ fontSize: 8.5, color: '#94a3b8' }}>{text(asset.name)} · SPOT</span>
        <StatusPill status={asset.status} />
        <span style={{ flex: 1 }} />
        <span style={{ ...ui.mono, fontSize: 12, fontWeight: 900, color: '#e2e8f0' }}>{formatNumber(asset.latest)}</span>
        <span style={{ ...ui.mono, fontSize: 8.5, fontWeight: 800, color: changeColor }}>{formatPercent(asset.priceChangePercent24h)}</span>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
        <span style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, alignSelf: 'center' }}>D1</span>
        <TrendPill trend={asset.trends?.D1?.trend} />
        <span style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, alignSelf: 'center' }}>H4</span>
        <TrendPill trend={asset.trends?.H4?.trend} />
        <span style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, alignSelf: 'center' }}>H1</span>
        <TrendPill trend={asset.trends?.H1?.trend} />
      </div>

      <div style={{ ...ui.small, fontSize: 8, marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>corr D1 {formatCorrelation(asset.correlationD1?.r)} ({asset.correlationD1?.n ?? 0} obs)</span>
        <span>corr H4 {formatCorrelation(asset.correlationH4?.r)}</span>
        <span>
          vol {text(asset.volumeConfirmation?.status, 'UNKNOWN')}
          {Number.isFinite(asset.volumeConfirmation?.ratio) ? ` (${asset.volumeConfirmation.ratio.toFixed(2)}x)` : ''}
        </span>
        <span>taker {text(asset.takerPressure?.status, 'UNKNOWN')}</span>
      </div>

      <div style={{ ...ui.small, fontSize: 8, marginTop: 3, color: '#94a3b8' }}>
        FUTURES {futuresUnavailable ? 'UNAVAILABLE' : text(futures.status)}
        {!futuresUnavailable && Number.isFinite(futures.markPrice) && <> · mark {formatNumber(futures.markPrice)}</>}
        {!futuresUnavailable && Number.isFinite(futures.openInterest) && <> · OI {formatCompact(futures.openInterest)}</>}
        {!futuresUnavailable && Number.isFinite(futures.openInterestChangePct) && <> ({formatPercent(futures.openInterestChangePct)})</>}
        {!futuresUnavailable && Number.isFinite(futures.fundingRate) && (
          <> · funding {formatPercent(futures.fundingRate * 100, 4)} ({text(futures.fundingCondition?.status, 'UNKNOWN')})</>
        )}
        {!futuresUnavailable && Number.isFinite(futures.longShortRatio) && <> · L/S {futures.longShortRatio.toFixed(2)}</>}
      </div>

      {!futuresUnavailable && futures.fundingCondition?.note && (
        <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 2 }}>{text(futures.fundingCondition.note)}</div>
      )}
      <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 2 }}>
        {text(futures.liquidations?.note, 'Data likuidasi tidak tersedia.')}
      </div>
      <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 2 }}>
        {formatTime(asset.updatedAt)} · usia {formatAge(asset.updatedAt, now)} · {text(asset.provider)}
        {futures.error ? ` · futures: ${text(futures.error)}` : ''}
      </div>
      {asset.error && (
        <div style={{ ...ui.small, fontSize: 8, color: '#fda4af', marginTop: 2 }}>{text(asset.error)}</div>
      )}
    </div>
  );
}

function CryptoRiskSentimentSection({ crypto, now }) {
  if (!crypto) return null;
  const risk = text(crypto.riskSentiment?.status, 'UNKNOWN');
  const alignment = text(crypto.alignment, 'UNKNOWN');
  return (
    <div style={{ ...ui.card, borderColor: 'rgba(167,139,250,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ ...ui.label, marginBottom: 0, color: 'rgba(167,139,250,0.9)' }}>
          CRYPTO RISK SENTIMENT · KONFIRMASI
        </div>
        <span style={{ flex: 1 }} />
        <StatusPill status={crypto.status} />
        <Pill
          text={`BOBOT ${formatWeight(0)}`}
          color="#8aa0b8"
          title="Grup CRYPTO tidak diberi bobot dan tidak mengubah skor/GOLD BIAS makro."
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: RISK_COLOR[risk] || '#94a3b8' }}>{risk}</span>
        <Pill text={text(crypto.alignmentLabel, 'Konteks')} color={ALIGN_COLOR[alignment] || '#64748b'} />
        <span style={{ ...ui.small, fontSize: 8 }}>{text(crypto.riskSentiment?.reason, '')}</span>
      </div>
      <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 4 }}>
        Satu grup agregat CRYPTO (BTC+ETH); BTC dan ETH tidak dihitung sebagai dua konfirmasi terpisah.
        {' '}{text(crypto.alignmentReason, '')}
      </div>

      {!crypto.ok ? (
        <div style={{ ...ui.small, fontSize: 8.5, color: '#fda4af', marginTop: 5 }}>
          {text(crypto.error, 'Binance tidak terjangkau.')} Analisis makro tetap berjalan tanpa crypto.
        </div>
      ) : (
        <>
          <CryptoAssetRow asset={crypto.assets?.BTC} now={now} />
          <CryptoAssetRow asset={crypto.assets?.ETH} now={now} />
        </>
      )}

      {crypto.futuresError && (
        <div style={{ ...ui.small, fontSize: 7.5, color: '#fbbf24', marginTop: 4 }}>
          Futures: {text(crypto.futuresError)}
        </div>
      )}
      <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 4, lineHeight: 1.55 }}>
        {(crypto.limitations || []).map((note) => <div key={text(note)}>• {text(note)}</div>)}
      </div>
    </div>
  );
}

export default function FaktorUpDownGoldPanel({ enabled = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);
  const abortRef = useRef(null);

  const load = useCallback(async ({ force = false } = {}) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const payload = await fetchGoldIntermarketFactors({ signal: controller.signal, force });
      if (controller.signal.aborted) return;
      setData(payload);
      setLastRunAt(new Date());
      setNow(Date.now());

      const returned = Array.isArray(payload.instruments) ? payload.instruments : [];
      const valid = returned.filter((instrument) => Number.isFinite(instrument.latest));
      const unavailable = returned.filter((instrument) => (
        instrument.status === 'UNAVAILABLE' || !Number.isFinite(instrument.latest)
      ));
      if (valid.length === 0) {
        setNotice({
          type: 'error',
          text: `Refresh ${force ? 'paksa' : 'otomatis'} gagal: respons diterima, tetapi tidak ada instrumen dengan nilai valid.`,
        });
      } else if (unavailable.length > 0) {
        setNotice({
          type: 'warn',
          text: `Refresh ${force ? 'paksa' : 'otomatis'} selesai: ${valid.length}/${returned.length} instrumen valid; belum tersedia: ${unavailable.map((item) => text(item.symbol)).join(', ')}.`,
        });
      } else {
        const servedFromCache = force && payload.forceRefresh === false;
        setNotice({
          type: servedFromCache ? 'warn' : 'ok',
          text: `Refresh ${force ? 'paksa' : 'otomatis'} berhasil: ${valid.length}/${returned.length} instrumen valid${payload.cached ? ' (cache server)' : ''}${servedFromCache ? ' · server tidak melakukan fetch baru' : ''}. Data dibuat ${formatAge(payload.generatedAt)} lalu.`,
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = text(err?.message ?? err, 'Gagal memuat data faktor intermarket.');
        setError(message);
        setNotice({ type: 'error', text: `Refresh gagal: ${message}` });
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    return () => abortRef.current?.abort();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => load(), 60_000);
    return () => clearInterval(timer);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [enabled]);

  const analysis = data?.analysis;
  const rawInstruments = data?.instruments || [];
  const instruments = useMemo(() => {
    const merged = EXPECTED_INSTRUMENTS.map((def) => {
      const live = rawInstruments.find((instrument) => instrument.id === def.id);
      return live ? { ...def, ...live } : skeletonInstrument(def, !data);
    });
    for (const extra of rawInstruments) {
      if (!merged.some((instrument) => instrument.id === extra.id)) merged.push(extra);
    }
    return merged;
  }, [rawInstruments, data]);
  const metricById = useMemo(() => {
    const map = new Map();
    for (const metric of analysis?.factorMetrics || []) map.set(metric.id, metric);
    return map;
  }, [analysis]);

  const bias = analysis?.bias || (error ? 'INSUFFICIENT DATA' : 'MENUNGGU DATA');
  const biasColor = BIAS_COLOR[bias] || '#94a3b8';
  const dominant = analysis?.dominantFactor;
  const missing = analysis?.dataCompleteness?.missing || [];
  const missingDetails = analysis?.dataCompleteness?.missingDetails || [];
  const validationWarnings = analysis?.dataCompleteness?.validationWarnings || [];
  const gold = data?.gold;
  const providerSummary = data?.providerSummary || {};

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
              FAKTOR UP/DOWN GOLD
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
              Intermarket intelligence XAUUSD · D1 makro + H4 konfirmasi · korelasi 180 observasi
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

        <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: biasColor, letterSpacing: '0.03em' }}>{bias}</span>
          {analysis?.strength && <Pill text={`STRENGTH ${analysis.strength}`} color={analysis.strength === 'STRONG' ? '#34d399' : analysis.strength === 'MODERATE' ? '#fbbf24' : '#94a3b8'} />}
          {analysis && (
            <span style={{ ...ui.mono, fontSize: 9, color: '#94a3b8' }}>
              score {signed(analysis.score, 3)}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {gold && (
            <Pill
              text={`${gold.proxy ? `XAUUSD≈${text(gold.proxy)}` : 'XAUUSD'} ${formatValue(gold)} · ${text(gold.status, 'UNAVAILABLE')}`}
              color={STATUS_COLOR[gold.status] || '#94a3b8'}
              title={`Baseline ${text(gold.provider)} ${text(gold.providerSymbol)}${gold.proxy ? ` (proxy ${text(gold.proxy)}, bukan spot)` : ''} · ${formatTime(gold.updatedAt)}`}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          <Pill
            text={`CONFIRM ${analysis?.confirmationCount ?? 0} (${analysis?.independentConfirmationCount ?? 0} grup)`}
            color="#34d399"
          />
          <Pill
            text={`CONFLICT ${analysis?.conflictCount ?? 0} (${analysis?.independentConflictCount ?? 0} grup)`}
            color="#fb7185"
          />
          {analysis?.dataCompleteness && (
            <Pill
              text={`DATA ${analysis.dataCompleteness.available}/${analysis.dataCompleteness.required}`}
              color={missing.length ? '#fbbf24' : '#38bdf8'}
            />
          )}
          {analysis?.dataCompleteness?.validatedFactorCount != null && (
            <Pill text={`FAKTOR BERVALIDASI ${analysis.dataCompleteness.validatedFactorCount}`} color="#38bdf8" />
          )}
          {analysis?.dataCompleteness?.coreFactorsUsable != null && (
            <Pill
              text={`FAKTOR INTI ${analysis.dataCompleteness.coreFactorsUsable ? 'SIAP' : 'BELUM SIAP'}`}
              color={analysis.dataCompleteness.coreFactorsUsable ? '#34d399' : '#fbbf24'}
              title="Faktor inti: DXY dan US10Y Real Yield harus tersedia dan tidak STALE."
            />
          )}
          {lastRunAt && <Pill text={`ANALISIS ${lastRunAt.toLocaleTimeString('id-ID')}`} color="#64748b" />}
          {data?.cached && <Pill text="CACHE SERVER" color="#fbbf24" />}
        </div>

        {notice && (
          <div
            style={{
              ...ui.small,
              fontSize: 8.5,
              marginTop: 6,
              color: notice.type === 'error' ? '#fda4af' : notice.type === 'warn' ? '#fbbf24' : '#34d399',
            }}
          >
            {text(notice.text)}
          </div>
        )}

        {error && (
          <div style={{ ...ui.small, fontSize: 8.5, color: '#fda4af', marginTop: 6 }}>
            {text(error)} — tidak ada angka pengganti yang ditampilkan.
          </div>
        )}

        {missing.length > 0 && (
          <div style={{ ...ui.small, fontSize: 8.5, color: '#fbbf24', marginTop: 5 }}>
            Data belum lengkap: {missing.map((item) => text(item)).join(', ')}. Bias dinyatakan INSUFFICIENT DATA.
            {missingDetails.length > 0 && (
              <div style={{ fontSize: 7.5, color: '#94a3b8', marginTop: 2 }}>
                Provider yang dibutuhkan: {missingDetails.map((item) => `${text(item.symbol)} → ${text(item.provider)}`).join(' · ')}
              </div>
            )}
          </div>
        )}

        {(analysis?.dataCompleteness?.staleInstruments || []).length > 0 && (
          <div style={{ ...ui.small, fontSize: 8, color: '#fbbf24', marginTop: 5 }}>
            Data usang (STALE, tidak diberi bobot): {(analysis.dataCompleteness.staleInstruments || []).map((item) => text(item)).join(', ')}.
          </div>
        )}

        {validationWarnings.length > 0 && (
          <div style={{ ...ui.small, fontSize: 7.5, color: '#fbbf24', marginTop: 5 }}>
            Peringatan validasi: {validationWarnings.map((item) => `${text(item.symbol)}: ${(item.warnings || []).map((warning) => text(warning)).join(', ')}`).join(' · ')}
          </div>
        )}

        {dominant && (
          <div style={{ ...ui.small, fontSize: 8.5, color: '#cbd5e1', marginTop: 5 }}>
            Faktor dominan: <strong style={{ color: '#67e8f9' }}>{text(dominant.label)}</strong>
            {' '}({text(dominant.impact, 'Belum dinilai')} · kontrib {signed(dominant.contribution, 3)} · corr {formatCorrelation(dominant.correlationD1)} · stab {text(dominant.stability?.status, 'UNKNOWN')} · bobot {formatWeight(dominant.weight)}).
          </div>
        )}

        <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 5 }}>
          {data?.generatedAt ? `Data dianalisis ${formatTime(data.generatedAt)} · refresh otomatis 60 dtk.` : 'Menunggu respons sumber data.'}
          {' '}Korelasi historis bukan sebab-akibat.
        </div>
      </div>

      {!data && loading && (
        <div style={{ ...ui.card, ...ui.small }}>
          Memuat DXY, US10Y, US real yield, US02Y, dan Oil dari provider…
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 6 }}>
        {instruments.map((instrument) => (
          <InstrumentCard
            key={instrument.id}
            instrument={instrument}
            metric={metricById.get(instrument.id)}
            now={now}
          />
        ))}
      </div>

      <CryptoRiskSentimentSection crypto={analysis?.crypto || data?.crypto} now={now} />

      <div style={ui.card}>
        <div style={ui.label}>ARAH D1 &amp; H4</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, minWidth: 520 }}>
            <thead>
              <tr>
                {['INSTRUMEN', 'PERAN', 'D1', 'H4', 'CORR D1', 'STAB', 'BOBOT', 'PENGARUH'].map((heading) => (
                  <th key={heading} style={{ textAlign: 'left', padding: '3px 4px', color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.2)', fontWeight: 800 }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instruments.map((instrument) => {
                const metric = metricById.get(instrument.id);
                return (
                  <tr key={`row-${instrument.id}`}>
                    <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)', color: '#e2e8f0', fontWeight: 800 }}>
                      {text(instrument.symbol)}
                    </td>
                    <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)', color: '#94a3b8' }}>
                      {ROLE_LABEL[instrument.role] || text(instrument.role, '—')}
                    </td>
                    <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                      <TrendPill trend={instrument.d1?.trend} />
                    </td>
                    <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                      {instrument.h4?.available ? <TrendPill trend={instrument.h4?.trend} /> : <Pill text="N/A" color="#64748b" />}
                    </td>
                    <td style={{ ...ui.mono, padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)', color: '#cbd5e1' }}>
                      {formatCorrelation(metric?.correlationD1?.r)}
                    </td>
                    <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                      <span style={{ color: STABILITY_COLOR[metric?.correlationD1?.stability?.status] || '#64748b' }}>
                        {text(metric?.correlationD1?.stability?.status, 'UNKNOWN')}
                      </span>
                    </td>
                    <td style={{ ...ui.mono, padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)', color: '#cbd5e1' }}>
                      {formatWeight(metric?.weight)}
                    </td>
                    <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)', color: IMPACT_COLOR[impactText(metric).split(' · ')[0]] || '#94a3b8' }}>
                      {impactText(metric)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FactorList
        title="FAKTOR PENDUKUNG GOLD UP"
        items={analysis?.supportsUp || []}
        tone="up"
        emptyText="Belum ada faktor tervalidasi yang mendukung Gold naik."
      />

      <FactorList
        title="FAKTOR PENDUKUNG GOLD DOWN"
        items={analysis?.supportsDown || []}
        tone="down"
        emptyText="Belum ada faktor tervalidasi yang mendukung Gold turun."
      />

      <div style={ui.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ ...ui.label, color: 'rgba(251,191,36,0.85)' }}>FAKTOR KONFLIK</div>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 8, color: '#64748b' }}>{(analysis?.conflicts || []).length} item</span>
        </div>
        {(analysis?.conflicts || []).length === 0 ? (
          <div style={{ ...ui.small, fontSize: 9, color: '#64748b' }}>Tidak ada konflik terdeteksi pada data yang tervalidasi.</div>
        ) : analysis.conflicts.map((conflict, index) => (
          <div key={`${conflict.id}-${conflict.type}-${index}`} style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 4, marginTop: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 900, color: '#fbbf24' }}>{text(conflict.symbol)}</span>
            <span style={{ ...ui.small, fontSize: 8.5, marginLeft: 5 }}>{text(conflict.reason)}</span>
          </div>
        ))}
        {(analysis?.unvalidated || []).length > 0 && (
          <div style={{ ...ui.small, fontSize: 7.5, color: '#64748b', marginTop: 5 }}>
            Belum tervalidasi (tidak diberi bobot): {(analysis.unvalidated || []).map((item) => `${text(item.symbol)} — ${text(item.reason)}`).join(' · ')}
          </div>
        )}
      </div>

      <OilCard oil={analysis?.oil} />

      <div style={{ ...ui.card, borderColor: 'rgba(0,229,255,0.28)' }}>
        <div style={ui.label}>KESIMPULAN AI JIN</div>
        <div style={{ ...ui.small, fontSize: 9.5, lineHeight: 1.65, color: '#dbeafe' }}>
          {error && !analysis
            ? `Data sumber belum tersedia. ${text(error)}`
            : text(analysis?.narrative, 'Menunggu analisis.')}
        </div>
        {analysis?.cryptoNarrative && (
          <div style={{ ...ui.small, fontSize: 8.5, lineHeight: 1.6, color: '#c4b5fd', marginTop: 4 }}>
            {text(analysis.cryptoNarrative)}
          </div>
        )}
        {!analysis && !error && (
          <div style={{ ...ui.small, fontSize: 8, color: '#fbbf24', marginTop: 5 }}>
            Kesimpulan belum dibuat karena payload analisis belum diterima. Kartu instrumen tetap ditampilkan
            dengan status UNAVAILABLE agar sumber data yang belum merespons terlihat jelas.
          </div>
        )}
        <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 6, lineHeight: 1.55 }}>
          {(data?.integrity?.notes || []).map((note) => <div key={text(note)}>• {text(note)}</div>)}
          <div>• Bobot dikalibrasi dari korelasi historis tervalidasi; instrumen dalam grup pengaruh yang sama tidak dihitung dua kali.</div>
          <div>• Oil tidak memakai aturan tetap “naik = Gold naik”; arah pengaruhnya mengikuti korelasi historis yang tervalidasi.</div>
          {Object.values(providerSummary).filter((value) => typeof value === 'string').length > 0 && (
            <div>• Sumber: {Object.values(providerSummary).filter((value) => typeof value === 'string').join(' · ')}</div>
          )}
          {data?.calcVersion && <div>• Calc version: {text(data.calcVersion)}</div>}
        </div>
      </div>
    </div>
  );
}
