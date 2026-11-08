import React, { useEffect, useRef, useState, useMemo } from 'react';

/**
 * CandlestickChart
 * Professional trading chart displaying ONLY verified, real market candles.
 * Never synthesizes or fabricates mock candles.
 * 
 * Rules:
 * - High >= max(open, close, low); Low <= min(open, close, high).
 * - Chronologically sorted with duplicates eliminated.
 * - Honest empty-state when no verified candles are delivered.
 * - Toggle to embedded view available.
 */
export default function CandlestickChart({
  instrument = 'XAUUSD',
  symbol = 'XAUUSD',
  timeframe = 'H1',
  onTimeframeChange = null,
  currentPrice = null,
  candles = [],
  dataStatus = 'WAITING',
  source = 'XM Global MT5'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [visibleBars, setVisibleBars] = useState(60); // 40, 60, 100, or 'ALL'
  const timeframes = ["M1", "M5", "M15", "H1", "H4", "D1"];
  // Chart controls
  const [showIndicators, setShowIndicators] = useState(true);
  const [chartType, setChartType] = useState('canvas');

  const [isFullscreen, setIsFullscreen] = useState(false);
  // Format timestamp appropriately based on active timeframe
  const formatTimeLabel = (date, tf) => {
    if (!date || isNaN(date.getTime())) return '';
    if (tf === 'D1') {
      return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })}`;
    }
    if (tf === 'H4') {
      return `${date.getDate()}/${date.getMonth() + 1} ${String(date.getHours()).padStart(2, '0')}:00`;
    }
    if (tf === 'M1') {
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const TF_INTERVAL_MS = {
    M1: 60000,
    M5: 300000,
    M15: 900000,
    H1: 3600000,
    H4: 14400000,
    D1: 86400000
  };

  // Rigorous validation, deduplication, and timeframe integrity check of real candles
  const { validCandles, validationInfo } = useMemo(() => {
    const targetTf = String(timeframe || 'M1').toUpperCase();
    if (!Array.isArray(candles) || candles.length === 0) {
      return {
        validCandles: [],
        validationInfo: { isValid: false, reason: 'NO_DATA', requestedTf: targetTf, actualTf: null, count: 0, lastCandle: null }
      };
    }

    const seenTimes = new Set();
    const validated = [];

    for (const c of candles) {
      if (!c || typeof c !== 'object') continue;

      // Strict timeframe tag check: if candle has a timeframe property, it must match requested timeframe
      if (c.timeframe && String(c.timeframe).toUpperCase() !== targetTf) {
        continue;
      }

      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      const volume = Number(c.volume || c.tick_volume || 0);
      const ts = c.timestamp ? Date.parse(c.timestamp) : (typeof c.time === 'number' ? c.time * 1000 : null);

      if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(ts)) {
        continue;
      }

      // Check OHLC consistency: high must be >= all, low must be <= all
      if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
        continue;
      }

      // Avoid duplicate timestamps
      if (seenTimes.has(ts)) continue;
      seenTimes.add(ts);

      const d = new Date(ts);
      const timeStr = formatTimeLabel(d, targetTf);

      validated.push({
        timestamp: c.timestamp || d.toISOString(),
        timeEpoch: ts,
        timeStr,
        timeframe: targetTf,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) && volume >= 0 ? volume : 0
      });
    }

    // Sort chronologically
    validated.sort((a, b) => a.timeEpoch - b.timeEpoch);

    if (validated.length === 0) {
      return {
        validCandles: [],
        validationInfo: { isValid: false, reason: 'NO_MATCHING_DATA', requestedTf: targetTf, actualTf: null, count: 0, lastCandle: null }
      };
    }

    // Interval delta verification: calculate median delta between consecutive candles
    let detectedTf = null;
    if (validated.length >= 2) {
      const deltas = [];
      const sample = validated.slice(-20);
      for (let i = 1; i < sample.length; i++) {
        const diff = sample[i].timeEpoch - sample[i - 1].timeEpoch;
        if (diff > 0) deltas.push(diff);
      }
      if (deltas.length > 0) {
        deltas.sort((a, b) => a - b);
        const median = deltas[Math.floor(deltas.length / 2)];
        if (median >= 45000 && median <= 75000) detectedTf = 'M1';
        else if (median >= 240000 && median <= 360000) detectedTf = 'M5';
        else if (median >= 750000 && median <= 1050000) detectedTf = 'M15';
        else if (median >= 3000000 && median <= 4200000) detectedTf = 'H1';
        else if (median >= 12000000 && median <= 16000000) detectedTf = 'H4';
        else if (median >= 70000000 && median <= 100000000) detectedTf = 'D1';

        // If detected interval differs significantly from requested timeframe, flag mismatch!
        // Never present candles from another timeframe as valid for the current timeframe.
        if (detectedTf && detectedTf !== targetTf) {
          return {
            validCandles: [],
            validationInfo: {
              isValid: false,
              reason: 'MISMATCH',
              requestedTf: targetTf,
              actualTf: detectedTf,
              count: validated.length,
              lastCandle: validated[validated.length - 1]
            }
          };
        }
      }
    }

    const last = validated[validated.length - 1];
    return {
      validCandles: validated,
      validationInfo: {
        isValid: true,
        reason: 'VALID',
        requestedTf: targetTf,
        actualTf: detectedTf || targetTf,
        count: validated.length,
        lastCandle: last
      }
    };
  }, [candles, timeframe]);

  // Canvas drawing effect for verified candles
  useEffect(() => {
    if (chartType !== 'canvas') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width = canvas.parentElement.clientWidth || 700;
    const height = canvas.height = canvas.parentElement.clientHeight || 420;

    // Background
    ctx.fillStyle = '#040a17';
    ctx.fillRect(0, 0, width, height);

    // If no valid candles available or timeframe mismatch, render clean and honest state
    if (validCandles.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(20, 20, width - 40, height - 40);

      const isMismatch = validationInfo.reason === 'MISMATCH';

      ctx.fillStyle = isMismatch ? '#f43f5e' : '#38bdf8';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      if (isMismatch) {
        ctx.fillText(`TIMEFRAME MISMATCH: DIMINTA ${validationInfo.requestedTf} · TERDETEKSI ${validationInfo.actualTf}`, width / 2, height / 2 - 20);
      } else {
        ctx.fillText(`MENUNGGU DATA CANDLE VALID: ${instrument} (${timeframe})`, width / 2, height / 2 - 20);
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      if (isMismatch) {
        ctx.fillText(`Data ditahan demi akurasi. Menunggu candle sinkron ${validationInfo.requestedTf} dari MT5 Canvas.`, width / 2, height / 2 + 5);
      } else {
        ctx.fillText(`Sumber: ${source} · Status: ${dataStatus}`, width / 2, height / 2 + 5);
      }

      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`Pastikan chart MT5 Canvas pada timeframe ${timeframe} aktif dan terhubung.`, width / 2, height / 2 + 30);
      return;
    }

    // Windowing: Take the most recent N candles (default 60 matching XM/TradingView default view)
    const rawWindow = visibleBars === 'ALL' ? validCandles : validCandles.slice(-visibleBars);
    
    // Bind the active live tick directly into the forming rightmost candle
    const displayCandles = rawWindow.map((c, idx, arr) => {
      if (idx === arr.length - 1 && Number.isFinite(currentPrice) && currentPrice > 0) {
        return {
          ...c,
          close: currentPrice,
          high: Math.max(c.high, currentPrice),
          low: Math.min(c.low, currentPrice)
        };
      }
      return c;
    });

    const priceAxisWidth = 80;
    const timeAxisHeight = 28;
    const volumeHeight = 65;
    const plotWidth = width - priceAxisWidth;
    const plotHeight = height - timeAxisHeight - volumeHeight;

    // Diagnostic watermark in top-left corner
    const lastBar = validationInfo.lastCandle || displayCandles[displayCandles.length - 1];
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    const ohlcText = lastBar
      ? `O:${lastBar.open.toFixed(2)} H:${lastBar.high.toFixed(2)} L:${lastBar.low.toFixed(2)} C:${lastBar.close.toFixed(2)}`
      : '';
    ctx.fillText(`${instrument} · ${timeframe} (MT5 Canvas) · ${displayCandles.length} Bars · ${ohlcText}`, 14, 18);

    // Determine min and max price from actual candles in the visible window
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    displayCandles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    // Also include active live tick in scale range
    if (Number.isFinite(currentPrice) && currentPrice > 0) {
      if (currentPrice < minPrice) minPrice = currentPrice;
      if (currentPrice > maxPrice) maxPrice = currentPrice;
    }

    const padding = (maxPrice - minPrice) * 0.08 || 1.0;
    minPrice -= padding;
    maxPrice += padding;
    const priceRange = maxPrice - minPrice;

    // Coordinate helpers
    const getY = (val) => plotHeight - ((val - minPrice) / (priceRange || 1)) * plotHeight;
    const barSlot = plotWidth / displayCandles.length;
    const candleWidth = Math.max(3, Math.min(18, Math.floor(barSlot * 0.75)));

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (priceRange / gridSteps) * i;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      // Right axis labels
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(2), plotWidth + 8, y + 3.5);
    }

    // Draw Moving Averages (EMA 20 = Blue, EMA 50 = Yellow) calculated from visible history
    if (showIndicators && displayCandles.length >= 20) {
      const calcEMA = (period) => {
        const k = 2 / (period + 1);
        let ema = displayCandles[0].close;
        return displayCandles.map(c => {
          ema = c.close * k + ema * (1 - k);
          return ema;
        });
      };

      const ema20 = calcEMA(20);
      const ema50 = displayCandles.length >= 50 ? calcEMA(50) : null;

      // Draw EMA 50 (Yellow)
      if (ema50) {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        displayCandles.forEach((c, idx) => {
          const x = (idx + 0.5) * barSlot;
          const y = getY(ema50[idx]);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // Draw EMA 20 (Cyan/Blue)
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      displayCandles.forEach((c, idx) => {
        const x = (idx + 0.5) * barSlot;
        const y = getY(ema20[idx]);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Draw Candlesticks & Volume
    displayCandles.forEach((c, idx) => {
      const x = (idx + 0.5) * barSlot;
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);
      const isBullish = c.close >= c.open;
      const candleColor = isBullish ? '#10b981' : '#f43f5e';

      // Candle Wick
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Candle Body
      ctx.fillStyle = candleColor;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

      // Volume Bar at bottom
      const volBarHeight = maxVol > 0 ? (c.volume / maxVol) * (volumeHeight - 12) : 2;
      const volY = height - timeAxisHeight - volBarHeight;
      ctx.fillStyle = isBullish ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';
      ctx.fillRect(x - candleWidth / 2, volY, candleWidth, volBarHeight);

      // Time axis marks
      const step = Math.max(1, Math.floor(displayCandles.length / 7));
      if (idx % step === 0 && c.timeStr) {
        ctx.fillStyle = '#64748b';
        ctx.font = '9.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c.timeStr, x, height - 8);
      }
    });

    // Draw Price Levels from ACTUAL recent candles (last 20)
    const recent = displayCandles.slice(-20);
    const actualResistance = Math.max(...recent.map(c => c.high));
    const actualSupport = Math.min(...recent.map(c => c.low));
    const lastClose = displayCandles[displayCandles.length - 1].close;
    const activePrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : lastClose;

    // Resistance line (Dashed white)
    if (Number.isFinite(actualResistance) && actualResistance >= minPrice && actualResistance <= maxPrice) {
      const resY = getY(actualResistance);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, resY);
      ctx.lineTo(plotWidth, resY);
      ctx.stroke();
      ctx.restore();

      // Badge on right axis
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(plotWidth + 4, resY - 9, priceAxisWidth - 8, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(actualResistance.toFixed(2), plotWidth + (priceAxisWidth / 2), resY + 3.5);
    }

    // Support line (Dashed cyan)
    if (Number.isFinite(actualSupport) && actualSupport >= minPrice && actualSupport <= maxPrice) {
      const supY = getY(actualSupport);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, supY);
      ctx.lineTo(plotWidth, supY);
      ctx.stroke();
      ctx.restore();

      // Badge on right axis
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(plotWidth + 4, supY - 9, priceAxisWidth - 8, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(actualSupport.toFixed(2), plotWidth + (priceAxisWidth / 2), supY + 3.5);
    }

    // Active live price dotted horizontal line & badge
    if (Number.isFinite(activePrice) && activePrice >= minPrice && activePrice <= maxPrice) {
      const lastY = getY(activePrice);
      const isUp = displayCandles.length >= 2 && activePrice >= displayCandles[displayCandles.length - 2].close;
      const badgeBg = isUp ? '#10b981' : '#e11d48';

      // Project line from current bar to right axis
      ctx.save();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = badgeBg;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, lastY);
      ctx.lineTo(plotWidth, lastY);
      ctx.stroke();
      ctx.restore();

      // Live price badge on right axis
      ctx.fillStyle = badgeBg;
      ctx.fillRect(plotWidth + 4, lastY - 9, priceAxisWidth - 8, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(activePrice.toFixed(2), plotWidth + (priceAxisWidth / 2), lastY + 3.5);
    }

  }, [validCandles, validationInfo, currentPrice, visibleBars, showIndicators, chartType, instrument, timeframe, source, dataStatus]);

  return (
    <div
      ref={containerRef}
      style={{
        background: '#040a17',
        border: '1px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
        position: 'relative'
      }}
    >
      {/* Top Header of Chart with Timeframes & Tools */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(7, 18, 36, 0.75)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.12)',
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        {/* Timeframe Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {timeframes.map((tf) => {
            const isActive = timeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => onTimeframeChange && onTimeframeChange(tf)}
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  padding: '5px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: isActive
                    ? '1px solid #38bdf8'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isActive
                    ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  boxShadow: isActive ? '0 0 12px rgba(59, 130, 246, 0.5)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {tf}
              </button>
            );
          })}
        </div>

        {/* Chart Utility Icons on Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Indicators Toggle */}
          <button
            title={showIndicators ? 'Sembunyikan Indikator (EMA)' : 'Tampilkan Indikator (EMA)'}
            style={{
              ...toolBtnStyle,
              color: showIndicators ? '#38bdf8' : '#64748b',
              border: showIndicators ? '1px solid rgba(56, 189, 248, 0.4)' : toolBtnStyle.border
            }}
            onClick={() => setShowIndicators(!showIndicators)}
          >
            IND {showIndicators ? 'ON' : 'OFF'}
          </button>

          {/* Switch chart view (both use verified MT5 canvas) */}
          <button
            title="Beralih tampilan grafik MT5"
            style={{
              ...toolBtnStyle,
              background: chartType === 'tradingview' ? 'rgba(0, 229, 255, 0.15)' : toolBtnStyle.background,
              color: chartType === 'tradingview' ? '#00e5ff' : toolBtnStyle.color
            }}
            onClick={() => setChartType(chartType === 'canvas' ? 'tradingview' : 'canvas')}
          >
            {chartType === 'canvas' ? 'MT5 Canvas' : 'MT5 Chart'}
          </button>

          {/* Fullscreen Toggle */}
          <button
            title="Layar Penuh"
            style={toolBtnStyle}
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? '[X]' : '[ ]'}
          </button>
        </div>
      </div>

      {/* Chart Render Canvas / TradingView Area */}
      <div
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 120px)' : 420,
          minHeight: 380,
          position: 'relative'
        }}
      >
        {chartType === 'canvas' ? (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}

const toolBtnStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 6,
  padding: '5px 8px',
  color: '#cbd5e1',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s'
};
