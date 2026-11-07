import React, { useState } from 'react';

/**
 * MultiTimeframePanel
 * Displays real multi-timeframe analysis (D1, H4, H1, M15, M5) for XAUUSD.
 * Shows bias, RSI, ATR, price, and candle count per TF.
 * Expandable rows for detailed per-TF info.
 * Alignment summary banner for quick decision-making.
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRsiLabel(rsi) {
  if (!Number.isFinite(rsi)) return { label: '—', color: '#64748b' };
  if (rsi >= 70) return { label: `${rsi.toFixed(1)} OB`, color: '#f43f5e' };
  if (rsi >= 60) return { label: `${rsi.toFixed(1)} ↑`, color: '#fbbf24' };
  if (rsi <= 30) return { label: `${rsi.toFixed(1)} OS`, color: '#10b981' };
  if (rsi <= 40) return { label: `${rsi.toFixed(1)} ↓`, color: '#fbbf24' };
  return { label: `${rsi.toFixed(1)}`, color: '#94a3b8' };
}

function getFreshnessLabel(freshness, source) {
  if (source === 'VISUAL') return { text: 'VISUAL AI', color: '#a78bfa' };
  if (freshness === 'STALE') return { text: 'STALE', color: '#fbbf24' };
  if (freshness === 'NO_DATA') return { text: 'WAIT', color: '#64748b' };
  return { text: 'OHLC', color: '#67e8f9' };
}

function biasPalette(bias) {
  if (bias === 'BULLISH') return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' };
  if (bias === 'BEARISH') return { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.35)'  };
  if (bias === 'SIDEWAYS') return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)' };
  return { color: '#94a3b8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' };
}

// ── Alignment Summary ──────────────────────────────────────────────────────────

function AlignmentSummary({ tfData }) {
  const TFS = ['H4', 'H1', 'M15', 'M5'];
  const biases = TFS.map(tf => tfData?.[tf]?.bias || 'UNKNOWN');
  const bullCount = biases.filter(b => b === 'BULLISH').length;
  const bearCount = biases.filter(b => b === 'BEARISH').length;
  const hasData   = biases.some(b => b !== 'UNKNOWN' && b !== 'INSUFFICIENT_DATA');

  if (!hasData) return null;

  const isFullBull = bullCount === 4;
  const isFullBear = bearCount === 4;
  const isMajBull  = bullCount >= 3 && !isFullBull;
  const isMajBear  = bearCount >= 3 && !isFullBear;

  let bg, border, color, icon, text;
  if (isFullBull) {
    bg = 'rgba(16,185,129,0.15)'; border = 'rgba(16,185,129,0.4)';
    color = '#34d399'; icon = '🟢';
    text = 'H4·H1·M15·M5 BULLISH — Setup BUY sangat kuat';
  } else if (isFullBear) {
    bg = 'rgba(244,63,94,0.15)'; border = 'rgba(244,63,94,0.4)';
    color = '#fb7185'; icon = '🔴';
    text = 'H4·H1·M15·M5 BEARISH — Setup SELL sangat kuat';
  } else if (isMajBull) {
    bg = 'rgba(16,185,129,0.1)'; border = 'rgba(16,185,129,0.25)';
    color = '#6ee7b7'; icon = '🟡';
    text = `${bullCount}/4 TF BULLISH — Konfirmasi entry BUY dengan hati-hati`;
  } else if (isMajBear) {
    bg = 'rgba(244,63,94,0.1)'; border = 'rgba(244,63,94,0.25)';
    color = '#fca5a5'; icon = '🟡';
    text = `${bearCount}/4 TF BEARISH — Konfirmasi entry SELL dengan hati-hati`;
  } else {
    bg = 'rgba(251,191,36,0.08)'; border = 'rgba(251,191,36,0.2)';
    color = '#fbbf24'; icon = '⚠️';
    text = `TF belum selaras (↑${bullCount} ↓${bearCount}) — Tunggu konfirmasi`;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 7, padding: '7px 10px',
      transition: 'all 0.3s ease',
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div style={{ flex: 1, fontSize: 9.5, color, fontWeight: 700, lineHeight: 1.4 }}>
        {text}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {TFS.map((tf, i) => {
          const b = biases[i];
          const c = b === 'BULLISH' ? '#10b981' : b === 'BEARISH' ? '#f43f5e' : '#475569';
          return (
            <div key={tf} style={{
              width: 28, height: 28, borderRadius: 5,
              background: `${c}18`,
              border: `1px solid ${c}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7.5, fontWeight: 900, color: c, fontFamily: 'monospace',
            }}>
              {tf}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TF Row ─────────────────────────────────────────────────────────────────────

function TfRow({ item, isMacro, expanded, onToggle }) {
  const { tf, bias, trend, count, freshness, price, atr, rsi, source } = item;
  const palette  = biasPalette(bias);
  const rsiInfo  = getRsiLabel(rsi);
  const freshInfo = getFreshnessLabel(freshness, source);

  const isInsufficient = bias === 'INSUFFICIENT_DATA' || bias === 'UNKNOWN';
  const hasDetail = Number.isFinite(rsi) || Number.isFinite(atr) || Number.isFinite(price);

  return (
    <div style={{ transition: 'all 0.2s ease' }}>
      {/* Main row */}
      <div
        onClick={hasDetail ? onToggle : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          background: 'rgba(2,6,23,0.5)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: expanded ? '6px 6px 0 0' : 6,
          padding: '7px 10px',
          cursor: hasDetail ? 'pointer' : 'default',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={e => { if (hasDetail) e.currentTarget.style.background = 'rgba(2,6,23,0.75)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(2,6,23,0.5)'; }}
      >
        {/* TF pill */}
        <div style={{
          width: 38, flexShrink: 0,
          textAlign: 'center', padding: '3px 0',
          borderRadius: 4, fontSize: 10, fontWeight: 900,
          fontFamily: 'monospace',
          background: palette.bg, color: palette.color, border: `1px solid ${palette.border}`,
        }}>
          {tf}
        </div>

        {/* Trend text */}
        <div style={{ flex: 1, fontSize: 10.5, color: isInsufficient ? '#64748b' : '#e2e8f0', fontWeight: 500, lineHeight: 1.3 }}>
          {trend || (isInsufficient ? 'Menunggu data...' : 'MENUNGGU VERIFIKASI')}
        </div>

        {/* RSI quick badge */}
        {Number.isFinite(rsi) && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: rsiInfo.color,
            fontFamily: 'monospace', flexShrink: 0,
            background: `${rsiInfo.color}18`,
            border: `1px solid ${rsiInfo.color}40`,
            borderRadius: 4, padding: '2px 5px',
          }}>
            RSI {rsiInfo.label}
          </div>
        )}

        {/* Source badge */}
        <div style={{
          fontSize: 7.5, fontWeight: 700, color: freshInfo.color, flexShrink: 0,
          background: `${freshInfo.color}12`,
          border: `1px solid ${freshInfo.color}30`,
          borderRadius: 3, padding: '1px 4px',
        }}>
          {freshInfo.text}
        </div>

        {/* Expand chevron */}
        {hasDetail && (
          <span style={{ color: '#334155', fontSize: 9, flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div style={{
          background: 'rgba(1,4,16,0.6)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          padding: '9px 12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: 7,
          transition: 'all 0.2s ease',
        }}>
          {Number.isFinite(price) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#475569', marginBottom: 3 }}>Harga Terakhir</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace' }}>
                {price.toFixed(2)}
              </div>
            </div>
          )}
          {Number.isFinite(rsi) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#475569', marginBottom: 3 }}>RSI (14)</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: rsiInfo.color, fontFamily: 'monospace' }}>
                {rsi.toFixed(1)}
              </div>
              <div style={{ fontSize: 7.5, color: rsiInfo.color, marginTop: 1 }}>
                {rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : rsi >= 55 ? 'Momentum ↑' : rsi <= 45 ? 'Momentum ↓' : 'Netral'}
              </div>
            </div>
          )}
          {Number.isFinite(atr) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#475569', marginBottom: 3 }}>ATR (14)</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', fontFamily: 'monospace' }}>
                {atr.toFixed(2)}
              </div>
              <div style={{ fontSize: 7.5, color: '#7c3aed', marginTop: 1 }}>Volatilitas</div>
            </div>
          )}
          {count != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#475569', marginBottom: 3 }}>Candle Data</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: count >= 100 ? '#34d399' : '#fbbf24', fontFamily: 'monospace' }}>
                {count}
              </div>
              <div style={{ fontSize: 7.5, color: '#475569', marginTop: 1 }}>candles</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MultiTimeframePanel({
  instrument = 'XAUUSD',
  tfData = {},
  onRunScan = null,
  isScanning = false,
  scanProgress = '',
}) {
  const [expandedTf, setExpandedTf] = useState(null);

  const TIMEFRAMES = [
    { tf: 'D1',  isMacro: true  },
    { tf: 'H4',  isMacro: false },
    { tf: 'H1',  isMacro: false },
    { tf: 'M15', isMacro: false },
    { tf: 'M5',  isMacro: false },
  ];

  const rows = TIMEFRAMES.map(({ tf, isMacro }) => {
    const data = tfData?.[tf] || {};
    const bias  = data.bias || 'UNKNOWN';

    let trendLabel = data.trend;
    if (!trendLabel) {
      const isInsufficient = bias === 'INSUFFICIENT_DATA' || bias === 'UNKNOWN';
      trendLabel = isInsufficient
        ? (data.count != null ? `DATA BELUM CUKUP (${data.count}/20 candle)` : 'DATA BELUM CUKUP')
        : 'MENUNGGU VERIFIKASI';
    }
    if (data.freshness === 'STALE' && !trendLabel.includes('STALE')) {
      trendLabel += ' (DATA STALE)';
    }

    return {
      tf, isMacro, bias, trend: trendLabel,
      count: data.count, freshness: data.freshness,
      price: data.price, atr: data.atr, rsi: data.rsi,
      source: data.source,
    };
  });

  const toggleExpand = tf => setExpandedTf(prev => prev === tf ? null : tf);

  return (
    <div style={{
      background: '#071224',
      border: '1px solid rgba(0, 229, 255, 0.15)',
      borderRadius: 10,
      padding: 14,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#10b981', fontSize: 13 }}>📊</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em' }}>
            Analisis Multi-Timeframe
          </span>
          <span style={{ fontSize: 9, color: '#475569' }}>H4 · H1 · M15 · M5</span>
        </div>
        {onRunScan && (
          <button
            onClick={onRunScan}
            disabled={isScanning}
            style={{
              background: isScanning
                ? 'rgba(0,229,255,0.15)'
                : 'linear-gradient(90deg, rgba(0,229,255,0.2), rgba(16,185,129,0.2))',
              border: '1px solid rgba(0,229,255,0.4)',
              borderRadius: 5, color: '#00e5ff',
              fontSize: 9.5, fontWeight: 800,
              padding: '4px 9px', cursor: isScanning ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.15s ease',
            }}
            title="Jalankan pemindaian otomatis H4, H1, M15, M5"
          >
            {isScanning ? (
              <><span>⏳</span><span>{scanProgress || 'Scanning...'}</span></>
            ) : (
              <><span>⚡</span><span>SCAN 4-TF OTOMATIS</span></>
            )}
          </button>
        )}
      </div>

      {/* Alignment Summary */}
      <AlignmentSummary tfData={tfData} />

      {/* TF Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* D1 Macro context header */}
        <div style={{ fontSize: 8.5, color: '#334155', fontWeight: 700, letterSpacing: '0.05em', paddingLeft: 2, marginBottom: 1 }}>
          MAKRO CONTEXT
        </div>
        <TfRow
          item={rows[0]}
          isMacro={true}
          expanded={expandedTf === 'D1'}
          onToggle={() => toggleExpand('D1')}
        />

        <div style={{ fontSize: 8.5, color: '#334155', fontWeight: 700, letterSpacing: '0.05em', paddingLeft: 2, marginTop: 4, marginBottom: 1 }}>
          4-TF KONDISI REAL (TRADING ZONE)
        </div>
        {rows.slice(1).map(item => (
          <TfRow
            key={item.tf}
            item={item}
            isMacro={false}
            expanded={expandedTf === item.tf}
            onToggle={() => toggleExpand(item.tf)}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 8.5, color: '#1e293b', lineHeight: 1.5 }}>
        Klik baris TF untuk melihat detail RSI, ATR, dan harga. Data dari MT5 OHLC (atau Visual AI jika Screen Capture aktif).
      </div>
    </div>
  );
}
