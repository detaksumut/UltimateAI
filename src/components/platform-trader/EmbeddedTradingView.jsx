/**
 * EmbeddedTradingView.jsx
 * TradingView widget embed for UltimateAI Platform Trader.
 * Includes BUY/SELL order bar overlay below the chart with real-time bid/ask prices
 * and transparent provider attribution (TradingView chart vs. XM MT5 execution route).
 */

import React, { useState } from 'react';

const SYMBOL_MAP = {
  XAUUSD: 'OANDA:XAUUSD',
  BTCUSDT: 'BINANCE:BTCUSDT',
  ETHUSDT: 'BINANCE:ETHUSDT',
  EURUSD: 'OANDA:EURUSD',
  GBPUSD: 'OANDA:GBPUSD',
  US30: 'CAPITALCOM:US30',
  XAU: 'OANDA:XAUUSD',
};

function getTradingViewSymbol(instrument) {
  let base = String(instrument || '')
    .replace(/^OANDA:/i, '')
    .replace(/^BINANCE:/i, '')
    .replace(/^CAPITALCOM:/i, '')
    .replace(/^TVC:/i, '')
    .trim()
    .toUpperCase();

  if (base === 'US30' || base === 'DJI') return 'CAPITALCOM:US30';
  if (base === 'XAUUSD' || base === 'XAU') return 'OANDA:XAUUSD';
  if (base === 'BTCUSDT') return 'BINANCE:BTCUSDT';
  if (base === 'ETHUSDT') return 'BINANCE:ETHUSDT';
  if (base === 'EURUSD') return 'OANDA:EURUSD';
  if (base === 'GBPUSD') return 'OANDA:GBPUSD';

  return base ? `${base}` : 'OANDA:XAUUSD';
}

function getTradingViewInterval(timeframe) {
  const tf = String(timeframe || 'H1').toUpperCase();
  return { M1: '1', M5: '5', M15: '15', M30: '30', H1: '60', H4: '240', D1: 'D' }[tf] || '60';
}

function getTimeframeLabel(timeframe) {
  const tf = String(timeframe || 'H1').toUpperCase();
  return { M1: 'M1', M5: 'M5', M15: 'M15', M30: 'M30', H1: 'H1', H4: 'H4', D1: 'D1' }[tf] || 'H1';
}

export default function EmbeddedTradingView({
  instrument = 'XAUUSD',
  timeframe = 'M1',
  onTimeframeChange = null,
  dataStatus = 'WAITING',
  source = 'XM_GLOBAL_MT5',
  isLive = true,
  currentPrice = null,
  spread = '—',
  signal = null,
  openPositions = [],
  onClosePosition = null,
  onBuyClick = null,
  onSellClick = null,
}) {
  const [buyHover, setBuyHover] = useState(false);
  const [sellHover, setSellHover] = useState(false);

  const symbol    = getTradingViewSymbol(instrument);
  const interval  = getTradingViewInterval(timeframe);
  const tvLabel   = getTimeframeLabel(timeframe);

  // Calculate live bid / ask from broker quote
  const spreadVal = Number.isFinite(Number(spread)) ? Number(spread) : 0;
  const bid       = Number.isFinite(currentPrice) ? currentPrice : null;
  const ask       = bid !== null ? bid + spreadVal : null;

  const isSignalBuy  = signal?.side === 'BUY'  && signal?.isValid === true;
  const isSignalSell = signal?.side === 'SELL' && signal?.isValid === true;

  const isMt5Source = source === 'XM_GLOBAL_MT5' || source === 'MT5_LOCAL_BRIDGE';
  const brokerName  = isMt5Source ? 'XM Global MT5 (GOLD)' : source || 'Bridge Terputus';

  // TradingView widget URL
  const widgetUrl = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    symbol
  )}&interval=${encodeURIComponent(interval)}&hidesidebar=0&symboledit=1&saveimage=1&toolbarbg=030812&studies=[]&theme=dark&style=1&timezone=Asia%2FJakarta&withdateranges=1&hideideas=1`;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(0, 229, 255, 0.15)',
        borderRadius: 9,
        background: '#030812',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* ── TradingView Chart iframe ── */}
      <div style={{ position: 'relative', width: '100%', height: 520, minHeight: 520 }}>
        <iframe
          title={`TradingView ${instrument} ${tvLabel}`}
          src={widgetUrl}
          style={{ width: '100%', height: 520, border: 0, display: 'block' }}
          allowFullScreen
          sandbox="allow-scripts allow-same-origin"
        />

        {/* ── Active On-Chart Position Overlay on TradingView ── */}
        {Array.isArray(openPositions) && openPositions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              zIndex: 10,
              maxWidth: '85%',
              pointerEvents: 'auto',
            }}
          >
            {openPositions.map((pos) => {
              const isBuy = pos.side === 'BUY';
              const isProfit = (pos.floatingPl || 0) >= 0;
              return (
                <div
                  key={pos.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(3, 15, 30, 0.94)',
                    border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)'}`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: 8.5,
                      fontWeight: 900,
                      background: isBuy ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
                      color: isBuy ? '#34d399' : '#fb7185',
                    }}
                  >
                    {pos.side}
                  </span>
                  {pos.tp1Hit && (
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontSize: 8,
                        fontWeight: 900,
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                      }}
                    >
                      TP1 PARTIAL
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                    {pos.lotSize} lot @ ${pos.entryPrice?.toFixed(2)}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 900,
                      color: isProfit ? '#34d399' : '#fb7185',
                      fontFamily: 'monospace',
                    }}
                  >
                    {isProfit ? '+' : ''}${pos.floatingPl?.toFixed(2)}
                  </span>
                  {onClosePosition && (
                    <button
                      onClick={() => onClosePosition(pos.id, null, 'CHART MANUAL CLOSE', 1.0)}
                      title="Tutup posisi ini langsung dari chart"
                      style={{
                        marginLeft: 4,
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 900,
                        background: 'rgba(244, 63, 94, 0.2)',
                        border: '1px solid rgba(244, 63, 94, 0.5)',
                        color: '#fb7185',
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Close
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dual-Provider Identity Bar ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          background: 'rgba(2, 6, 23, 0.95)',
          borderTop: '1px solid rgba(0, 229, 255, 0.1)',
          fontSize: 8.5,
          color: '#64748b',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#38bdf8' }}>📊 Visual Feed:</span>
          <strong style={{ color: '#cbd5e1' }}>{symbol} (TradingView)</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: isLive ? '#34d399' : '#fb7185' }}>
            {isLive ? '●' : '○'} Eksekusi Order:
          </span>
          <strong style={{ color: isLive ? '#34d399' : '#fb7185' }}>
            {brokerName}
          </strong>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 3,
              fontSize: 7.5,
              fontWeight: 800,
              background: isLive ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)',
              color: isLive ? '#34d399' : '#fb7185',
              border: `1px solid ${isLive ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`,
            }}
          >
            {isLive ? 'LIVE XM MT5' : 'DATA STALE / OFFLINE'}
          </span>
        </div>
      </div>

      {/* ── BUY / SELL Order Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
          padding: '9px 12px',
          background: 'linear-gradient(180deg, rgba(5,12,28,0.98) 0%, rgba(3,8,20,0.99) 100%)',
          borderTop: '1px solid rgba(0, 229, 255, 0.08)',
        }}
      >
        {/* SELL button */}
        <button
          onClick={() => onSellClick?.()}
          onMouseEnter={() => setSellHover(true)}
          onMouseLeave={() => setSellHover(false)}
          aria-label={`SELL ${instrument} at ${bid?.toFixed(2) ?? '—'}`}
          style={{
            flex: 1,
            padding: '11px 8px',
            borderRadius: 8,
            background: isSignalSell || sellHover
              ? 'linear-gradient(135deg, #dc2626 0%, #9f1239 100%)'
              : 'rgba(220, 38, 38, 0.1)',
            border: `1px solid ${isSignalSell ? '#f43f5e' : 'rgba(244,63,94,' + (sellHover ? '0.6' : '0.3') + ')'}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            boxShadow: isSignalSell ? '0 0 18px rgba(244,63,94,0.35)' : sellHover ? '0 0 10px rgba(244,63,94,0.2)' : 'none',
            transition: 'all 0.18s ease',
          }}
        >
          <span style={{ fontSize: 9, color: '#fca5a5', fontWeight: 800, letterSpacing: '0.08em' }}>
            SELL
          </span>
          <span style={{
            fontSize: 16,
            color: '#ffffff',
            fontWeight: 900,
            fontFamily: 'monospace',
            letterSpacing: '0.02em',
          }}>
            {bid !== null ? bid.toFixed(2) : '—'}
          </span>
          {isSignalSell ? (
            <span style={{ fontSize: 7.5, color: '#fca5a5', fontWeight: 700, letterSpacing: '0.03em' }}>
              ● SINYAL AKTIF
            </span>
          ) : (
            <span style={{ fontSize: 7.5, color: '#64748b' }}>Bid XM MT5</span>
          )}
        </button>

        {/* Center: Spread & Info */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          minWidth: 74,
        }}>
          <div style={{ fontSize: 7.5, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Spread Broker
          </div>
          <div style={{
            fontSize: 12,
            color: '#00e5ff',
            fontFamily: 'monospace',
            fontWeight: 800,
          }}>
            {spread}
          </div>
          <div style={{
            fontSize: 8,
            color: '#64748b',
            fontWeight: 700,
            letterSpacing: '0.03em',
          }}>
            {instrument} (GOLD)
          </div>
          {(isSignalBuy || isSignalSell) && (
            <div style={{
              fontSize: 7,
              color: isSignalBuy ? '#34d399' : '#fb7185',
              fontWeight: 800,
              marginTop: 2,
              letterSpacing: '0.03em',
            }}>
              {isSignalBuy ? '▲ BUY' : '▼ SELL'} CONF
            </div>
          )}
        </div>

        {/* BUY button */}
        <button
          onClick={() => onBuyClick?.()}
          onMouseEnter={() => setBuyHover(true)}
          onMouseLeave={() => setBuyHover(false)}
          aria-label={`BUY ${instrument} at ${ask?.toFixed(2) ?? '—'}`}
          style={{
            flex: 1,
            padding: '11px 8px',
            borderRadius: 8,
            background: isSignalBuy || buyHover
              ? 'linear-gradient(135deg, #16a34a 0%, #065f46 100%)'
              : 'rgba(22, 163, 74, 0.1)',
            border: `1px solid ${isSignalBuy ? '#10b981' : 'rgba(16,185,129,' + (buyHover ? '0.6' : '0.3') + ')'}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            boxShadow: isSignalBuy ? '0 0 18px rgba(16,185,129,0.35)' : buyHover ? '0 0 10px rgba(16,185,129,0.2)' : 'none',
            transition: 'all 0.18s ease',
          }}
        >
          <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800, letterSpacing: '0.08em' }}>
            BUY
          </span>
          <span style={{
            fontSize: 16,
            color: '#ffffff',
            fontWeight: 900,
            fontFamily: 'monospace',
            letterSpacing: '0.02em',
          }}>
            {ask !== null ? ask.toFixed(2) : '—'}
          </span>
          {isSignalBuy ? (
            <span style={{ fontSize: 7.5, color: '#86efac', fontWeight: 700, letterSpacing: '0.03em' }}>
              ● SINYAL AKTIF
            </span>
          ) : (
            <span style={{ fontSize: 7.5, color: '#64748b' }}>Ask XM MT5</span>
          )}
        </button>
      </div>
    </div>
  );
}

/** @deprecated Use EmbeddedTradingView instead */
export function LegacyCandlestickChart() {
  return null;
}
