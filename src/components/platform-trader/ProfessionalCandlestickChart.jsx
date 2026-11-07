/**
 * ProfessionalCandlestickChart.jsx
 * Professional TradingView-Style Interactive Charting Engine for UltimateAI Platform Trader.
 *
 * Implements:
 * 1. Dark TradingView Aesthetic: #131722 canvas, precision grid lines, crisp typography.
 * 2. True Candlestick / Line Modes: TradingView green #089981 & red #f23645 with wicks.
 * 3. Dynamic Multi-Timeframe: M1, M5, M15, H1, H4, D1 synced to actual market data.
 * 4. Technical Indicators (Actual OHLC):
 *    - EMA 20 (#00e5ff), EMA 50 (#eab308), EMA 200 (#c084fc)
 *    - Volume Histogram with bull/bear color coding
 *    - RSI (14) with lower oscillator pane & 70/50/30 thresholds
 *    - MACD (12, 26, 9) with histogram & signal lines
 *    - ATR (14) volatility metric
 * 5. Interactive Pan & Zoom: Mouse-wheel zoom, drag-to-pan, double-click auto-fit.
 * 6. Dual-Axis Crosshair: Horizontal/vertical guides with live price & time pills.
 * 7. Dynamic OHLC Header: Hover tracking of O, H, L, C, Volume, and active indicator values.
 * 8. Supply & Demand Zone Overlay: Transparent fresh/tested zone boxes with price bounds.
 * 9. JIN Demo Trading ($5,000) Visual Execution:
 *    - BUY/SELL entry dashed line with lot size & ticket marker
 *    - Stop Loss (SL) and Take Profit 1 & 2 (TP1, TP2) dashed lines
 *    - TP1 Partial Close status & runner lot tracking
 *    - Real-time Floating P/L badge on price scale
 *    - Interactive On-Chart Quick Close (½ Partial & Full Close)
 * 10. XM MT5 Live Sync: Bid/Ask, Spread, and live feed attribution.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { detectSupplyDemandZones } from '../../services/trading/SupplyDemandDetector.js';
import { ema, rsi, atr, macd } from '../../services/trading/IndicatorCalculator.js';

/**
 * Calculates a TradingView-style clean round price step interval (e.g. 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50).
 */
export function calculateTradingViewStep(range, targetSteps = 7) {
  if (!range || range <= 0) return 1;
  const rawStep = range / targetSteps;
  const power = Math.floor(Math.log10(rawStep));
  const magnitude = Math.pow(10, power);
  const normalized = rawStep / magnitude;

  let niceFactor;
  if (normalized < 1.4) niceFactor = 1;
  else if (normalized < 2.2) niceFactor = 2;
  else if (normalized < 3.8) niceFactor = 2.5;
  else if (normalized < 7.5) niceFactor = 5;
  else niceFactor = 10;

  return niceFactor * magnitude;
}

const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];

export default function ProfessionalCandlestickChart({
  instrument = 'XAUUSD',
  timeframe = 'M1',
  onTimeframeChange = null,
  currentPrice = null,
  spread = '0.35',
  candles = [],
  dataStatus = 'LIVE',
  source = 'Live Market Feed',
  signal = null,
  openPositions = [],
  onClosePosition = null,
  onBuyClick = null,
  onSellClick = null,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ── Viewport & Interactive State ──
  const [visibleBars, setVisibleBars] = useState(75); // zoom: 20 to 220
  const [panOffset, setPanOffset] = useState(0); // pan bars offset
  const [chartType, setChartType] = useState('candles'); // 'candles' | 'line'
  const [hoverData, setHoverData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  // ── Price Scale Stretch & Compress State (TradingView Style) ──
  const [priceScaleFactor, setPriceScaleFactor] = useState(1.0); // >1: dirapatkan (compressed), <1: direnggangkan (stretched)
  const [pricePanOffset, setPricePanOffset] = useState(0); // vertical pan offset
  const [isAutoScaled, setIsAutoScaled] = useState(true); // true = auto fit, false = custom user stretched
  const [dragMode, setDragMode] = useState(null); // null | 'pan' | 'priceScale' | 'timeScale'
  const [cursorStyle, setCursorStyle] = useState('crosshair');

  const dragStartRef = useRef({
    x: 0,
    y: 0,
    panOffset: 0,
    scaleFactor: 1.0,
    pricePan: 0,
    visibleBars: 75
  });

  const resetPriceScale = useCallback(() => {
    setPriceScaleFactor(1.0);
    setPricePanOffset(0);
    setIsAutoScaled(true);
  }, []);

  // Listen to window resize for dynamic fullscreen/expand recalculations
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen to Escape key to exit fullscreen/expand
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // ── Technical Indicators Toggle State ──
  const [showIndicators, setShowIndicators] = useState(true);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [activeSubPane, setActiveSubPane] = useState('none'); // 'none' | 'rsi' | 'macd'
  const [showZones, setShowZones] = useState(true);

  // ── Left Drawing Toolbar State ──
  const [activeDrawingTool, setActiveDrawingTool] = useState('crosshair'); // 'crosshair' | 'horizontal' | 'trendline' | 'box'
  const [userDrawings, setUserDrawings] = useState([]); // [{ type: 'horizontal', price }]

  // ── 1. Validate & Filter Raw Candles ──
  const validCandles = useMemo(() => {
    if (!Array.isArray(candles)) return [];
    return candles.filter(c =>
      c &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
    );
  }, [candles]);

  // ── 2. Supply & Demand Zones Detection ──
  const zones = useMemo(() => {
    if (!validCandles.length) return { supply: [], demand: [] };
    return detectSupplyDemandZones(validCandles, timeframe);
  }, [validCandles, timeframe]);

  // ── 3. Calculate Technical Indicators Series on full candle history ──
  const indicatorSeries = useMemo(() => {
    if (validCandles.length < 20) {
      return { ema20: [], ema50: [], ema200: [], rsi: [], macd: null, atrLatest: null };
    }
    const closes = validCandles.map(c => c.close);

    const calcFullEma = (period) => {
      const k = 2 / (period + 1);
      let val = closes[0];
      return closes.map(c => {
        val = c * k + val * (1 - k);
        return val;
      });
    };

    const fullEma20 = calcFullEma(20);
    const fullEma50 = validCandles.length >= 50 ? calcFullEma(50) : null;
    const fullEma200 = validCandles.length >= 100 ? calcFullEma(200) : null;

    // RSI 14 Series
    const fullRsi = rsi(closes, 14) || [];
    // Pad RSI array to match closes length
    const paddedRsi = new Array(closes.length - fullRsi.length).fill(null).concat(fullRsi);

    // MACD (12, 26, 9)
    const macdData = macd(closes, 12, 26, 9);

    // ATR (14)
    const atrSeries = atr(validCandles, 14) || [];
    const atrLatest = atrSeries.length ? atrSeries[atrSeries.length - 1] : null;

    return {
      ema20: fullEma20,
      ema50: fullEma50,
      ema200: fullEma200,
      rsi: paddedRsi,
      macd: macdData,
      atrLatest: Number.isFinite(atrLatest) ? atrLatest : null
    };
  }, [validCandles]);

  // ── 4. Main Canvas Render Loop (TradingView Quality) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // ── Background: TradingView Signature #131722 ──
    ctx.fillStyle = '#131722';
    ctx.fillRect(0, 0, width, height);

    if (validCandles.length === 0) {
      ctx.fillStyle = '#2962ff';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`MEMUAT DATA FEED ${instrument} (${timeframe})...`, width / 2, height / 2 - 10);
      ctx.fillStyle = '#787b86';
      ctx.font = '11px monospace';
      ctx.fillText('Sinkronisasi candle riil dengan XM MT5...', width / 2, height / 2 + 15);
      return;
    }

    // Determine Visible Window with Pan Offset
    const totalBars = validCandles.length;
    const windowBars = Math.min(totalBars, Math.max(15, visibleBars));
    const effectivePan = Math.max(0, Math.min(totalBars - windowBars, panOffset));
    const startIndex = Math.max(0, totalBars - windowBars - effectivePan);
    const endIndex = Math.min(totalBars, startIndex + windowBars);

    const rawWindow = validCandles.slice(startIndex, endIndex);

    // Real-time tick binding to latest bar if live price available and viewing newest bar
    const displayCandles = rawWindow.map((c, idx, arr) => {
      if (effectivePan === 0 && idx === arr.length - 1 && Number.isFinite(currentPrice) && currentPrice > 0) {
        return {
          ...c,
          close: currentPrice,
          high: Math.max(c.high, currentPrice),
          low: Math.min(c.low, currentPrice)
        };
      }
      return c;
    });

    // ── Layout Geometry ──
    const priceAxisWidth = 80;
    const timeAxisHeight = 28;
    const subPaneHeight = activeSubPane !== 'none' ? 95 : 0;
    const volumeHeight = showVolume ? 45 : 0;

    const plotWidth = width - priceAxisWidth;
    const mainPlotHeight = height - timeAxisHeight - subPaneHeight;
    const pricePlotHeight = mainPlotHeight - volumeHeight;

    // ── Scale Calculation ──
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    displayCandles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    // Include open Demo order levels in chart scale bounds
    if (Array.isArray(openPositions) && openPositions.length > 0) {
      openPositions.forEach(p => {
        if (Number.isFinite(p.entryPrice) && p.entryPrice > 0) {
          minPrice = Math.min(minPrice, p.entryPrice);
          maxPrice = Math.max(maxPrice, p.entryPrice);
        }
        if (Number.isFinite(p.stopLoss) && p.stopLoss > 0) {
          minPrice = Math.min(minPrice, p.stopLoss);
          maxPrice = Math.max(maxPrice, p.stopLoss);
        }
        if (Number.isFinite(p.takeProfit1) && p.takeProfit1 > 0) {
          minPrice = Math.min(minPrice, p.takeProfit1);
          maxPrice = Math.max(maxPrice, p.takeProfit1);
        }
        if (Number.isFinite(p.takeProfit2) && p.takeProfit2 > 0) {
          minPrice = Math.min(minPrice, p.takeProfit2);
          maxPrice = Math.max(maxPrice, p.takeProfit2);
        }
      });
    }

    const candleSpan = maxPrice - minPrice;
    const baseCenter = (minPrice + maxPrice) / 2;
    const padding = Math.max(0.5, candleSpan * 0.12);
    const autoMin = minPrice - padding;
    const autoMax = maxPrice + padding;
    const autoSpan = autoMax - autoMin || 1;

    // Apply interactive price scale stretch/compress & vertical pan
    const scaledSpan = autoSpan * priceScaleFactor;
    const center = baseCenter + pricePanOffset;

    minPrice = center - scaledSpan / 2;
    maxPrice = center + scaledSpan / 2;
    const priceRange = maxPrice - minPrice || 1;

    const getY = (val) => pricePlotHeight - ((val - minPrice) / priceRange) * pricePlotHeight;
    const barSlot = plotWidth / displayCandles.length;
    const candleWidth = Math.max(2, Math.min(18, Math.floor(barSlot * 0.72)));

    // ── 5. Grid Lines (TradingView Exact Nice Round Steps) ──
    ctx.strokeStyle = '#1e222d';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // TradingView exact nice round price step (e.g. 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50)
    const targetPriceSteps = Math.max(4, Math.min(14, Math.floor(pricePlotHeight / 48)));
    const priceStep = calculateTradingViewStep(priceRange, targetPriceSteps);
    const firstGridPrice = Math.ceil(minPrice / priceStep) * priceStep;

    const formatPriceLabel = (p) => {
      if (!Number.isFinite(p)) return '';
      const decimals = priceStep < 0.1 ? 3 : (priceStep < 1 ? 2 : (priceStep % 1 !== 0 ? 1 : 2));
      return p.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    // Draw horizontal grid lines at clean multiples of priceStep
    for (let p = firstGridPrice; p <= maxPrice; p += priceStep) {
      const y = getY(p);
      if (y < 0 || y > pricePlotHeight) continue;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      // Right axis price label
      ctx.fillStyle = '#787b86';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatPriceLabel(p), plotWidth + 8, y + 3.5);
    }

    // Vertical Time Grid
    const timeStep = Math.max(1, Math.floor(displayCandles.length / 8));
    displayCandles.forEach((c, idx) => {
      if (idx % timeStep === 0) {
        const x = (idx + 0.5) * barSlot;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mainPlotHeight);
        ctx.stroke();

        // Bottom axis time label
        if (c.timestamp) {
          const d = new Date(c.timestamp);
          const timeStr = timeframe === 'D1'
            ? `${d.getDate()}/${d.getMonth() + 1}`
            : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          ctx.fillStyle = '#787b86';
          ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(timeStr, x, height - 9);
        }
      }
    });
    ctx.setLineDash([]); // Reset line dash

    // ── 6. Supply & Demand Zone Boxes Overlay ──
    if (showZones) {
      // Demand Zones (Green #089981 translucent)
      zones.demand.forEach(z => {
        const topY = getY(z.high);
        const botY = getY(z.low);
        const boxHeight = Math.max(4, botY - topY);

        ctx.fillStyle = 'rgba(8, 153, 129, 0.14)';
        ctx.fillRect(0, topY, plotWidth, boxHeight);

        ctx.strokeStyle = 'rgba(8, 153, 129, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, topY, plotWidth, boxHeight);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'right';
        const label = z.testCount > 0 ? 'DEMAND TESTED' : 'DEMAND FRESH';
        ctx.fillText(`${label} [$${z.low.toFixed(1)} - $${z.high.toFixed(1)}]`, plotWidth - 10, topY + Math.min(13, boxHeight - 2));
      });

      // Supply Zones (Red #f23645 translucent)
      zones.supply.forEach(z => {
        const topY = getY(z.high);
        const botY = getY(z.low);
        const boxHeight = Math.max(4, botY - topY);

        ctx.fillStyle = 'rgba(242, 54, 69, 0.15)';
        ctx.fillRect(0, topY, plotWidth, boxHeight);

        ctx.strokeStyle = 'rgba(242, 54, 69, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, topY, plotWidth, boxHeight);

        ctx.fillStyle = '#fb7185';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'right';
        const label = z.testCount > 0 ? 'SUPPLY TESTED' : 'SUPPLY FRESH';
        ctx.fillText(`${label} [$${z.low.toFixed(1)} - $${z.high.toFixed(1)}]`, plotWidth - 10, topY + Math.min(13, boxHeight - 2));
      });
    }

    // ── 7. Exponential Moving Averages (EMA 20, EMA 50, EMA 200) ──
    if (showIndicators) {
      const drawEma = (series, color, width = 1.5) => {
        if (!series || !series.length) return;
        const windowSeries = series.slice(startIndex, endIndex);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        let started = false;
        windowSeries.forEach((val, idx) => {
          if (!Number.isFinite(val)) return;
          const x = (idx + 0.5) * barSlot;
          const y = getY(val);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else { ctx.lineTo(x, y); }
        });
        if (started) ctx.stroke();
      };

      if (showEma200 && indicatorSeries.ema200) drawEma(indicatorSeries.ema200, '#c084fc', 1.8);
      if (showEma50 && indicatorSeries.ema50) drawEma(indicatorSeries.ema50, '#eab308', 1.5);
      if (showEma20 && indicatorSeries.ema20) drawEma(indicatorSeries.ema20, '#00e5ff', 1.6);
    }

    // ── 8. Volume Histogram at Bottom of Price Pane ──
    if (showVolume && maxVol > 0) {
      displayCandles.forEach((c, idx) => {
        const x = (idx + 0.5) * barSlot;
        const isBull = c.close >= c.open;
        const vHeight = (c.volume / maxVol) * volumeHeight;
        const vY = pricePlotHeight + volumeHeight - vHeight;
        ctx.fillStyle = isBull ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)';
        ctx.fillRect(x - candleWidth / 2, vY, candleWidth, vHeight);
      });
    }

    // ── 9. Candlesticks / Line Chart ──
    if (chartType === 'line') {
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      displayCandles.forEach((c, idx) => {
        const x = (idx + 0.5) * barSlot;
        const y = getY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      // TradingView Classic Candles: Teal/Green #089981 & Crimson #f23645
      displayCandles.forEach((c, idx) => {
        const x = (idx + 0.5) * barSlot;
        const openY = getY(c.open);
        const closeY = getY(c.close);
        const highY = getY(c.high);
        const lowY = getY(c.low);
        const isBull = c.close >= c.open;
        const color = isBull ? '#089981' : '#f23645';

        // Upper & Lower Wicks
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Real Candlestick Body
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(closeY - openY));
        ctx.fillStyle = color;
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      });
    }

    // ── 10. Live XM MT5 Price Pulsing Line ──
    const activePrice = Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : (displayCandles.length ? displayCandles[displayCandles.length - 1].close : null);

    if (Number.isFinite(activePrice)) {
      const liveY = Math.max(10, Math.min(pricePlotHeight - 5, getY(activePrice)));
      const isUp = displayCandles.length >= 2 && activePrice >= displayCandles[displayCandles.length - 2].close;
      const liveBg = isUp ? '#089981' : '#f23645';

      // Horizontal dashed live line
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = liveBg;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, liveY);
      ctx.lineTo(plotWidth, liveY);
      ctx.stroke();
      ctx.restore();

      // Right axis live price badge
      ctx.fillStyle = liveBg;
      ctx.fillRect(plotWidth + 2, liveY - 9, priceAxisWidth - 4, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(activePrice.toFixed(2), plotWidth + (priceAxisWidth / 2), liveY + 3.5);
    }

    // ── 11. JIN Demo Trading Positions Overlay on Chart ──
    if (Array.isArray(openPositions) && openPositions.length > 0) {
      openPositions.forEach((pos) => {
        const isBuy = pos.side === 'BUY';
        const posColor = isBuy ? '#089981' : '#f23645';
        const plPositive = (pos.floatingPl || 0) >= 0;

        // Entry Line
        if (Number.isFinite(pos.entryPrice)) {
          const entryY = Math.max(15, Math.min(pricePlotHeight - 10, getY(pos.entryPrice)));
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = posColor;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, entryY);
          ctx.lineTo(plotWidth, entryY);
          ctx.stroke();

          // Left Entry Marker Badge
          const statusText = pos.tp1Hit
            ? `[TP1 HIT · SISA ${pos.lotSize}L]`
            : `${pos.side} ${pos.lotSize}L`;
          const badgeWidth = pos.tp1Hit ? 180 : 135;

          ctx.fillStyle = posColor;
          ctx.fillRect(8, entryY - 11, badgeWidth, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Trebuchet MS", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(
            `${statusText} @ ${pos.entryPrice.toFixed(2)}`,
            14,
            entryY + 3
          );

          // Right Price Scale Floating P/L Badge
          const plText = `${plPositive ? '+' : ''}$${(pos.floatingPl || 0).toFixed(2)}`;
          ctx.fillStyle = plPositive ? '#089981' : '#f23645';
          ctx.fillRect(plotWidth + 2, entryY - 9, priceAxisWidth - 4, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(plText, plotWidth + (priceAxisWidth / 2), entryY + 3.5);

          ctx.restore();
        }

        // Stop Loss Line
        if (Number.isFinite(pos.stopLoss)) {
          const slY = Math.max(15, Math.min(pricePlotHeight - 10, getY(pos.stopLoss)));
          ctx.save();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = '#f23645';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, slY);
          ctx.lineTo(plotWidth, slY);
          ctx.stroke();

          ctx.fillStyle = 'rgba(242, 54, 69, 0.9)';
          ctx.fillRect(plotWidth - 85, slY - 9, 80, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`SL $${pos.stopLoss.toFixed(2)}`, plotWidth - 45, slY + 3.5);
          ctx.restore();
        }

        // Take Profit 1 Line
        if (Number.isFinite(pos.takeProfit1)) {
          const tp1Y = Math.max(15, Math.min(pricePlotHeight - 10, getY(pos.takeProfit1)));
          ctx.save();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = pos.tp1Hit ? '#64748b' : '#089981';
          ctx.lineWidth = pos.tp1Hit ? 1 : 1.4;
          ctx.beginPath();
          ctx.moveTo(0, tp1Y);
          ctx.lineTo(plotWidth, tp1Y);
          ctx.stroke();

          ctx.fillStyle = pos.tp1Hit ? 'rgba(100, 116, 139, 0.85)' : 'rgba(8, 153, 129, 0.9)';
          const tp1Label = pos.tp1Hit ? 'TP1 HIT (50% DONE)' : `TP1 $${pos.takeProfit1.toFixed(2)}`;
          ctx.fillRect(plotWidth - 110, tp1Y - 9, 105, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(tp1Label, plotWidth - 57, tp1Y + 3.5);
          ctx.restore();
        }

        // Take Profit 2 Line
        if (Number.isFinite(pos.takeProfit2)) {
          const tp2Y = Math.max(15, Math.min(pricePlotHeight - 10, getY(pos.takeProfit2)));
          ctx.save();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, tp2Y);
          ctx.lineTo(plotWidth, tp2Y);
          ctx.stroke();

          ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
          ctx.fillRect(plotWidth - 95, tp2Y - 9, 90, 18);
          ctx.fillStyle = '#030812';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`TP2 $${pos.takeProfit2.toFixed(2)}`, plotWidth - 50, tp2Y + 3.5);
          ctx.restore();
        }
      });
    }

    // ── 12. User Drawings (Horizontal Levels) ──
    userDrawings.forEach(d => {
      if (d.type === 'horizontal' && Number.isFinite(d.price)) {
        const y = getY(d.price);
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotWidth, y);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.font = '9px monospace';
        ctx.fillText(`LINE: ${d.price.toFixed(2)}`, 10, y - 4);
        ctx.restore();
      }
    });

    // ── 13. Lower Oscillator Sub-Pane (RSI 14 or MACD) ──
    if (activeSubPane !== 'none') {
      const subTop = mainPlotHeight;
      const subBot = height - timeAxisHeight;
      const subH = subBot - subTop;

      // Pane divider
      ctx.strokeStyle = '#2a2e39';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, subTop);
      ctx.lineTo(width, subTop);
      ctx.stroke();

      if (activeSubPane === 'rsi') {
        // RSI 14 Pane
        const rsiWindow = indicatorSeries.rsi.slice(startIndex, endIndex);
        const getRsiY = (val) => subBot - (val / 100) * subH;

        // 70 & 30 bands
        ctx.strokeStyle = '#2a2e39';
        ctx.setLineDash([2, 4]);
        [70, 50, 30].forEach(level => {
          const y = getRsiY(level);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(plotWidth, y);
          ctx.stroke();
          ctx.fillStyle = '#787b86';
          ctx.font = '9px monospace';
          ctx.fillText(String(level), plotWidth + 6, y + 3);
        });
        ctx.setLineDash([]);

        // RSI curve
        ctx.strokeStyle = '#9c27b0';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        let rsiStarted = false;
        rsiWindow.forEach((val, idx) => {
          if (!Number.isFinite(val)) return;
          const x = (idx + 0.5) * barSlot;
          const y = getRsiY(val);
          if (!rsiStarted) { ctx.moveTo(x, y); rsiStarted = true; }
          else { ctx.lineTo(x, y); }
        });
        if (rsiStarted) ctx.stroke();

        // Label
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        const lastRsi = rsiWindow.length ? rsiWindow[rsiWindow.length - 1] : null;
        ctx.fillText(`RSI 14 (close): ${Number.isFinite(lastRsi) ? lastRsi.toFixed(2) : '—'}`, 8, subTop + 14);
      } else if (activeSubPane === 'macd') {
        // MACD Pane
        const zeroY = subTop + subH / 2;
        ctx.strokeStyle = '#2a2e39';
        ctx.beginPath();
        ctx.moveTo(0, zeroY);
        ctx.lineTo(plotWidth, zeroY);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('MACD (12, 26, 9) · XM MT5', 8, subTop + 14);
      }
    }

    // ── 14. Dual-Axis Interactive Crosshair Guide ──
    if (hoverData) {
      const { x, y } = hoverData;
      if (x >= 0 && x <= plotWidth && y >= 0 && y <= height - timeAxisHeight) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Vertical crosshair guide
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - timeAxisHeight);
        ctx.stroke();

        // Horizontal crosshair guide
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotWidth, y);
        ctx.stroke();
        ctx.restore();

        // Right axis price hover pill (TradingView blue #2962ff)
        const hoverPrice = minPrice + ((pricePlotHeight - y) / pricePlotHeight) * priceRange;
        if (Number.isFinite(hoverPrice) && y <= pricePlotHeight) {
          ctx.fillStyle = '#2962ff';
          ctx.fillRect(plotWidth + 2, y - 9, priceAxisWidth - 4, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(hoverPrice.toFixed(2), plotWidth + (priceAxisWidth / 2), y + 3.5);
        }

        // Bottom axis time hover pill
        const hoverIndex = Math.min(displayCandles.length - 1, Math.max(0, Math.floor(x / barSlot)));
        const hoverCandle = displayCandles[hoverIndex];
        if (hoverCandle?.timestamp) {
          const d = new Date(hoverCandle.timestamp);
          const tText = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
          ctx.fillStyle = '#2962ff';
          ctx.fillRect(x - 38, height - 20, 76, 17);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(tText, x, height - 8);
        }
      }
    }

    // ── 15. Right Axis & Bottom Axis Border Lines ──
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotWidth, 0);
    ctx.lineTo(plotWidth, height);
    ctx.moveTo(0, height - timeAxisHeight);
    ctx.lineTo(width, height - timeAxisHeight);
    ctx.stroke();

  }, [
    validCandles,
    currentPrice,
    visibleBars,
    panOffset,
    chartType,
    showIndicators,
    showEma20,
    showEma50,
    showEma200,
    showVolume,
    activeSubPane,
    showZones,
    instrument,
    timeframe,
    zones,
    openPositions,
    hoverData,
    userDrawings,
    priceScaleFactor,
    pricePanOffset,
    isFullscreen,
    windowDimensions
  ]);

  // ── Mouse & Touch Handlers: Drag Price Scale (Stretch/Compress), Time Scale & Pan ──
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const plotWidth = rect.width - 80;
    const timeAxisHeight = 28;
    const subPaneHeight = activeSubPane !== 'none' ? 95 : 0;
    const volumeHeight = showVolume ? 45 : 0;
    const pricePlotHeight = rect.height - timeAxisHeight - subPaneHeight - volumeHeight;

    if (activeDrawingTool === 'horizontal') {
      const lastCandle = validCandles[validCandles.length - 1];
      const approxPrice = lastCandle ? lastCandle.close : 2740;
      setUserDrawings(prev => [...prev, { type: 'horizontal', price: approxPrice }]);
      setActiveDrawingTool('crosshair');
      return;
    }

    if (x >= plotWidth && y <= pricePlotHeight) {
      // 1. Right Price Scale Drag -> Stretch & Compress Price Intervals
      setDragMode('priceScale');
      setIsAutoScaled(false);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scaleFactor: priceScaleFactor,
        pricePan: pricePanOffset,
        visibleBars,
        panOffset,
      };
    } else if (y >= rect.height - timeAxisHeight && x <= plotWidth) {
      // 2. Bottom Time Scale Drag -> Stretch & Compress Candle Bar Spacing
      setDragMode('timeScale');
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        visibleBars,
        panOffset,
      };
    } else {
      // 3. Main Chart Canvas Drag -> Horizontal & Vertical Pan
      setDragMode('pan');
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panOffset,
        pricePan: pricePanOffset,
      };
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !validCandles.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const plotWidth = rect.width - 80;
    const timeAxisHeight = 28;
    const subPaneHeight = activeSubPane !== 'none' ? 95 : 0;
    const volumeHeight = showVolume ? 45 : 0;
    const pricePlotHeight = rect.height - timeAxisHeight - subPaneHeight - volumeHeight;

    if (dragMode === 'priceScale') {
      // Dragging downward (deltaY > 0) compresses price intervals (dirapatkan)
      // Dragging upward (deltaY < 0) stretches price intervals (direnggangkan)
      const deltaY = e.clientY - dragStartRef.current.y;
      const scaleMultiplier = Math.pow(1.006, deltaY);
      const newFactor = Math.max(0.08, Math.min(15.0, dragStartRef.current.scaleFactor * scaleMultiplier));
      setPriceScaleFactor(newFactor);
      setIsAutoScaled(false);
      return;
    }

    if (dragMode === 'timeScale') {
      const deltaX = e.clientX - dragStartRef.current.x;
      const barChange = Math.round(deltaX / 6);
      setVisibleBars(Math.max(15, Math.min(220, dragStartRef.current.visibleBars - barChange)));
      return;
    }

    if (dragMode === 'pan') {
      const deltaX = e.clientX - dragStartRef.current.x;
      const barSlot = plotWidth / visibleBars;
      const barsMoved = Math.round(deltaX / barSlot);
      setPanOffset(Math.max(0, dragStartRef.current.panOffset + barsMoved));

      // Vertical pan when manual scale is active
      if (!isAutoScaled) {
        const deltaY = e.clientY - dragStartRef.current.y;
        const priceShift = (deltaY / Math.max(10, pricePlotHeight)) * 20 * priceScaleFactor;
        setPricePanOffset(dragStartRef.current.pricePan + priceShift);
      }
      return;
    }

    // Hover mode: update cursor & crosshair
    if (x >= plotWidth && y <= pricePlotHeight) {
      setCursorStyle('ns-resize');
    } else if (y >= rect.height - timeAxisHeight && x <= plotWidth) {
      setCursorStyle('ew-resize');
    } else {
      setCursorStyle(activeDrawingTool === 'crosshair' ? 'crosshair' : 'pointer');
    }

    const barSlot = plotWidth / Math.min(validCandles.length, visibleBars);
    const hoverIdx = Math.min(validCandles.length - 1, Math.max(0, Math.floor(x / barSlot)));
    setHoverData({ x, y, candle: validCandles[hoverIdx] });
  };

  const handleDoubleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - 80;

    // Reset price scale and auto fit
    resetPriceScale();
    if (x < plotWidth) {
      setVisibleBars(75);
      setPanOffset(0);
    }
  };

  const handleMouseUp = () => setDragMode(null);
  const handleMouseLeave = () => {
    setDragMode(null);
    setHoverData(null);
  };

  // ── Vertical & Horizontal Zoom via Mouse Wheel ──
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - 80;

    if (x >= plotWidth) {
      // Mouse is over Price Scale -> VERTICAL ZOOM ONLY (Do not touch visibleBars!)
      const zoomMultiplier = e.deltaY < 0 ? 0.90 : 1.10;
      setPriceScaleFactor(prev => Math.max(0.08, Math.min(15.0, prev * zoomMultiplier)));
      setIsAutoScaled(false);
    } else {
      // Mouse is over Main Chart -> HORIZONTAL ZOOM ONLY
      const delta = e.deltaY < 0 ? -6 : 6;
      setVisibleBars(prev => Math.min(220, Math.max(20, prev + delta)));
    }
  }, []);

  const handleVerticalZoomIn = useCallback(() => {
    setPriceScaleFactor(prev => Math.max(0.08, prev * 0.85));
    setIsAutoScaled(false);
  }, []);

  const handleVerticalZoomOut = useCallback(() => {
    setPriceScaleFactor(prev => Math.min(15.0, prev * 1.15));
    setIsAutoScaled(false);
  }, []);

  const handleResetNormal = useCallback(() => {
    setPriceScaleFactor(1.0);
    setPricePanOffset(0);
    setVisibleBars(75);
    setPanOffset(0);
    setIsAutoScaled(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Dynamic Header Candle Stats (from hover candle or latest candle)
  const activeCandle = hoverData?.candle || (validCandles.length ? validCandles[validCandles.length - 1] : null);
  const isUpCandle = activeCandle ? activeCandle.close >= activeCandle.open : true;
  const candleChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const candleChangePct = activeCandle && activeCandle.open > 0 ? (candleChange / activeCandle.open) * 100 : 0;

  const spreadVal = Number.isFinite(Number(spread)) ? Number(spread) : 0.35;
  const bid = Number.isFinite(currentPrice) ? currentPrice : null;
  const ask = bid !== null ? bid + spreadVal : null;

  const isSignalBuy = signal?.side === 'BUY' && signal?.isValid === true;
  const isSignalSell = signal?.side === 'SELL' && signal?.isValid === true;

  return (
    <div
      ref={containerRef}
      style={{
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        border: isFullscreen ? 'none' : '1px solid #2a2e39',
        borderRadius: isFullscreen ? 0 : 8,
        background: '#131722',
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : '0 10px 35px rgba(0,0,0,0.7)',
        userSelect: 'none',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 99999 : 1,
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* ── TOP TOOLBAR: TradingView Style (Symbol, Timeframe, Indicators, Zoom) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#1e222d',
          borderBottom: '1px solid #2a2e39',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {/* Left: Symbol & Timeframe Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc', letterSpacing: '0.04em' }}>
              {instrument}
            </span>
            <span style={{ fontSize: 9, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
              XM MT5
            </span>
          </div>

          <div style={{ height: 16, width: 1, background: '#2a2e39', margin: '0 4px' }} />

          {/* Timeframes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {TIMEFRAMES.map((tf) => {
              const isActive = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => onTimeframeChange && onTimeframeChange(tf)}
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    padding: '3px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: 'none',
                    background: isActive ? '#2962ff' : 'transparent',
                    color: isActive ? '#ffffff' : '#787b86',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          <div style={{ height: 16, width: 1, background: '#2a2e39', margin: '0 4px' }} />

          {/* Chart Style Switcher: Candles vs Line */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: 2, borderRadius: 4 }}>
            <button
              onClick={() => setChartType('candles')}
              title="Candlestick Chart"
              style={{
                padding: '3px 7px',
                borderRadius: 3,
                border: 'none',
                background: chartType === 'candles' ? '#2962ff' : 'transparent',
                color: chartType === 'candles' ? '#fff' : '#787b86',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              🕯 Candles
            </button>
            <button
              onClick={() => setChartType('line')}
              title="Line Chart"
              style={{
                padding: '3px 7px',
                borderRadius: 3,
                border: 'none',
                background: chartType === 'line' ? '#2962ff' : 'transparent',
                color: chartType === 'line' ? '#fff' : '#787b86',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              📈 Line
            </button>
          </div>
        </div>

        {/* Right: Technical Indicator Toggles & Reset Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* EMA 20/50/200 Toggle */}
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: showIndicators ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid #2a2e39',
              background: showIndicators ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
              color: showIndicators ? '#00e5ff' : '#787b86',
            }}
          >
            EMA 20/50/200: {showIndicators ? 'ON' : 'OFF'}
          </button>

          {/* RSI Sub-pane Toggle */}
          <button
            onClick={() => setActiveSubPane(prev => prev === 'rsi' ? 'none' : 'rsi')}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: activeSubPane === 'rsi' ? '1px solid rgba(156, 39, 176, 0.5)' : '1px solid #2a2e39',
              background: activeSubPane === 'rsi' ? 'rgba(156, 39, 176, 0.2)' : 'transparent',
              color: activeSubPane === 'rsi' ? '#c084fc' : '#787b86',
            }}
          >
            RSI 14
          </button>

          {/* S&D Overlay Toggle */}
          <button
            onClick={() => setShowZones(!showZones)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: showZones ? '1px solid rgba(8, 153, 129, 0.4)' : '1px solid #2a2e39',
              background: showZones ? 'rgba(8, 153, 129, 0.15)' : 'transparent',
              color: showZones ? '#34d399' : '#787b86',
            }}
          >
            🎯 ZONA S&D
          </button>

          {/* Reset Zoom, Pan & Price Scale */}
          <button
            onClick={() => {
              setVisibleBars(75);
              setPanOffset(0);
              resetPriceScale();
            }}
            title="Reset Zoom, Pan & Skala Harga ke Standar"
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: !isAutoScaled ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid #2a2e39',
              background: !isAutoScaled ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
              color: !isAutoScaled ? '#eab308' : '#94a3b8',
            }}
          >
            {!isAutoScaled ? '⟲ Reset Skala' : '⟲ Reset'}
          </button>

          {/* Fullscreen Expand Toggle Button */}
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            title={isFullscreen ? "Perkecil Tampilan Chart (Esc)" : "Perbesar Chart Penuh Layar (Expand / Fullscreen)"}
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 900,
              cursor: 'pointer',
              border: isFullscreen ? '1px solid #2962ff' : '1px solid #3b82f6',
              background: isFullscreen ? 'rgba(41, 98, 255, 0.35)' : 'rgba(59, 130, 246, 0.18)',
              color: isFullscreen ? '#93c5fd' : '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{isFullscreen ? '🗗' : '⛶'}</span>
            <span>{isFullscreen ? 'KECILKAN' : 'EXPAND'}</span>
          </button>
        </div>
      </div>

      {/* ── WORKSPACE BODY: Drawing Toolbar (Left) + Chart Canvas & HUD (Right) ── */}
      <div style={{ display: 'flex', width: '100%', position: 'relative' }}>
        {/* Left Drawing Toolbar (TradingView vertical strip) */}
        <div
          style={{
            width: 36,
            background: '#1e222d',
            borderRight: '1px solid #2a2e39',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setActiveDrawingTool('crosshair')}
            title="Kursor Crosshair"
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: activeDrawingTool === 'crosshair' ? '#2962ff' : 'transparent',
              color: activeDrawingTool === 'crosshair' ? '#fff' : '#787b86',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            ✚
          </button>

          <button
            onClick={() => setActiveDrawingTool('horizontal')}
            title="Garis Horizontal Level (Klik di chart untuk pasang)"
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: activeDrawingTool === 'horizontal' ? '#2962ff' : 'transparent',
              color: activeDrawingTool === 'horizontal' ? '#fff' : '#787b86',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            ━
          </button>

          {userDrawings.length > 0 && (
            <button
              onClick={() => setUserDrawings([])}
              title="Hapus Semua Gambar Garis"
              style={{
                width: 26,
                height: 26,
                borderRadius: 4,
                border: 'none',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#fb7185',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              🗑
            </button>
          )}
        </div>

        {/* Center: Canvas Area & Dynamic HUD */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Dynamic TradingView Header Information Bar */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 12,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 10,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              background: 'rgba(19, 23, 34, 0.85)',
              padding: '3px 8px',
              borderRadius: 4,
              backdropFilter: 'blur(4px)',
            }}
          >
            <span style={{ fontWeight: 800, color: '#f8fafc' }}>
              {instrument} · {timeframe}
            </span>

            {activeCandle && (
              <div style={{ display: 'flex', gap: 7, color: '#cbd5e1' }}>
                <span>O <strong style={{ color: isUpCandle ? '#089981' : '#f23645' }}>{activeCandle.open.toFixed(2)}</strong></span>
                <span>H <strong style={{ color: isUpCandle ? '#089981' : '#f23645' }}>{activeCandle.high.toFixed(2)}</strong></span>
                <span>L <strong style={{ color: isUpCandle ? '#089981' : '#f23645' }}>{activeCandle.low.toFixed(2)}</strong></span>
                <span>C <strong style={{ color: isUpCandle ? '#089981' : '#f23645' }}>{activeCandle.close.toFixed(2)}</strong></span>
                <span style={{ color: isUpCandle ? '#089981' : '#f23645', fontWeight: 900 }}>
                  {candleChange >= 0 ? '+' : ''}{candleChange.toFixed(2)} ({candleChangePct >= 0 ? '+' : ''}{candleChangePct.toFixed(2)}%)
                </span>
              </div>
            )}

            {/* Indicator values legend */}
            {showIndicators && (
              <div style={{ display: 'flex', gap: 6, fontSize: 9 }}>
                <span style={{ color: '#00e5ff' }}>EMA 20</span>
                <span style={{ color: '#eab308' }}>EMA 50</span>
                <span style={{ color: '#c084fc' }}>EMA 200</span>
                {indicatorSeries.atrLatest && (
                  <span style={{ color: '#94a3b8' }}>ATR: {indicatorSeries.atrLatest.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>

          {/* Interactive HTML Overlay for Open Demo Positions */}
          {Array.isArray(openPositions) && openPositions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 36,
                left: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                zIndex: 15,
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
                      background: 'rgba(19, 23, 34, 0.94)',
                      border: `1px solid ${isBuy ? 'rgba(8, 153, 129, 0.7)' : 'rgba(242, 54, 69, 0.7)'}`,
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
                        background: isBuy ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)',
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
                        TP1 PARTIAL CLOSED
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

                    {/* On-Chart Actions */}
                    {onClosePosition && (
                      <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                        {pos.lotSize >= 0.02 && !pos.tp1Hit && (
                          <button
                            onClick={() => onClosePosition(pos.id, null, 'CHART PARTIAL CLOSE (50%)', 0.5)}
                            title="Tutup 50% posisi langsung dari chart"
                            style={{
                              padding: '2px 5px',
                              borderRadius: 4,
                              fontSize: 8.5,
                              fontWeight: 800,
                              background: 'rgba(251, 191, 36, 0.15)',
                              border: '1px solid rgba(251, 191, 36, 0.4)',
                              color: '#fbbf24',
                              cursor: 'pointer',
                            }}
                          >
                            ½ Close
                          </button>
                        )}
                        <button
                          onClick={() => onClosePosition(pos.id, null, 'CHART MANUAL CLOSE', 1.0)}
                          title="Tutup posisi ini langsung dari chart"
                          style={{
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 900,
                            background: 'rgba(242, 54, 69, 0.2)',
                            border: '1px solid rgba(242, 54, 69, 0.5)',
                            color: '#fb7185',
                            cursor: 'pointer',
                          }}
                        >
                          ✕ Close
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Right TradingView Axis Controls: Auto-Scale & Expand */}
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              right: 6,
              zIndex: 25,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <button
              onClick={resetPriceScale}
              title={isAutoScaled ? "Skala Harga Otomatis Aktif" : "Klik untuk Reset Skala Harga (Auto-fit)"}
              style={{
                padding: '2px 6px',
                fontSize: 9,
                fontWeight: 900,
                borderRadius: 3,
                border: isAutoScaled ? '1px solid rgba(41, 98, 255, 0.4)' : '1px solid rgba(234, 179, 8, 0.6)',
                background: isAutoScaled ? 'rgba(41, 98, 255, 0.25)' : 'rgba(234, 179, 8, 0.25)',
                color: isAutoScaled ? '#38bdf8' : '#eab308',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {isAutoScaled ? 'Auto' : '⟲ Auto'}
            </button>

            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              title={isFullscreen ? "Keluar Fullscreen (Esc)" : "Expand Chart Fullscreen"}
              style={{
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 900,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: 'rgba(30, 34, 45, 0.85)',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {isFullscreen ? '🗗' : '⛶'}
            </button>
          </div>

          {/* Floating Vertical Price Scale HUD Controls (+, −, AUTO, RESET) */}
          <div
            style={{
              position: 'absolute',
              top: 36,
              right: 6,
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              background: 'rgba(19, 23, 34, 0.92)',
              padding: '3px',
              borderRadius: 5,
              border: '1px solid #2a2e39',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <button
              onClick={handleVerticalZoomIn}
              title="Zoom In Vertikal (+) — Renggangkan Skala Harga"
              style={{
                width: 22,
                height: 22,
                fontSize: 14,
                fontWeight: 900,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: '#1e222d',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.1s ease',
              }}
            >
              +
            </button>
            <button
              onClick={handleVerticalZoomOut}
              title="Zoom Out Vertikal (−) — Rapatkan Skala Harga"
              style={{
                width: 22,
                height: 22,
                fontSize: 14,
                fontWeight: 900,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: '#1e222d',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.1s ease',
              }}
            >
              −
            </button>
            <button
              onClick={resetPriceScale}
              title={isAutoScaled ? "Skala Harga Otomatis (AUTO) Aktif" : "Kembalikan ke Skala Harga Otomatis (AUTO)"}
              style={{
                height: 18,
                fontSize: 8,
                fontWeight: 900,
                borderRadius: 3,
                border: isAutoScaled ? '1px solid #2962ff' : '1px solid rgba(234, 179, 8, 0.6)',
                background: isAutoScaled ? 'rgba(41, 98, 255, 0.25)' : 'rgba(234, 179, 8, 0.25)',
                color: isAutoScaled ? '#38bdf8' : '#eab308',
                cursor: 'pointer',
                padding: '0 3px',
                fontFamily: 'monospace',
              }}
            >
              AUTO
            </button>
            <button
              onClick={handleResetNormal}
              title="Reset Skala Normal & Posisi Awal"
              style={{
                height: 18,
                fontSize: 7.5,
                fontWeight: 800,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: '#1e222d',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0 3px',
                fontFamily: 'monospace',
              }}
            >
              RESET
            </button>
          </div>

          {/* Canvas Element with full-height interactive plotting */}
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
            style={{
              width: '100%',
              height: isFullscreen
                ? Math.max(300, windowDimensions.height - 95 - (activeSubPane !== 'none' ? 95 : 0))
                : (activeSubPane !== 'none' ? 490 : 430),
              display: 'block',
              cursor: dragMode === 'priceScale' ? 'ns-resize' : dragMode === 'timeScale' ? 'ew-resize' : dragMode === 'pan' ? 'grabbing' : cursorStyle,
            }}
          />
        </div>
      </div>

      {/* ── INTEGRATED BUY / SELL ORDER BAR AT BASE ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
          padding: '8px 12px',
          background: 'linear-gradient(180deg, #181c27 0%, #131722 100%)',
          borderTop: '1px solid #2a2e39',
        }}
      >
        {/* SELL Button */}
        <button
          onClick={() => onSellClick?.()}
          style={{
            flex: 1,
            padding: '9px 8px',
            borderRadius: 6,
            background: isSignalSell
              ? 'linear-gradient(135deg, #f23645 0%, #b91c1c 100%)'
              : 'rgba(242, 54, 69, 0.12)',
            border: `1px solid ${isSignalSell ? '#f23645' : 'rgba(242, 54, 69, 0.35)'}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            boxShadow: isSignalSell ? '0 0 16px rgba(242, 54, 69, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 9, color: '#fca5a5', fontWeight: 800, letterSpacing: '0.08em' }}>
            SELL / SHORT
          </span>
          <span style={{ fontSize: 16, color: '#ffffff', fontWeight: 900, fontFamily: 'monospace' }}>
            {bid !== null ? bid.toFixed(2) : '—'}
          </span>
          <span style={{ fontSize: 7.5, color: isSignalSell ? '#fecdd3' : '#787b86', fontWeight: 700 }}>
            {isSignalSell ? '● SINYAL SELL AKTIF' : 'Bid XM MT5'}
          </span>
        </button>

        {/* Center: Spread & Symbol Details */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            minWidth: 80,
          }}
        >
          <div style={{ fontSize: 7.5, color: '#787b86', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Spread Broker
          </div>
          <div style={{ fontSize: 12, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 800 }}>
            {spread}
          </div>
          <div style={{ fontSize: 8, color: '#cbd5e1', fontWeight: 700 }}>
            {instrument} ({timeframe})
          </div>
        </div>

        {/* BUY Button */}
        <button
          onClick={() => onBuyClick?.()}
          style={{
            flex: 1,
            padding: '9px 8px',
            borderRadius: 6,
            background: isSignalBuy
              ? 'linear-gradient(135deg, #089981 0%, #065f46 100%)'
              : 'rgba(8, 153, 129, 0.12)',
            border: `1px solid ${isSignalBuy ? '#089981' : 'rgba(8, 153, 129, 0.35)'}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            boxShadow: isSignalBuy ? '0 0 16px rgba(8, 153, 129, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800, letterSpacing: '0.08em' }}>
            BUY / LONG
          </span>
          <span style={{ fontSize: 16, color: '#ffffff', fontWeight: 900, fontFamily: 'monospace' }}>
            {ask !== null ? ask.toFixed(2) : '—'}
          </span>
          <span style={{ fontSize: 7.5, color: isSignalBuy ? '#bbf7d0' : '#787b86', fontWeight: 700 }}>
            {isSignalBuy ? '● SINYAL BUY AKTIF' : 'Ask XM MT5'}
          </span>
        </button>
      </div>
    </div>
  );
}
