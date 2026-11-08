/**
 * JinGoldOrderFlowPanel.jsx
 * JIN GOLD ORDER FLOW — aggressor-side volume monitor.
 *
 * Text/sign presentation only: no footprint, no heatmap, no extra chart.
 * Data is real Binance PAXG/USDT aggregated trades; COMEX GC is explicitly
 * UNAVAILABLE until a CME tape feed is configured. Nothing is simulated.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGoldOrderFlow, displayText } from '../../services/trading/goldOrderFlowClient.js';

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

const STATUS_COLOR = {
  LIVE: '#34d399',
  DELAYED: '#fbbf24',
  STALE: '#fb7185',
  UNAVAILABLE: '#94a3b8',
};

const BIAS_COLOR = {
  'BUYER DOMINANT': '#34d399',
  'SELLER DOMINANT': '#fb7185',
  NEUTRAL: '#94a3b8',
};

const CVD_COLOR = {
  POSITIVE: '#34d399',
  NEGATIVE: '#fb7185',
  FLAT: '#94a3b8',
  UNKNOWN: '#64748b',
};

const CLASSIFICATION_COLOR = {
  EXCHANGE_AGGRESSOR: '#38bdf8',
  MIXED: '#a78bfa',
  ESTIMATED: '#fbbf24',
  UNKNOWN: '#64748b',
};

const CLASSIFICATION_LABEL = {
  EXCHANGE_AGGRESSOR: 'REAL · EXCHANGE AGGRESSOR',
  MIXED: 'MIXED SIDE DATA',
  ESTIMATED: 'ESTIMATED · TICK RULE',
  UNKNOWN: 'UNKNOWN',
};

const ABSORPTION_COLOR = {
  DETECTED: '#fbbf24',
  NOT_DETECTED: '#94a3b8',
  UNKNOWN: '#64748b',
};

const READING_RULES = [
  { sign: '▲', title: 'AGGRESSIVE BUY', detail: 'Transaksi agresif pada sisi Ask', color: '#34d399' },
  { sign: '▼', title: 'AGGRESSIVE SELL', detail: 'Transaksi agresif pada sisi Bid', color: '#fb7185' },
  { sign: '◆', title: 'ABSORPTION', detail: 'Volume besar diserap tanpa pergerakan harga sebanding', color: '#fbbf24' },
  { sign: '●', title: 'NEUTRAL', detail: 'Belum ada dominasi yang jelas', color: '#94a3b8' },
];

function Pill({ text: labelText, color, active = true, title }) {
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

function formatPercent(value, digits = 1) {
  return Number.isFinite(value) ? `${value.toFixed(digits)}%` : '—';
}

function formatSigned(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 100_000 ? 2 : 2,
  }).format(value);
}

function formatBase(value) {
  return Number.isFinite(value) ? `${value.toFixed(3)} PAXG` : '—';
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
  const seconds = Math.floor(Math.max(0, now - time) / 1000);
  if (seconds < 60) return `${seconds} dtk`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt`;
  return `${Math.floor(minutes / 60)} jam`;
}

function AggressionRow({ side, percentage, base, quote }) {
  const buy = side === 'BUY';
  const color = buy ? '#34d399' : '#fb7185';
  const arrow = buy ? '▲' : '▼';
  const label = buy ? 'AGGRESSIVE BUY' : 'AGGRESSIVE SELL';
  const detail = buy ? 'Buyer mengambil likuiditas Ask' : 'Seller menekan likuiditas Bid';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 7,
        padding: '6px 0',
        borderTop: '1px solid rgba(148,163,184,0.1)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 13, color, fontWeight: 900 }}>{arrow}</span>
      <span style={{ fontSize: 10, color, fontWeight: 900, letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 8, color: '#64748b' }}>{detail}</span>
      <span style={{ flex: 1 }} />
      <span style={{ ...ui.mono, fontSize: 20, fontWeight: 900, color }}>{formatPercent(percentage)}</span>
      <span style={{ ...ui.mono, fontSize: 8, color: '#94a3b8' }}>{formatBase(base)}</span>
      <span style={{ ...ui.mono, fontSize: 8, color: '#64748b' }}>· {formatMoney(quote)}</span>
    </div>
  );
}

function ReadingRules() {
  return (
    <div style={ui.card}>
      <div style={ui.label}>ATURAN PEMBACAAN JIN</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, minWidth: 360 }}>
          <thead>
            <tr>
              {['SIGN', 'KETERANGAN'].map((heading) => (
                <th
                  key={heading}
                  style={{
                    textAlign: 'left',
                    padding: '3px 4px',
                    color: '#94a3b8',
                    borderBottom: '1px solid rgba(148,163,184,0.2)',
                    fontWeight: 800,
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {READING_RULES.map((rule) => (
              <tr key={rule.title}>
                <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)', whiteSpace: 'nowrap' }}>
                  <span style={{ color: rule.color, fontWeight: 900 }}>{rule.sign} {rule.title}</span>
                </td>
                <td style={{ padding: '4px 4px', borderBottom: '1px solid rgba(148,163,184,0.08)', color: '#cbd5e1' }}>
                  {rule.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', marginTop: 6, lineHeight: 1.55 }}>
        Persentase Buy/Sell dihitung dari volume transaksi yang diklasifikasikan berdasarkan sisi agresor,
        bukan dari naik-turunnya harga.
      </div>
    </div>
  );
}

export default function JinGoldOrderFlowPanel({ enabled = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      const payload = await fetchGoldOrderFlow({ signal: controller.signal, force });
      if (controller.signal.aborted) return;
      setData(payload);
      setLastRunAt(new Date());
      setNow(Date.now());
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(text(err?.message ?? err, 'Gagal memuat order flow.'));
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
    const timer = setInterval(() => load(), 20_000);
    return () => clearInterval(timer);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [enabled]);

  const status = text(data?.status, error ? 'UNAVAILABLE' : 'UNAVAILABLE');
  const available = data?.ok === true && status !== 'UNAVAILABLE';
  const instrument = data?.instrument || {};
  const comex = data?.comex || {};
  const bias = text(data?.bias, 'NEUTRAL');
  const cvdSign = text(data?.cvdSign, 'UNKNOWN');
  const absorptionStatus = text(data?.absorption?.status, 'UNKNOWN');
  const classification = text(data?.classification, 'UNKNOWN');
  const volume = data?.volume || {};
  const percentages = data?.percentages || {};
  const windowInfo = data?.window || {};

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
              JIN — GOLD ORDER FLOW
            </div>
            <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 2 }}>
              Aggressor-side volume monitor · transaksi aktual, bukan ilustrasi
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
          <Pill text={text(instrument.symbol, 'PAXGUSDT')} color="#67e8f9" active={Boolean(instrument.symbol)} />
          <Pill text={text(instrument.label, 'PAXG/USDT (Gold token)')} color="#8aa0b8" />
          <Pill text={text(instrument.venue, 'BINANCE SPOT')} color="#8aa0b8" />
          <Pill
            text={`STATUS ${status}`}
            color={STATUS_COLOR[status] || '#94a3b8'}
            active={Boolean(STATUS_COLOR[status])}
          />
          <Pill
            text={CLASSIFICATION_LABEL[classification] || 'UNKNOWN'}
            color={CLASSIFICATION_COLOR[classification] || '#64748b'}
            active={Boolean(CLASSIFICATION_COLOR[classification])}
            title={data?.classificationNote}
          />
        </div>

        <div style={{ ...ui.small, fontSize: 8, marginTop: 5, color: '#fbbf24' }}>
          COMEX GC (GC): {text(comex.status, 'UNAVAILABLE')} — {text(comex.reason, 'feed CME/COMEX belum tersedia.')}
        </div>

        {error && (
          <div style={{ ...ui.small, fontSize: 8.5, color: '#fda4af', marginTop: 5 }}>
            {text(error)} — tidak ada angka pengganti yang ditampilkan.
          </div>
        )}
      </div>

      {!available ? (
        <div style={{ ...ui.card, borderColor: 'rgba(251,113,133,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ ...ui.label, marginBottom: 0, color: '#fda4af' }}>ORDER FLOW UNAVAILABLE</div>
            <span style={{ flex: 1 }} />
            <Pill text="UNAVAILABLE" color="#94a3b8" />
          </div>
          <div style={{ ...ui.small, fontSize: 9, color: '#fecdd3', marginTop: 5 }}>
            {text(data?.error || error, 'Tape aggressor-side tidak tersedia.')}
          </div>
          <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 4 }}>
            Panel tidak membuat data simulasi. Persentase Buy/Sell, CVD, dan volume akan tampil hanya
            setelah feed trade Binance tersedia.
          </div>
        </div>
      ) : (
        <>
          <div style={ui.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={ui.label}>AGGRESSIVE VOLUME</div>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 8, color: '#64748b' }}>
                {windowInfo.trades ?? 0} trade · window {formatAge(windowInfo.firstTradeAt, new Date(windowInfo.lastTradeAt || now).getTime())}
              </span>
            </div>
            <AggressionRow
              side="BUY"
              percentage={percentages.buy}
              base={volume.buyBase}
              quote={volume.buyQuote}
            />
            <AggressionRow
              side="SELL"
              percentage={percentages.sell}
              base={volume.sellBase}
              quote={volume.sellQuote}
            />
            {Number.isFinite(percentages.neutral) && percentages.neutral > 0.01 && (
              <div style={{ ...ui.small, fontSize: 8, color: '#64748b', marginTop: 3 }}>
                ● NEUTRAL {formatPercent(percentages.neutral)} · {formatBase(volume.neutralBase)}
              </div>
            )}
          </div>

          <div style={ui.card}>
            <div style={ui.label}>ORDER FLOW BIAS</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: BIAS_COLOR[bias] || '#94a3b8', letterSpacing: '0.02em' }}>
                {bias}
              </span>
              <span style={{ ...ui.mono, fontSize: 9, color: '#94a3b8' }}>
                imbalance {Number.isFinite(data?.imbalance) ? `${formatSigned(data.imbalance * 100, 1)}%` : '—'}
              </span>
              {data?.insufficientSample && <Pill text="SAMPEL TIPIS" color="#fbbf24" />}
            </div>
            <div style={{ ...ui.small, fontSize: 8, color: '#94a3b8', marginTop: 3 }}>{text(data?.biasReason, '')}</div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, letterSpacing: '0.06em' }}>CVD</div>
                <div style={{ ...ui.mono, fontSize: 11, fontWeight: 900, color: CVD_COLOR[cvdSign] || '#94a3b8' }}>
                  {cvdSign === 'POSITIVE' ? 'POSITIVE ▲' : cvdSign === 'NEGATIVE' ? 'NEGATIVE ▼' : 'FLAT ●'}
                </div>
                <div style={{ ...ui.small, fontSize: 8 }}>
                  {formatSigned(data?.cvd, 3)} PAXG · {formatMoney(data?.cvdQuote)}
                </div>
              </div>
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, letterSpacing: '0.06em' }}>VOLUME</div>
                <div style={{ ...ui.mono, fontSize: 11, fontWeight: 900, color: data?.volumeLevel === 'HIGH' ? '#fbbf24' : '#cbd5e1' }}>
                  {text(data?.volumeLevel, 'UNKNOWN')}
                </div>
                <div style={{ ...ui.small, fontSize: 8 }}>
                  {Number.isFinite(data?.volumeRatio) ? `${data.volumeRatio.toFixed(2)}x vs paruh awal` : 'rasio belum tersedia'}
                </div>
              </div>
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800, letterSpacing: '0.06em' }}>ABSORPTION</div>
                <div style={{ ...ui.mono, fontSize: 11, fontWeight: 900, color: ABSORPTION_COLOR[absorptionStatus] || '#64748b' }}>
                  ◆ {absorptionStatus}
                </div>
                <div style={{ ...ui.small, fontSize: 8 }}>
                  {data?.absorption?.side ? `sisi ${text(data.absorption.side)} · ` : ''}
                  {text(data?.absorption?.note, '')}
                </div>
              </div>
            </div>
          </div>

          <div style={ui.card}>
            <div style={ui.label}>VOLUME &amp; IMBALANCE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 6 }}>
              <div>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>TOTAL TRADED VOLUME</div>
                <div style={{ ...ui.mono, fontSize: 10, fontWeight: 900, color: '#e2e8f0' }}>{formatMoney(volume.totalQuote)}</div>
                <div style={{ ...ui.mono, fontSize: 8, color: '#94a3b8' }}>{formatBase(volume.totalBase)}</div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>VOLUME IMBALANCE</div>
                <div style={{ ...ui.mono, fontSize: 10, fontWeight: 900, color: (data?.imbalance || 0) > 0 ? '#34d399' : (data?.imbalance || 0) < 0 ? '#fb7185' : '#94a3b8' }}>
                  {Number.isFinite(data?.imbalance) ? `${formatSigned(data.imbalance * 100, 1)}%` : '—'}
                </div>
                <div style={{ ...ui.mono, fontSize: 8, color: '#94a3b8' }}>delta {formatSigned(data?.delta, 3)} PAXG</div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>DELTA NOTIONAL</div>
                <div style={{ ...ui.mono, fontSize: 10, fontWeight: 900, color: (data?.deltaQuote || 0) > 0 ? '#34d399' : (data?.deltaQuote || 0) < 0 ? '#fb7185' : '#94a3b8' }}>
                  {formatMoney(data?.deltaQuote)}
                </div>
                <div style={{ ...ui.small, fontSize: 8 }}>harga {formatMoney(data?.price?.last)}</div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 800 }}>WINDOW</div>
                <div style={{ ...ui.mono, fontSize: 10, fontWeight: 900, color: '#e2e8f0' }}>{windowInfo.trades ?? 0} trade</div>
                <div style={{ ...ui.small, fontSize: 8 }}>
                  {formatTime(windowInfo.firstTradeAt)} → {formatTime(windowInfo.lastTradeAt)}
                </div>
              </div>
            </div>
            <div style={{ ...ui.small, fontSize: 7.5, color: '#64748b', marginTop: 5 }}>
              {formatTime(windowInfo.lastTradeAt)} · usia {formatAge(windowInfo.lastTradeAt, now)}
              {' '}· {text(data?.source?.provider, 'Binance Spot')} {text(data?.source?.symbol, '')}
              {data?.source?.sourceUrl ? (
                <a href={data.source.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', marginLeft: 4 }}>
                  sumber
                </a>
              ) : null}
              {lastRunAt ? ` · refresh ${lastRunAt.toLocaleTimeString('id-ID')}` : ''}
            </div>
            {data?.classificationNote && (
              <div style={{ ...ui.small, fontSize: 7.5, color: '#64748b', marginTop: 2 }}>
                {text(data.classificationNote)}
              </div>
            )}
          </div>
        </>
      )}

      <ReadingRules />

      <div style={ui.card}>
        <div style={ui.label}>CATATAN INTEGRITAS</div>
        <div style={{ ...ui.small, fontSize: 7.5, color: '#475569', lineHeight: 1.55 }}>
          {(data?.notes || [
            'PAXG/USDT adalah token emas di Binance, BUKAN COMEX GC.',
            'Persentase dihitung dari volume trade berdasarkan sisi agresor, bukan dari naik-turunnya harga.',
            'Ini bukan institutional buying/selling: identitas institusi tidak diketahui.',
            'Jika feed tidak tersedia, panel menampilkan UNAVAILABLE tanpa data simulasi.',
          ]).map((note) => <div key={text(note)}>• {text(note)}</div>)}
        </div>
      </div>
    </div>
  );
}
