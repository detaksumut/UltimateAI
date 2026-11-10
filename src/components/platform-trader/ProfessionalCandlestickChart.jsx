/**
 * ProfessionalCandlestickChart.jsx
 * Professional TradingView-Style Interactive Charting Engine for UltimateAI Platform Trader.
 *
 * Engine: TradingView Lightweight Charts v5.2.1
 *
 * Capabilities:
 * 1. Ultra-smooth 60fps pan (drag horizontal) and mouse-wheel horizontal zoom.
 * 2. Vertical price scale drag (stretch/compress price axis) and double-click autoscale reset.
 * 3. Crosshair following cursor with real-time OHLC, Volume, and active indicator tooltips.
 * 4. Incremental live candle updates (series.update) — zero history re-rendering or flicker.
 * 5. Strict candle validation & timestamp deduplication.
 * 6. Interactive Drawing Tools:
 *    - Trendline (diagonal ray with anchor handles)
 *    - Horizontal Line (price level line with label)
 *    - Rectangle (range / consolidation box)
 *    - Fibonacci Retracement (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0)
 *    - Manual Supply & Demand Zones
 *    - Select, drag, edit, and delete (Del / Backspace / floating pill)
 * 7. Auto-detected Supply & Demand zones from SupplyDemandDetector.
 * 8. Technical Indicators: EMA 20, 50, 200, Volume histogram, RSI 14, MACD.
 * 9. Visual JIN Demo Trading Positions on chart (Entry, SL, TP1, TP2, floating P/L, on-chart close).
 * 10. Bottom Quick BUY / SELL execution bar with live XM MT5 Bid / Ask & Spread.
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
} from 'lightweight-charts';
import {
  MousePointer,
  TrendingUp,
  Minus,
  Square,
  Layers,
  Flame,
  Droplet,
  Trash2,
  Maximize2,
  Minimize2,
  RotateCcw,
  BarChart2,
  Activity,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { detectSupplyDemandZones } from '../../services/trading/SupplyDemandDetector.js';
import { marketDataServiceInstance } from '../../services/trading/MarketDataService.js';
import DrawingToolsOverlay from './chart/DrawingToolsOverlay.jsx';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];

const CHART_MIN_HEIGHT = 320;
const CHART_DEFAULT_HEIGHT = 680;
const CHART_HEIGHT_STORAGE_KEY = 'ultimateai.platformTrader.chartHeight';

function readStoredChartHeight() {
  try {
    if (typeof window === 'undefined') return CHART_DEFAULT_HEIGHT;
    const value = Number(window.localStorage.getItem(CHART_HEIGHT_STORAGE_KEY));
    const max = Math.max(CHART_MIN_HEIGHT, window.innerHeight - 80);
    if (Number.isFinite(value) && value >= CHART_MIN_HEIGHT) return Math.min(value, max);
  } catch (_) {}
  return CHART_DEFAULT_HEIGHT;
}

/**
 * Sanitizes and pre-processes candles into strictly monotonically increasing time array
 * for Lightweight Charts v5.
 */
function prepareLwcCandles(rawCandles) {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) return [];

  // Filter out any invalid geometry
  const valid = rawCandles.filter(c => {
    if (!c || typeof c !== 'object') return false;
    const o = Number(c.open);
    const h = Number(c.high);
    const l = Number(c.low);
    const cl = Number(c.close);
    if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(cl)) return false;
    if (o <= 0 || h <= 0 || l <= 0 || cl <= 0) return false;
    // Strict OHLC geometry
    return h >= Math.max(o, cl, l) && l <= Math.min(o, cl, h);
  });

  if (valid.length === 0) return [];

  // Sort chronologically
  valid.sort((a, b) => {
    const ta = new Date(a.timestamp || a.time || 0).getTime();
    const tb = new Date(b.timestamp || b.time || 0).getTime();
    return ta - tb;
  });

  // Ensure unique, strictly increasing timestamps in seconds
  const result = [];
  let lastTime = -Infinity;

  for (const c of valid) {
    let t = Math.floor(new Date(c.timestamp || c.time || 0).getTime() / 1000);
    if (!Number.isFinite(t) || t <= 0) continue;

    if (t <= lastTime) {
      t = lastTime + 1; // eliminate duplicate timestamp collision
    }
    lastTime = t;

    result.push({
      time: t,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Math.max(0, Number(c.volume || 0)),
      originalTimestamp: c.timestamp,
    });
  }

  return result;
}

/** Compute EMA series */
function computeEmaSeries(lwcCandles, period) {
  if (!lwcCandles || lwcCandles.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let emaVal = null;

  for (let i = 0; i < lwcCandles.length; i++) {
    const close = lwcCandles[i].close;
    if (emaVal === null) {
      if (i >= period - 1) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += lwcCandles[j].close;
        emaVal = sum / period;
      }
    } else {
      emaVal = close * k + emaVal * (1 - k);
    }

    if (emaVal !== null) {
      result.push({ time: lwcCandles[i].time, value: Number(emaVal.toFixed(2)) });
    }
  }
  return result;
}

/** Compute RSI(14) series */
function computeRsiSeries(lwcCandles, period = 14) {
  if (!lwcCandles || lwcCandles.length <= period) return [];
  const closes = lwcCandles.map(c => c.close);
  const result = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const firstRsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  result.push({ time: lwcCandles[period].time, value: Number(firstRsi.toFixed(1)) });

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    result.push({ time: lwcCandles[i].time, value: Number(rsi.toFixed(1)) });
  }

  return result;
}

/** Compute MACD (12, 26, 9) series */
function computeMacdSeries(lwcCandles) {
  if (!lwcCandles || lwcCandles.length < 35) return { macdLine: [], signalLine: [], hist: [] };
  const ema12 = computeEmaSeries(lwcCandles, 12);
  const ema26 = computeEmaSeries(lwcCandles, 26);
  if (ema12.length === 0 || ema26.length === 0) return { macdLine: [], signalLine: [], hist: [] };

  const e26Map = new Map(ema26.map(d => [d.time, d.value]));
  const macdLine = [];
  for (const item of ema12) {
    if (e26Map.has(item.time)) {
      macdLine.push({ time: item.time, value: Number((item.value - e26Map.get(item.time)).toFixed(2)) });
    }
  }

  // Signal = EMA 9 of MACD line
  const fakeCandles = macdLine.map(m => ({ time: m.time, close: m.value }));
  const signalLine = computeEmaSeries(fakeCandles, 9);
  const sigMap = new Map(signalLine.map(s => [s.time, s.value]));

  const hist = [];
  for (const m of macdLine) {
    if (sigMap.has(m.time)) {
      const diff = Number((m.value - sigMap.get(m.time)).toFixed(2));
      hist.push({
        time: m.time,
        value: diff,
        color: diff >= 0 ? 'rgba(8, 153, 129, 0.7)' : 'rgba(242, 54, 69, 0.7)',
      });
    }
  }

  return { macdLine, signalLine, hist };
}

export default function ProfessionalCandlestickChart({
  instrument = 'XAUUSD',
  timeframe = 'M1',
  onTimeframeChange = null,
  currentPrice = null,
  spread = '0.35',
  candles = [],
  dataStatus = 'LIVE',
  source = 'XM MT5 Live',
  signal = null,
  openPositions = [],
  onClosePosition = null,
  onBuyClick = null,
  onSellClick = null,
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const priceLineRefs = useRef({});
  const resizeObserverRef = useRef(null);
  const initialFitDoneRef = useRef(false);

  // ── Chart Engine Live Instance State ──
  const [chartInstance, setChartInstance] = useState(null);
  const [candleSeriesInstance, setCandleSeriesInstance] = useState(null);

  // ── User Interface & Controls State ──
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(readStoredChartHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [chartType, setChartType] = useState('candles'); // 'candles' | 'line'
  const [showIndicators, setShowIndicators] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [showSdZones, setShowSdZones] = useState(true);

  // ── Interactive Drawing Tools State ──
  const [activeTool, setActiveTool] = useState('cursor'); // 'cursor' | 'trendline' | 'horizontal' | 'rectangle' | 'sd_supply' | 'sd_demand' | 'fibonacci'
  const [drawings, setDrawings] = useState([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);

  // ── Crosshair & Live OHLC Tooltip State ──
  const [hoverOhlc, setHoverOhlc] = useState(null);
  const [lwcCandles, setLwcCandles] = useState([]);
  const [localPrice, setLocalPrice] = useState(currentPrice);

  // Reset zoom auto-fit flag when timeframe changes
  useEffect(() => {
    initialFitDoneRef.current = false;
    // Re-arm automatic price scaling for the new timeframe after a manual pan.
    if (chartRef.current) {
      try {
        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
      } catch (_) {}
    }
  }, [timeframe]);
  useEffect(() => {
    if (Number.isFinite(currentPrice) && currentPrice > 0) {
      setLocalPrice(currentPrice);
    }
  }, [currentPrice]);

  // ── Synchronize incoming candles prop ──
  useEffect(() => {
    if (!candles || candles.length === 0) return;
    const processed = prepareLwcCandles(candles);
    if (processed.length === 0) return;

    setLwcCandles(prev => {
      if (prev.length === 0) return processed;

      const firstIncoming = processed[0];
      const lastIncoming = processed[processed.length - 1];
      const lastExisting = prev[prev.length - 1];
      const sameSeries = firstIncoming && prev[0] && firstIncoming.time === prev[0].time;

      // Only use the incremental fast-path when it is the same history window.
      // A different timeframe (or a wider history window) must fully replace.
      if (sameSeries && lastExisting && lastIncoming) {
        if (lastIncoming.time === lastExisting.time) {
          // In-place live update of the final candle
          if (seriesRef.current.candle) {
            seriesRef.current.candle.update({
              time: lastIncoming.time,
              open: lastIncoming.open,
              high: lastIncoming.high,
              low: lastIncoming.low,
              close: lastIncoming.close,
            });
          }
          if (seriesRef.current.volume && showVolume) {
            seriesRef.current.volume.update({
              time: lastIncoming.time,
              value: lastIncoming.volume,
              color: lastIncoming.close >= lastIncoming.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)',
            });
          }
          const updated = [...prev];
          updated[updated.length - 1] = lastIncoming;
          return updated;
        }

        if (lastIncoming.time > lastExisting.time && processed.length > prev.length) {
          // New candle(s) appended to the right
          if (seriesRef.current.candle) {
            seriesRef.current.candle.update({
              time: lastIncoming.time,
              open: lastIncoming.open,
              high: lastIncoming.high,
              low: lastIncoming.low,
              close: lastIncoming.close,
            });
          }
          return processed;
        }
      }

      // Full array change (timeframe switch, older history added, batch reload)
      return processed;
    });
  }, [candles, showVolume]);

  // ── Subscribe to MarketDataService for Live Ticks ──
  useEffect(() => {
    if (!marketDataServiceInstance) return;
    const unsub = marketDataServiceInstance.subscribe((snapshot) => {
      if (!snapshot) return;

      // Update tick price
      const tick = snapshot.ticks?.[instrument];
      if (tick && Number.isFinite(tick.bid) && tick.bid > 0) {
        setLocalPrice(tick.bid);
      }

      // Update current candle if available
      const latestCandle = snapshot.candles?.[snapshot.candles?.length - 1];
      if (latestCandle && seriesRef.current.candle && latestCandle.symbol === instrument && latestCandle.timeframe === timeframe) {
        const t = Math.floor(new Date(latestCandle.timestamp).getTime() / 1000);
        if (t > 0) {
          try {
            seriesRef.current.candle.update({
              time: t,
              open: Number(latestCandle.open),
              high: Number(latestCandle.high),
              low: Number(latestCandle.low),
              close: Number(latestCandle.close),
            });
          } catch (_) {}
        }
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [instrument, timeframe]);

  // ── 1. Initialize Lightweight Chart Engine ──
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = {};
      priceLineRefs.current = {};
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#131722' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'Inter, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)', style: LineStyle.Solid },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#758696',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e222d',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e222d',
        },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.05, bottom: 0.08 }, // Ruang vertikal penuh & lega agar candle tidak ceper
        mode: PriceScaleMode.Normal,
        autoScale: true,
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 9,
        minBarSpacing: 0.5,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: {
        mouseWheel: false, // Memungkinkan mouse wheel digunakan untuk zoom, bukan scroll
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true }, // drag vertikal sumbu harga untuk zoom harga
        axisDoubleClickReset: { time: true, price: true }, // double-click sumbu harga untuk reset
      },
      width: chartContainerRef.current.clientWidth || 800,
      height: chartContainerRef.current.clientHeight || 500,
    });

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      priceScaleId: 'right',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Volume Histogram Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.86, bottom: 0 },
    });

    // Technical Indicators Series: EMA 20, 50, 200
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#00e5ff',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const ema50Series = chart.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const ema200Series = chart.addSeries(LineSeries, {
      color: '#c084fc',
      lineWidth: 1.8,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // RSI sub-pane series
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1.5,
      priceScaleId: 'rsi',
      priceFormat: { type: 'custom', minMove: 0.1, formatter: v => v.toFixed(1) },
      priceLineVisible: false,
      lastValueVisible: true,
    });
    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0.0 },
      borderColor: '#2a2e39',
      visible: false,
    });

    // MACD sub-pane series
    const macdHistSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      priceFormat: { type: 'custom', minMove: 0.01, formatter: v => v.toFixed(2) },
      lastValueVisible: false,
    });
    const macdLineSeries = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      priceScaleId: 'macd',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const macdSignalSeries = chart.addSeries(LineSeries, {
      color: '#fb923c',
      lineWidth: 1,
      priceScaleId: 'macd',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.0, bottom: 0.0 },
      visible: false,
    });

    // Tooltip & OHLC tracker on crosshair move
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData) {
        setHoverOhlc(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries);
      if (bar) {
        setHoverOhlc({ time: param.time, ...bar });
      }
    });

    seriesRef.current = {
      candle: candleSeries,
      volume: volumeSeries,
      ema20: ema20Series,
      ema50: ema50Series,
      ema200: ema200Series,
      rsi: rsiSeries,
      macdHist: macdHistSeries,
      macdLine: macdLineSeries,
      macdSignal: macdSignalSeries,
    };

    chartRef.current = chart;
    setChartInstance(chart);
    setCandleSeriesInstance(candleSeries);

    // Responsive auto-resize observer
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (chartRef.current && width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
      }
    });
    ro.observe(chartContainerRef.current);
    resizeObserverRef.current = ro;

    // ── Enable vertical (price) panning ──
    // Lightweight Charts refuses to scroll the price scale while autoScale is
    // enabled, which makes the chart feel locked to left/right only. As soon as
    // the user performs a genuine vertical drag we release autoScale so the
    // chart can be panned up/down. The "Auto" button re-enables autoScale.
    const containerEl = chartContainerRef.current;
    let pointerStart = null;

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      pointerStart = { x: event.clientX, y: event.clientY };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    const onPointerMove = (event) => {
      if (!pointerStart) return;
      const dx = Math.abs(event.clientX - pointerStart.x);
      const dy = Math.abs(event.clientY - pointerStart.y);
      if (dy > 3 && dy >= dx) {
        try {
          chart.priceScale('right').applyOptions({ autoScale: false });
        } catch (_) {}
        pointerStart = null;
        window.removeEventListener('pointermove', onPointerMove);
      }
    };

    const onPointerUp = () => {
      pointerStart = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    containerEl.addEventListener('pointerdown', onPointerDown);

    return () => {
      ro.disconnect();
      containerEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      setChartInstance(null);
      setCandleSeriesInstance(null);
      seriesRef.current = {};
      priceLineRefs.current = {};
    };
  }, []);

  // ── 2. Populate / Update Full Series Data ──
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current.candle || lwcCandles.length === 0) return;
    const s = seriesRef.current;

    // Set Candlesticks
    s.candle.setData(lwcCandles);

    // Set Volume
    if (showVolume) {
      s.volume.setData(lwcCandles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)',
      })));
    } else {
      s.volume.setData([]);
    }

    // Set EMAs
    if (showIndicators && lwcCandles.length >= 20) {
      s.ema20.setData(computeEmaSeries(lwcCandles, 20));
      s.ema20.applyOptions({ visible: true });
    } else {
      s.ema20.setData([]);
    }

    if (showIndicators && lwcCandles.length >= 50) {
      s.ema50.setData(computeEmaSeries(lwcCandles, 50));
      s.ema50.applyOptions({ visible: true });
    } else {
      s.ema50.setData([]);
    }

    if (showIndicators && lwcCandles.length >= 200) {
      s.ema200.setData(computeEmaSeries(lwcCandles, 200));
      s.ema200.applyOptions({ visible: true });
    } else {
      s.ema200.setData([]);
    }

    // Set RSI
    if (showRsi && lwcCandles.length > 14) {
      s.rsi.setData(computeRsiSeries(lwcCandles, 14));
      chartRef.current.priceScale('rsi').applyOptions({ visible: true });
    } else {
      s.rsi.setData([]);
      chartRef.current.priceScale('rsi').applyOptions({ visible: false });
    }

    // Set MACD
    if (showMacd && lwcCandles.length > 35) {
      const { macdLine, signalLine, hist } = computeMacdSeries(lwcCandles);
      s.macdLine.setData(macdLine);
      s.macdSignal.setData(signalLine);
      s.macdHist.setData(hist);
      chartRef.current.priceScale('macd').applyOptions({ visible: true });
    } else {
      s.macdLine.setData([]);
      s.macdSignal.setData([]);
      s.macdHist.setData([]);
      chartRef.current.priceScale('macd').applyOptions({ visible: false });
    }

    // Set the initial viewport: show the most recent bars instead of squeezing
    // the whole history so the user still has room to zoom out into older candles.
    if (!initialFitDoneRef.current && chartRef.current?.timeScale()) {
      const ts = chartRef.current.timeScale();
      const total = lwcCandles.length;
      const defaultBars = 120;
      if (total > defaultBars) {
        ts.setVisibleLogicalRange({ from: total - defaultBars, to: total + 8 });
      } else {
        ts.fitContent();
      }
      initialFitDoneRef.current = true;
    }
  }, [lwcCandles, showIndicators, showVolume, showRsi, showMacd]);

  // ── 3. Chart Type Switch (Candles vs Line) ──
  useEffect(() => {
    if (!seriesRef.current.candle) return;
    if (chartType === 'line') {
      seriesRef.current.candle.applyOptions({
        upColor: 'transparent',
        downColor: 'transparent',
        borderVisible: false,
        wickVisible: false,
      });
    } else {
      seriesRef.current.candle.applyOptions({
        upColor: '#089981',
        downColor: '#f23645',
        borderVisible: false,
        wickUpColor: '#089981',
        wickDownColor: '#f23645',
        wickVisible: true,
      });
    }
  }, [chartType]);

  // ── 4. Live Bid/Ask Price Line & Badge ──
  useEffect(() => {
    if (!seriesRef.current.candle || !localPrice) return;
    const s = seriesRef.current.candle;

    if (priceLineRefs.current.live) {
      try { s.removePriceLine(priceLineRefs.current.live); } catch (_) {}
    }

    priceLineRefs.current.live = s.createPriceLine({
      price: localPrice,
      color: '#38bdf8',
      lineWidth: 1.5,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'LIVE BID',
    });
  }, [localPrice]);

  // ── 5. Visual Open Positions (Entry, SL, TP1, TP2) ──
  useEffect(() => {
    if (!seriesRef.current.candle) return;
    const s = seriesRef.current.candle;

    // Clean old lines
    Object.keys(priceLineRefs.current).forEach(k => {
      if (k.startsWith('pos_')) {
        try { s.removePriceLine(priceLineRefs.current[k]); } catch (_) {}
        delete priceLineRefs.current[k];
      }
    });

    // Create price lines for open positions
    openPositions.forEach(pos => {
      const id = pos.ticket || pos.id;
      const isBuy = pos.side === 'BUY' || pos.direction === 'BUY';

      if (Number.isFinite(pos.entryPrice)) {
        priceLineRefs.current[`pos_${id}_entry`] = s.createPriceLine({
          price: pos.entryPrice,
          color: isBuy ? '#089981' : '#f23645',
          lineWidth: 1.5,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${isBuy ? '▲ BUY' : '▼ SELL'} ${pos.lotSize || ''}L`,
        });
      }
      if (Number.isFinite(pos.stopLoss) && pos.stopLoss > 0) {
        priceLineRefs.current[`pos_${id}_sl`] = s.createPriceLine({
          price: pos.stopLoss,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'SL',
        });
      }
      if (Number.isFinite(pos.takeProfit1) && pos.takeProfit1 > 0) {
        priceLineRefs.current[`pos_${id}_tp1`] = s.createPriceLine({
          price: pos.takeProfit1,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TP1',
        });
      }
      if (Number.isFinite(pos.takeProfit2) && pos.takeProfit2 > 0) {
        priceLineRefs.current[`pos_${id}_tp2`] = s.createPriceLine({
          price: pos.takeProfit2,
          color: '#06b6d4',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TP2',
        });
      }
    });
  }, [openPositions]);

  // ── 6. Auto-detected Supply & Demand Zones ──
  const autoSdZones = useMemo(() => {
    return detectSupplyDemandZones(
      lwcCandles.map(c => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        timestamp: c.originalTimestamp || new Date(c.time * 1000).toISOString(),
      })),
      timeframe,
    );
  }, [lwcCandles, timeframe]);

  // ── 7. Interactive Drawing Tool Handlers ──
  const handleCreateDrawing = useCallback((newDrawing) => {
    setDrawings(prev => [...prev, newDrawing]);
  }, []);

  const handleUpdateDrawing = useCallback((updatedDrawing) => {
    setDrawings(prev => prev.map(d => (d.id === updatedDrawing.id ? updatedDrawing : d)));
  }, []);

  const handleDeleteDrawing = useCallback((id) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
    if (selectedDrawingId === id) setSelectedDrawingId(null);
  }, [selectedDrawingId]);

  const handleClearAllDrawings = useCallback(() => {
    if (drawings.length === 0) return;
    if (window.confirm('Hapus seluruh garis gambar (drawings) pada chart?')) {
      setDrawings([]);
      setSelectedDrawingId(null);
    }
  }, [drawings.length]);

  // ── 8. Autoscale & Reset Chart View ──
  const handleAutoScale = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    chartRef.current.priceScale('right').applyOptions({ autoScale: true });
  }, []);

  // ── 9. Interactive Zoom In / Zoom Out Handlers ──
  // Note: timeScale().options().barSpacing is only the last *applied* value and
  // does NOT track wheel/axis zoom. We therefore read the real visible logical
  // range so the zoom buttons always respond relative to the current viewport.
  const applyZoomFactor = useCallback((factor) => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    const total = lwcCandles.length;
    if (!range || total === 0) return;

    const visibleBars = Math.max(1, range.to - range.from);
    const minBars = 6;
    // Never shrink smaller than the whole history plus a little breathing room.
    const maxBars = Math.max(total + 10, minBars);
    const nextBars = Math.min(maxBars, Math.max(minBars, visibleBars * factor));

    ts.setVisibleLogicalRange({
      from: range.to - nextBars,
      to: range.to,
    });
  }, [lwcCandles.length]);

  const handleZoomIn = useCallback(() => {
    applyZoomFactor(1 / 1.35);
  }, [applyZoomFactor]);

  const handleZoomOut = useCallback(() => {
    applyZoomFactor(1.35);
  }, [applyZoomFactor]);

  // ── 10. Smooth Drag-to-Resize Height (TradingView-style) ──
  useEffect(() => {
    try {
      window.localStorage.setItem(CHART_HEIGHT_STORAGE_KEY, String(Math.round(chartHeight)));
    } catch (_) {}
  }, [chartHeight]);

  const handleResizeStart = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = chartHeight;
    const maxHeight = Math.max(
      CHART_MIN_HEIGHT,
      (typeof window !== 'undefined' ? window.innerHeight : 900) - 80,
    );
    let frame = null;
    let pending = startHeight;

    const commit = () => {
      frame = null;
      setChartHeight(pending);
    };
    const onMove = (moveEvent) => {
      pending = Math.min(maxHeight, Math.max(CHART_MIN_HEIGHT, startHeight + (moveEvent.clientY - startY)));
      if (frame === null) frame = requestAnimationFrame(commit);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      setChartHeight(pending);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsResizing(false);
    };

    setIsResizing(true);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [chartHeight]);

  const handleResizeReset = useCallback(() => {
    setChartHeight(CHART_DEFAULT_HEIGHT);
  }, []);

  // ── Header OHLC Metrics & Price Values ──
  const displayPrice = localPrice || (lwcCandles.length ? lwcCandles[lwcCandles.length - 1].close : null);
  const activeBar = hoverOhlc || (lwcCandles.length ? lwcCandles[lwcCandles.length - 1] : null);
  const prevBarClose = lwcCandles.length > 1 ? lwcCandles[lwcCandles.length - 2].close : null;
  const ohlcDiff = activeBar && prevBarClose ? (activeBar.close - prevBarClose).toFixed(2) : '0.00';
  const ohlcDiffPct = activeBar && prevBarClose ? (((activeBar.close - prevBarClose) / prevBarClose) * 100).toFixed(2) : '0.00';
  const spreadNum = parseFloat(spread) || 0.35;
  const bidPrice = displayPrice ? displayPrice - (spreadNum * 0.5) : null;
  const askPrice = displayPrice ? displayPrice + (spreadNum * 0.5) : null;

  // Toolbar Button Styles
  const BTN_STYLE = {
    padding: '3px 8px',
    fontSize: 10.5,
    fontWeight: 700,
    borderRadius: 4,
    border: '1px solid #2a2e39',
    background: 'rgba(30, 34, 45, 0.85)',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s ease',
  };

  const BTN_ACTIVE = {
    ...BTN_STYLE,
    background: 'rgba(56, 189, 248, 0.18)',
    color: '#38bdf8',
    border: '1px solid #38bdf8',
  };

  const DRAW_TOOL_BTN = (tool, icon, title) => {
    const isActive = activeTool === tool;
    return (
      <button
        onClick={() => {
          setActiveTool(isActive ? 'cursor' : tool);
          if (selectedDrawingId) setSelectedDrawingId(null);
        }}
        title={title}
        style={{
          width: 32,
          height: 32,
          borderRadius: 4,
          border: isActive ? '1px solid #38bdf8' : '1px solid transparent',
          background: isActive ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
          color: isActive ? '#38bdf8' : '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s',
        }}
      >
        {icon}
      </button>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: isFullscreen ? '100%' : `${chartHeight}px`,
        minHeight: isFullscreen ? '100%' : `${chartHeight}px`,
        background: '#131722',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #2a2e39',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 99999 : 1,
        transition: isResizing ? 'none' : 'height 0.18s ease',
      }}
    >
      {/* ── TOP TOOLBAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          padding: '4px 10px',
          background: '#131722',
          borderBottom: '1px solid #2a2e39',
          minHeight: 38,
          flexShrink: 0,
        }}
      >
        {/* Symbol badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
          <span style={{ color: '#f8fafc', fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
            {instrument}
          </span>
          <span
            style={{
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: 8.5,
              fontWeight: 800,
              background: dataStatus === 'LIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              color: dataStatus === 'LIVE' ? '#34d399' : '#facc15',
              border: `1px solid ${dataStatus === 'LIVE' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`,
            }}
          >
            {source}
          </span>
        </div>

        {/* Timeframe Selector */}
        <div style={{ display: 'flex', gap: 2, background: '#1e222d', padding: 2, borderRadius: 5 }}>
          {TIMEFRAMES.map(tf => {
            const isSel = timeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => onTimeframeChange?.(tf)}
                style={{
                  padding: '3px 7px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  borderRadius: 3,
                  border: 'none',
                  background: isSel ? '#2962ff' : 'transparent',
                  color: isSel ? '#ffffff' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tf}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 20, background: '#2a2e39', margin: '0 2px' }} />

        {/* Chart Style (Candles vs Line) */}
        <button
          style={chartType === 'candles' ? BTN_ACTIVE : BTN_STYLE}
          onClick={() => setChartType('candles')}
          title="Tampilan Candlestick"
        >
          <BarChart2 size={12} /> Candles
        </button>
        <button
          style={chartType === 'line' ? BTN_ACTIVE : BTN_STYLE}
          onClick={() => setChartType('line')}
          title="Tampilan Garis"
        >
          <Activity size={12} /> Line
        </button>

        <div style={{ width: 1, height: 20, background: '#2a2e39', margin: '0 2px' }} />

        {/* Indicators */}
        <button
          style={showIndicators ? BTN_ACTIVE : BTN_STYLE}
          onClick={() => setShowIndicators(p => !p)}
          title="Toggle EMA 20/50/200"
        >
          EMA 20/50/200 {showIndicators && '✓'}
        </button>
        <button
          style={showVolume ? BTN_ACTIVE : BTN_STYLE}
          onClick={() => setShowVolume(p => !p)}
          title="Toggle Volume Histogram"
        >
          Vol {showVolume && '✓'}
        </button>
        <button
          style={showSdZones ? { ...BTN_ACTIVE, color: '#4ade80', borderColor: '#4ade80' } : BTN_STYLE}
          onClick={() => setShowSdZones(p => !p)}
          title="Toggle Supply & Demand Zones"
        >
          S&D Zones {showSdZones && '✓'}
        </button>
        <button
          style={showRsi ? BTN_ACTIVE : BTN_STYLE}
          onClick={() => setShowRsi(p => !p)}
          title="Toggle RSI Oscillator"
        >
          RSI 14 {showRsi && '✓'}
        </button>
        <button
          style={showMacd ? BTN_ACTIVE : BTN_STYLE}
          onClick={() => setShowMacd(p => !p)}
          title="Toggle MACD"
        >
          MACD {showMacd && '✓'}
        </button>

        <div style={{ flex: 1 }} />

        {/* Zoom Out & Zoom In Buttons */}
        <button
          style={BTN_STYLE}
          onClick={handleZoomOut}
          title="Zoom Out (Perkecil Tampilan Candle)"
        >
          <ZoomOut size={12} />
        </button>
        <button
          style={BTN_STYLE}
          onClick={handleZoomIn}
          title="Zoom In (Perbesar Tampilan Candle)"
        >
          <ZoomIn size={12} />
        </button>

        {/* Autoscale Reset Button */}
        <button
          style={BTN_STYLE}
          onClick={handleAutoScale}
          title="Autoscale Chart (Double-click sumbu harga untuk reset)"
        >
          <RotateCcw size={12} /> Auto
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          style={BTN_STYLE}
          onClick={() => setIsFullscreen(p => !p)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>

      {/* ── OHLC REAL-TIME STATUS BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '2px 10px',
          background: '#131722',
          borderBottom: '1px solid #1e222d',
          fontSize: 11,
          fontFamily: 'monospace',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        <span style={{ color: '#94a3b8', fontWeight: 700 }}>
          {instrument} · {timeframe}
        </span>
        {activeBar && (
          <>
            <span style={{ color: '#94a3b8' }}>
              O <span style={{ color: '#f8fafc' }}>{activeBar.open?.toFixed(2)}</span>
            </span>
            <span style={{ color: '#94a3b8' }}>
              H <span style={{ color: '#089981' }}>{activeBar.high?.toFixed(2)}</span>
            </span>
            <span style={{ color: '#94a3b8' }}>
              L <span style={{ color: '#f23645' }}>{activeBar.low?.toFixed(2)}</span>
            </span>
            <span style={{ color: '#94a3b8' }}>
              C <span style={{ color: '#f8fafc', fontWeight: 800 }}>{activeBar.close?.toFixed(2)}</span>
            </span>
            <span
              style={{
                color: parseFloat(ohlcDiff) >= 0 ? '#089981' : '#f23645',
                fontWeight: 800,
              }}
            >
              {parseFloat(ohlcDiff) >= 0 ? '+' : ''}{ohlcDiff} ({parseFloat(ohlcDiffPct) >= 0 ? '+' : ''}{ohlcDiffPct}%)
            </span>
            {activeBar.volume > 0 && (
              <span style={{ color: '#64748b' }}>
                Vol <span style={{ color: '#94a3b8' }}>{(activeBar.volume / 1000).toFixed(1)}K</span>
              </span>
            )}
          </>
        )}
        {showIndicators && lwcCandles.length >= 20 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            <span style={{ color: '#00e5ff', fontSize: 10 }}>EMA 20</span>
            <span style={{ color: '#eab308', fontSize: 10 }}>EMA 50</span>
            <span style={{ color: '#c084fc', fontSize: 10 }}>EMA 200</span>
          </div>
        )}
      </div>

      {/* ── WORKSPACE: LEFT DRAWING TOOLBAR + CHART CANVAS + SVG OVERLAY ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', width: '100%' }}>
        {/* Sleek Left Drawing Toolbar (TradingView Style) */}
        <div
          style={{
            width: 38,
            background: '#131722',
            borderRight: '1px solid #2a2e39',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '6px 2px',
            gap: 4,
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {DRAW_TOOL_BTN('cursor', <MousePointer size={15} />, 'Kursor / Pilih Gambar (Esc)')}
          <div style={{ width: 24, height: 1, background: '#2a2e39', margin: '2px 0' }} />
          {DRAW_TOOL_BTN('trendline', <TrendingUp size={15} />, 'Garis Trend (Trendline)')}
          {DRAW_TOOL_BTN('horizontal', <Minus size={15} />, 'Garis Horizontal (Level Harga)')}
          {DRAW_TOOL_BTN('rectangle', <Square size={15} />, 'Kotak / Area Konsolidasi (Rectangle)')}
          {DRAW_TOOL_BTN('fibonacci', <Layers size={15} />, 'Fibonacci Retracement')}
          <div style={{ width: 24, height: 1, background: '#2a2e39', margin: '2px 0' }} />
          {DRAW_TOOL_BTN('sd_supply', <Flame size={15} color="#f87171" />, 'Gambar Manual Supply Zone')}
          {DRAW_TOOL_BTN('sd_demand', <Droplet size={15} color="#4ade80" />, 'Gambar Manual Demand Zone')}
          <div style={{ flex: 1 }} />
          {drawings.length > 0 && (
            <button
              onClick={handleClearAllDrawings}
              title="Hapus Seluruh Garis Gambar"
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                border: 'none',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Center Chart Box */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', width: '100%', overflow: 'hidden' }}>
          {/* LWC Canvas */}
          <div
            ref={chartContainerRef}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          />

          {/* SVG Interactive Drawing Layer */}
          <DrawingToolsOverlay
            chart={chartInstance || chartRef.current}
            candleSeries={candleSeriesInstance || seriesRef.current?.candle}
            drawings={drawings}
            activeTool={activeTool}
            selectedId={selectedDrawingId}
            onSelectDrawing={setSelectedDrawingId}
            onUpdateDrawing={handleUpdateDrawing}
            onDeleteDrawing={handleDeleteDrawing}
            onCreateDrawing={handleCreateDrawing}
            onFinishTool={() => setActiveTool('cursor')}
            autoSdZones={autoSdZones}
            showAutoSdZones={showSdZones}
            containerRef={chartContainerRef}
            lwcCandles={lwcCandles}
          />

          {/* Floating Active Positions Badges on Chart */}
          {Array.isArray(openPositions) && openPositions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                zIndex: 20,
                maxWidth: '85%',
                pointerEvents: 'auto',
              }}
            >
              {openPositions.map((pos) => {
                const isBuy = pos.side === 'BUY' || pos.direction === 'BUY';
                const isProfit = (pos.floatingPl || 0) >= 0;
                return (
                  <div
                    key={pos.id || pos.ticket}
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
                      {pos.side || pos.direction}
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
                        TP1 HIT (50% CLOSED)
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                      {pos.lotSize || pos.lots}L @ ${pos.entryPrice?.toFixed(2)}
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
                            onClick={() => onClosePosition(pos.id || pos.ticket, null, 'CHART PARTIAL CLOSE (50%)', 0.5)}
                            title="Tutup 50% lot posisi langsung dari chart"
                            style={{
                              background: 'rgba(56, 189, 248, 0.2)',
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              color: '#38bdf8',
                              borderRadius: 3,
                              fontSize: 8.5,
                              fontWeight: 800,
                              padding: '2px 5px',
                              cursor: 'pointer',
                            }}
                          >
                            ½ Close
                          </button>
                        )}
                        <button
                          onClick={() => onClosePosition(pos.id || pos.ticket, null, 'CHART MANUAL CLOSE', 1.0)}
                          title="Tutup posisi penuh langsung dari chart"
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#f87171',
                            borderRadius: 3,
                            fontSize: 8.5,
                            fontWeight: 800,
                            padding: '2px 6px',
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
        </div>
      </div>

      {/* ── BOTTOM QUICK BUY / SELL BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0,
          height: 52,
          background: '#0a0f1e',
          borderTop: '1px solid #2a2e39',
        }}
      >
        {/* SELL BUTTON */}
        <button
          onClick={() => onSellClick?.()}
          style={{
            flex: 1,
            background: '#dc2626',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#b91c1c')}
          onMouseLeave={e => (e.currentTarget.style.background = '#dc2626')}
        >
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 10, letterSpacing: 1 }}>
            SELL / SHORT
          </span>
          <span style={{ color: '#fecaca', fontWeight: 800, fontSize: 14.5, fontFamily: 'monospace' }}>
            {bidPrice ? bidPrice.toFixed(2) : '—'}
          </span>
        </button>

        {/* SPREAD INDICATOR */}
        <div
          style={{
            width: 84,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: '#0d1117',
            borderLeft: '1px solid #2a2e39',
            borderRight: '1px solid #2a2e39',
          }}
        >
          <span style={{ color: '#64748b', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
            SPREAD
          </span>
          <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, fontFamily: 'monospace' }}>
            {spreadNum.toFixed(2)}
          </span>
          <span style={{ fontSize: 7, color: '#475569', fontFamily: 'monospace' }}>pts</span>
        </div>

        {/* BUY BUTTON */}
        <button
          onClick={() => onBuyClick?.()}
          style={{
            flex: 1,
            background: '#16a34a',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#15803d')}
          onMouseLeave={e => (e.currentTarget.style.background = '#16a34a')}
        >
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 10, letterSpacing: 1 }}>
            BUY / LONG
          </span>
          <span style={{ color: '#bbf7d0', fontWeight: 800, fontSize: 14.5, fontFamily: 'monospace' }}>
            {askPrice ? askPrice.toFixed(2) : '—'}
          </span>
        </button>
      </div>

      {/* ── SMOOTH HEIGHT RESIZE HANDLE (TradingView-style) ── */}
      {!isFullscreen && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize chart height"
          title="Drag up/down untuk mengatur tinggi chart · Double-click untuk reset"
          onPointerDown={handleResizeStart}
          onDoubleClick={handleResizeReset}
          style={{
            height: 12,
            flexShrink: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isResizing ? 'rgba(56, 189, 248, 0.12)' : '#0a0f1e',
            borderTop: '1px solid #2a2e39',
            cursor: 'ns-resize',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 46,
              height: 3,
              borderRadius: 2,
              background: isResizing ? '#38bdf8' : '#334155',
              transition: 'background 0.12s ease',
            }}
          />
          {isResizing && (
            <span
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 9,
                fontWeight: 800,
                color: '#38bdf8',
                fontFamily: 'monospace',
                background: 'rgba(19, 23, 34, 0.95)',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {Math.round(chartHeight)} px
            </span>
          )}
        </div>
      )}
    </div>
  );
}
