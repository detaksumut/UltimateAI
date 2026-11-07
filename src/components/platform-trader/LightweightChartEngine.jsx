/**
 * LightweightChartEngine.jsx
 * Professional TradingView-style chart using Lightweight Charts v5 (TradingView library).
 *
 * Features:
 * - True LWC v5 candlestick engine — no canvas re-draws, native smooth zoom/pan
 * - Fetches 300 candles directly from XM MT5 backend (/trading/ohlc)
 * - Real-time tick updates via MarketDataService subscription
 * - EMA 20/50/200, Volume histogram, RSI sub-pane, MACD sub-pane
 * - Demo position lines (Entry, SL, TP1, TP2) via createPriceLine
 * - S&D zone overlays (supply red, demand green)
 * - Crosshair, OHLC header, live price line
 * - Fullscreen expand, timeframe switcher, price scale zoom +/-
 * - Drop-in replacement for ProfessionalCandlestickChart (same props interface)
 */

import React, {
  useEffect, useRef, useState, useCallback, useMemo
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
import { detectSupplyDemandZones } from '../../services/trading/SupplyDemandDetector.js';
import { ema as calcEma, rsi as calcRsi, macd as calcMacd } from '../../services/trading/IndicatorCalculator.js';
import { marketDataServiceInstance } from '../../services/trading/MarketDataService.js';
import { RouterConfig } from '../../services/router/RouterConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];

/** Convert raw candles → LWC-compatible strictly-increasing time arrays */
function prepareLwcCandles(rawCandles) {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) return [];
  const valid = rawCandles.filter(
    c => c && Number.isFinite(c.open) && Number.isFinite(c.high) &&
         Number.isFinite(c.low) && Number.isFinite(c.close)
  );
  valid.sort((a, b) => {
    const ta = new Date(a.timestamp || a.time || 0).getTime();
    const tb = new Date(b.timestamp || b.time || 0).getTime();
    return ta - tb;
  });
  let lastTime = -Infinity;
  return valid.map(c => {
    let t = Math.floor(new Date(c.timestamp || c.time || 0).getTime() / 1000);
    if (t <= lastTime) t = lastTime + 1;
    lastTime = t;
    return {
      time: t,
      open: c.open, high: c.high, low: c.low, close: c.close,
      volume: c.volume || 0,
    };
  });
}

/** Compute EMA series aligned to lwcCandles length */
function computeEma(lwcCandles, period) {
  const closes = lwcCandles.map(c => c.close);
  const k = 2 / (period + 1);
  const result = [];
  let emaVal = null;
  for (let i = 0; i < closes.length; i++) {
    if (emaVal === null) {
      if (i >= period - 1) {
        emaVal = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
      }
    } else {
      emaVal = closes[i] * k + emaVal * (1 - k);
    }
    if (emaVal !== null) {
      result.push({ time: lwcCandles[i].time, value: emaVal });
    }
  }
  return result;
}

/** Compute RSI(14) series */
function computeRsi(lwcCandles, period = 14) {
  const closes = lwcCandles.map(c => c.close);
  const result = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  if (lwcCandles.length > period) {
    const rsiVal = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: lwcCandles[period].time, value: rsiVal });
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const r = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      result.push({ time: lwcCandles[i].time, value: r });
    }
  }
  return result;
}

/** Compute MACD histogram series */
function computeMacd(lwcCandles) {
  const ema12 = computeEma(lwcCandles, 12);
  const ema26 = computeEma(lwcCandles, 26);
  if (ema12.length === 0 || ema26.length === 0) return { macdLine: [], signal: [], hist: [] };
  // align by time
  const e26Map = new Map(ema26.map(d => [d.time, d.value]));
  const macdLine = ema12
    .filter(d => e26Map.has(d.time))
    .map(d => ({ time: d.time, value: d.value - e26Map.get(d.time) }));
  // signal = EMA9 of macd
  const signalLine = computeEma(macdLine.map((d, i) => ({ ...lwcCandles[0], time: d.time, close: d.value, open: d.value, high: d.value, low: d.value })), 9);
  const sigMap = new Map(signalLine.map(d => [d.time, d.value]));
  const hist = macdLine
    .filter(d => sigMap.has(d.time))
    .map(d => ({ time: d.time, value: d.value - sigMap.get(d.time), color: d.value - sigMap.get(d.time) >= 0 ? 'rgba(8,153,129,0.6)' : 'rgba(242,54,69,0.6)' }));
  return { macdLine, signalLine, hist };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LightweightChartEngine({
  instrument = 'XAUUSD',
  timeframe = 'M1',
  onTimeframeChange = null,
  currentPrice = null,
  spread = '0.35',
  candles = [],          // passed from parent (MarketDataService cache)
  dataStatus = 'LIVE',
  source = 'XM MT5',
  signal = null,
  openPositions = [],
  onClosePosition = null,
  onBuyClick = null,
  onSellClick = null,
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);           // IChartApi
  const seriesRef = useRef({});            // { candle, volume, ema20, ema50, ema200, rsi, macdHist, macdLine, macdSignal }
  const priceLineRefs = useRef({});        // { live: PriceLine, pos_<id>_entry, pos_<id>_sl, ... }
  const resizeObserverRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartType, setChartType] = useState('candles'); // 'candles' | 'line'
  const [showIndicators, setShowIndicators] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [showSdZones, setShowSdZones] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [hoverOhlc, setHoverOhlc] = useState(null); // { time, open, high, low, close, volume }
  const [lwcCandles, setLwcCandles] = useState([]); // processed LWC candles
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [localCurrentPrice, setLocalCurrentPrice] = useState(currentPrice);

  // ── Fetch candles from backend ──────────────────────────────────────────────
  const fetchCandles = useCallback(async (tf = timeframe) => {
    setIsFetching(true);
    setFetchError(null);
    try {
      const url = RouterConfig.api(`/trading/ohlc?symbol=${instrument}&timeframe=${tf}&limit=300`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data?.candles || data?.data || (Array.isArray(data) ? data : []);
      const processed = prepareLwcCandles(raw);
      setLwcCandles(processed);
      return processed;
    } catch (err) {
      // Fallback to parent-provided candles
      const processed = prepareLwcCandles(candles);
      setLwcCandles(processed);
      setFetchError(err.message);
      return processed;
    } finally {
      setIsFetching(false);
    }
  }, [instrument, timeframe, candles]);

  // ── Chart initialization ───────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Destroy previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = {};
      priceLineRefs.current = {};
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#131722' },
        textColor: '#787b86',
        fontSize: 11,
        fontFamily: 'Inter, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: '#1e222d', style: LineStyle.Solid },
        horzLines: { color: '#1e222d', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', labelBackgroundColor: '#1e222d' },
        horzLine: { color: '#758696', labelBackgroundColor: '#1e222d' },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.1, bottom: 0.3 },
        mode: PriceScaleMode.Normal,
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,         // ← default tighter spacing (TradingView default ~8)
        minBarSpacing: 1,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
      width: chartContainerRef.current.clientWidth || 800,
      height: chartContainerRef.current.clientHeight || 500,
    });

    // ── Candlestick series ──────────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      priceScaleId: 'right',
    });

    // ── Volume histogram ────────────────────────────────────────────────────
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    // ── EMA lines ───────────────────────────────────────────────────────────
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#00e5ff', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    const ema50Series = chart.addSeries(LineSeries, {
      color: '#eab308', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    const ema200Series = chart.addSeries(LineSeries, {
      color: '#c084fc', lineWidth: 1.8, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });

    // ── RSI sub-pane ────────────────────────────────────────────────────────
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b', lineWidth: 1.5,
      priceScaleId: 'rsi',
      priceFormat: { type: 'custom', minMove: 0.01, formatter: v => v.toFixed(1) },
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
    });
    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0.0 },
      borderColor: '#2a2e39',
    });

    // ── MACD sub-pane ───────────────────────────────────────────────────────
    const macdHistSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      priceFormat: { type: 'custom', minMove: 0.001, formatter: v => v.toFixed(2) },
      lastValueVisible: false,
    });
    const macdLineSeries = chart.addSeries(LineSeries, {
      color: '#2962ff', lineWidth: 1, priceScaleId: 'macd',
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    const macdSignalSeries = chart.addSeries(LineSeries, {
      color: '#ff6d00', lineWidth: 1, priceScaleId: 'macd',
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.0, bottom: 0.0 },
      visible: false,
    });

    // ── Crosshair OHLC tracking ─────────────────────────────────────────────
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
      ema20: ema20Series, ema50: ema50Series, ema200: ema200Series,
      rsi: rsiSeries,
      macdHist: macdHistSeries, macdLine: macdLineSeries, macdSignal: macdSignalSeries,
    };

    chartRef.current = chart;

    // ── ResizeObserver for auto-resize ──────────────────────────────────────
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

    return () => {
      ro.disconnect();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
      seriesRef.current = {};
      priceLineRefs.current = {};
    };
  }, []); // only on mount

  // ── Load candles when timeframe changes ───────────────────────────────────
  useEffect(() => {
    fetchCandles(timeframe);
  }, [timeframe, instrument]);

  // ── Also refresh when parent-provided candles prop changes (live ticks) ──
  useEffect(() => {
    if (!candles || candles.length === 0) return;
    // If parent has fresher data, merge with existing
    setLwcCandles(prev => {
      const fromProp = prepareLwcCandles(candles);
      if (fromProp.length === 0) return prev;
      if (prev.length === 0) return fromProp;
      // Update or append last candle only (for live tick)
      const last = fromProp[fromProp.length - 1];
      const existing = prev.find(c => c.time === last.time);
      if (!existing) return [...prev, last]; // new candle
      return prev.map(c => c.time === last.time ? last : c); // update existing
    });
  }, [candles]);

  // ── Set data into LWC series whenever lwcCandles changes ─────────────────
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current.candle || lwcCandles.length === 0) return;
    const s = seriesRef.current;

    // Candle data
    s.candle.setData(lwcCandles);

    // Volume
    if (showVolume) {
      s.volume.setData(lwcCandles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(8,153,129,0.4)' : 'rgba(242,54,69,0.4)',
      })));
    }

    // EMA 20/50/200
    if (showIndicators && lwcCandles.length >= 20) {
      s.ema20.setData(computeEma(lwcCandles, 20));
    }
    if (showIndicators && lwcCandles.length >= 50) {
      s.ema50.setData(computeEma(lwcCandles, 50));
    }
    if (showIndicators && lwcCandles.length >= 200) {
      s.ema200.setData(computeEma(lwcCandles, 200));
    }

    // RSI
    if (showRsi && lwcCandles.length > 14) {
      s.rsi.setData(computeRsi(lwcCandles));
      chart_priceScale_rsi_visible(true);
    } else {
      s.rsi.setData([]);
    }

    // MACD
    if (showMacd && lwcCandles.length > 35) {
      const { macdLine, signalLine, hist } = computeMacd(lwcCandles);
      s.macdHist.setData(hist);
      s.macdLine.setData(macdLine);
      s.macdSignal.setData(signalLine);
      show_macd_scale(true);
    } else {
      s.macdHist.setData([]);
      s.macdLine.setData([]);
      s.macdSignal.setData([]);
    }

    // Fit content on first load
    chartRef.current.timeScale().fitContent();
  }, [lwcCandles, showIndicators, showRsi, showMacd, showVolume]);

  // Helper to toggle RSI pane visibility
  function chart_priceScale_rsi_visible(visible) {
    if (!chartRef.current) return;
    chartRef.current.priceScale('rsi').applyOptions({ scaleMargins: visible ? { top: 0.78, bottom: 0.0 } : { top: 0.99, bottom: 0 } });
  }

  function show_macd_scale(visible) {
    if (!chartRef.current) return;
    chartRef.current.priceScale('macd').applyOptions({ visible });
  }

  // ── Live price line & current price sync ──────────────────────────────────
  useEffect(() => {
    if (currentPrice) setLocalCurrentPrice(currentPrice);
  }, [currentPrice]);

  useEffect(() => {
    if (!seriesRef.current.candle || !localCurrentPrice) return;
    const s = seriesRef.current.candle;
    // Remove old live line
    if (priceLineRefs.current.live) {
      try { s.removePriceLine(priceLineRefs.current.live); } catch (_) {}
    }
    priceLineRefs.current.live = s.createPriceLine({
      price: localCurrentPrice,
      color: '#2962ff',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Live',
    });
  }, [localCurrentPrice]);

  // ── MarketDataService live tick subscription ───────────────────────────────
  useEffect(() => {
    if (!marketDataServiceInstance) return;
    const unsub = marketDataServiceInstance.subscribe((event) => {
      if (!event) return;
      // Update live price
      if (event.price && Number.isFinite(event.price)) {
        setLocalCurrentPrice(event.price);
      }
      // Update last candle in real-time
      if (event.candle && seriesRef.current.candle) {
        try {
          const c = event.candle;
          const t = Math.floor(new Date(c.timestamp || c.time || 0).getTime() / 1000);
          if (t > 0) {
            seriesRef.current.candle.update({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
            if (seriesRef.current.volume && c.volume) {
              seriesRef.current.volume.update({
                time: t, value: c.volume,
                color: c.close >= c.open ? 'rgba(8,153,129,0.4)' : 'rgba(242,54,69,0.4)',
              });
            }
          }
        } catch (_) {}
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // ── Demo position price lines (Entry/SL/TP) ───────────────────────────────
  useEffect(() => {
    if (!seriesRef.current.candle) return;
    const s = seriesRef.current.candle;

    // Remove all old position lines
    Object.keys(priceLineRefs.current).forEach(k => {
      if (k.startsWith('pos_')) {
        try { s.removePriceLine(priceLineRefs.current[k]); } catch (_) {}
        delete priceLineRefs.current[k];
      }
    });

    // Draw new position lines
    openPositions.forEach(pos => {
      const id = pos.ticket || pos.id;
      const isBuy = pos.direction === 'BUY' || pos.side === 'BUY';

      if (Number.isFinite(pos.entryPrice)) {
        priceLineRefs.current[`pos_${id}_entry`] = s.createPriceLine({
          price: pos.entryPrice,
          color: isBuy ? '#089981' : '#f23645',
          lineWidth: 1.5,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${isBuy ? '▲ BUY' : '▼ SELL'} ${pos.lotSize || pos.lots || ''}`,
        });
      }
      if (Number.isFinite(pos.stopLoss) && pos.stopLoss > 0) {
        priceLineRefs.current[`pos_${id}_sl`] = s.createPriceLine({
          price: pos.stopLoss,
          color: '#ff5252',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'SL',
        });
      }
      if (Number.isFinite(pos.takeProfit1) && pos.takeProfit1 > 0) {
        priceLineRefs.current[`pos_${id}_tp1`] = s.createPriceLine({
          price: pos.takeProfit1,
          color: '#00e676',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TP1',
        });
      }
      if (Number.isFinite(pos.takeProfit2) && pos.takeProfit2 > 0) {
        priceLineRefs.current[`pos_${id}_tp2`] = s.createPriceLine({
          price: pos.takeProfit2,
          color: '#00bfa5',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TP2',
        });
      }
    });
  }, [openPositions]);

  // ── S&D Zone overlays (via price lines) ───────────────────────────────────
  const sdZones = useMemo(() => detectSupplyDemandZones(
    lwcCandles.map(c => ({ ...c, timestamp: new Date(c.time * 1000).toISOString() })), timeframe
  ), [lwcCandles, timeframe]);

  useEffect(() => {
    if (!seriesRef.current.candle || !showSdZones) return;
    const s = seriesRef.current.candle;

    // Remove old zone lines
    Object.keys(priceLineRefs.current).forEach(k => {
      if (k.startsWith('zone_')) {
        try { s.removePriceLine(priceLineRefs.current[k]); } catch (_) {}
        delete priceLineRefs.current[k];
      }
    });

    if (!showSdZones) return;

    // Supply zones (red)
    (sdZones?.supply || []).forEach((z, i) => {
      priceLineRefs.current[`zone_supply_hi_${i}`] = s.createPriceLine({
        price: z.high, color: 'rgba(242,54,69,0.8)', lineWidth: 1,
        lineStyle: LineStyle.Solid, axisLabelVisible: false,
        title: `SUPPLY ${z.testCount > 0 ? 'T' : 'F'}`,
      });
      priceLineRefs.current[`zone_supply_lo_${i}`] = s.createPriceLine({
        price: z.low, color: 'rgba(242,54,69,0.5)', lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '',
      });
    });

    // Demand zones (green)
    (sdZones?.demand || []).forEach((z, i) => {
      priceLineRefs.current[`zone_demand_hi_${i}`] = s.createPriceLine({
        price: z.high, color: 'rgba(8,153,129,0.5)', lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '',
      });
      priceLineRefs.current[`zone_demand_lo_${i}`] = s.createPriceLine({
        price: z.low, color: 'rgba(8,153,129,0.8)', lineWidth: 1,
        lineStyle: LineStyle.Solid, axisLabelVisible: false,
        title: `DEMAND ${z.testCount > 0 ? 'T' : 'F'}`,
      });
    });
  }, [sdZones, showSdZones]);

  // ── Escape fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Trigger resize when fullscreen changes
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;
    setTimeout(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
        chartRef.current.timeScale().fitContent();
      }
    }, 150);
  }, [isFullscreen]);

  // ── EMA visibility toggling ────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current.ema20) return;
    const v = showIndicators;
    seriesRef.current.ema20.applyOptions({ visible: v });
    seriesRef.current.ema50.applyOptions({ visible: v });
    seriesRef.current.ema200.applyOptions({ visible: v });
  }, [showIndicators]);

  useEffect(() => {
    if (!seriesRef.current.rsi) return;
    seriesRef.current.rsi.applyOptions({ visible: showRsi });
    chart_priceScale_rsi_visible(showRsi);
  }, [showRsi]);

  useEffect(() => {
    if (!seriesRef.current.macdHist) return;
    const v = showMacd;
    seriesRef.current.macdHist.applyOptions({ visible: v });
    seriesRef.current.macdLine.applyOptions({ visible: v });
    seriesRef.current.macdSignal.applyOptions({ visible: v });
    show_macd_scale(v);
  }, [showMacd]);

  useEffect(() => {
    if (!seriesRef.current.volume) return;
    seriesRef.current.volume.applyOptions({ visible: showVolume });
  }, [showVolume]);

  // ── Chart type toggle (candle vs line) ────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current.candle) return;
    if (chartType === 'line') {
      seriesRef.current.candle.applyOptions({
        upColor: 'transparent', downColor: 'transparent',
        borderVisible: false, wickVisible: false,
      });
    } else {
      seriesRef.current.candle.applyOptions({
        upColor: '#089981', downColor: '#f23645',
        borderVisible: false, wickUpColor: '#089981', wickDownColor: '#f23645',
        wickVisible: true,
      });
    }
  }, [chartType]);

  // ── OHLC header format ────────────────────────────────────────────────────
  const displayPrice = localCurrentPrice || (lwcCandles.length ? lwcCandles[lwcCandles.length - 1].close : null);
  const ohlcBar = hoverOhlc || (lwcCandles.length ? lwcCandles[lwcCandles.length - 1] : null);
  const prevClose = lwcCandles.length > 1 ? lwcCandles[lwcCandles.length - 2].close : null;
  const ohlcChange = ohlcBar && prevClose ? (ohlcBar.close - prevClose).toFixed(2) : '0.00';
  const ohlcChangePct = ohlcBar && prevClose ? ((ohlcBar.close - prevClose) / prevClose * 100).toFixed(2) : '0.00';

  // ── Price scale zoom helpers ──────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    ts.applyOptions({ barSpacing: Math.min(ts.options().barSpacing * 1.3, 50) });
  }, []);
  const handleZoomOut = useCallback(() => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    ts.applyOptions({ barSpacing: Math.max(ts.options().barSpacing / 1.3, 1) });
  }, []);
  const handleAutoScale = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    chartRef.current.priceScale('right').applyOptions({ autoScale: true });
  }, []);

  // ── BUY/SELL ask/bid from live price ─────────────────────────────────────
  const spreadNum = parseFloat(spread) || 0.35;
  const ask = displayPrice ? displayPrice + spreadNum * 0.5 : null;
  const bid = displayPrice ? displayPrice - spreadNum * 0.5 : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const BTN = {
    padding: '3px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, border: '1px solid #2a2e39',
    background: 'rgba(30,34,45,0.9)', color: '#94a3b8',
    cursor: 'pointer', transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  };
  const BTN_ACTIVE = { ...BTN, background: 'rgba(41,98,255,0.25)', color: '#38bdf8', border: '1px solid #2962ff' };
  const BTN_TF = (active) => ({
    ...BTN,
    ...(active ? { background: 'rgba(41,98,255,0.3)', color: '#fff', border: '1px solid #2962ff' } : {}),
    padding: '3px 7px', fontSize: 11, fontWeight: 800,
  });

  const containerStyle = isFullscreen ? {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', flexDirection: 'column',
    background: '#131722',
  } : {
    display: 'flex', flexDirection: 'column',
    width: '100%', height: '100%',
    background: '#131722', borderRadius: 8, overflow: 'hidden',
    border: '1px solid #2a2e39',
  };

  return (
    <div style={containerStyle}>
      {/* ── TOOLBAR ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        padding: '5px 8px',
        background: '#131722', borderBottom: '1px solid #2a2e39',
        minHeight: 36, flexShrink: 0,
      }}>
        {/* Symbol + TF */}
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12, marginRight: 4 }}>
          {instrument}
        </span>
        <span style={{ color: '#64748b', fontSize: 10, marginRight: 4 }}>XM MT5</span>

        {/* Timeframe buttons */}
        {TIMEFRAMES.map(tf => (
          <button key={tf} style={BTN_TF(timeframe === tf)}
            onClick={() => { if (onTimeframeChange) onTimeframeChange(tf); }}>
            {tf}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: '#2a2e39', margin: '0 4px' }} />

        {/* Chart type */}
        <button style={chartType === 'candles' ? BTN_ACTIVE : BTN}
          onClick={() => setChartType('candles')}>📊 Candles</button>
        <button style={chartType === 'line' ? BTN_ACTIVE : BTN}
          onClick={() => setChartType('line')}>〰 Line</button>

        <div style={{ width: 1, height: 20, background: '#2a2e39', margin: '0 4px' }} />

        {/* Indicators */}
        <button style={showIndicators ? BTN_ACTIVE : BTN}
          onClick={() => setShowIndicators(p => !p)}>
          EMA 20/50/200{showIndicators ? ' ✓' : ''}
        </button>
        <button style={showRsi ? BTN_ACTIVE : BTN}
          onClick={() => setShowRsi(p => !p)}>
          RSI 14{showRsi ? ' ✓' : ''}
        </button>
        <button style={showMacd ? BTN_ACTIVE : BTN}
          onClick={() => setShowMacd(p => !p)}>
          MACD{showMacd ? ' ✓' : ''}
        </button>
        <button style={showSdZones ? { ...BTN_ACTIVE, color: '#86efac' } : BTN}
          onClick={() => setShowSdZones(p => !p)}>
          🔲 S&D{showSdZones ? ' ✓' : ''}
        </button>

        <div style={{ flex: 1 }} />

        {/* Status */}
        <span style={{
          fontSize: 9, fontFamily: 'monospace', padding: '2px 6px',
          borderRadius: 3, border: '1px solid',
          borderColor: dataStatus === 'LIVE' || dataStatus?.includes('LIVE') ? '#059669' : '#64748b',
          color: dataStatus === 'LIVE' || dataStatus?.includes('LIVE') ? '#34d399' : '#94a3b8',
          background: dataStatus === 'LIVE' || dataStatus?.includes('LIVE') ? 'rgba(5,150,105,0.1)' : 'transparent',
        }}>
          {isFetching ? '⟳ LOADING' : dataStatus}
        </span>

        {/* Zoom controls */}
        <button style={BTN} onClick={handleZoomIn} title="Zoom In (rapat candle)">+</button>
        <button style={BTN} onClick={handleZoomOut} title="Zoom Out (renggang candle)">−</button>
        <button style={BTN} onClick={handleAutoScale} title="Auto fit semua candle">AUTO</button>

        {/* Fullscreen */}
        <button style={{ ...BTN, padding: '3px 6px', fontSize: 12 }}
          onClick={() => setIsFullscreen(p => !p)}
          title={isFullscreen ? 'Keluar Fullscreen (Esc)' : 'Expand Chart Fullscreen'}>
          {isFullscreen ? '⊠' : '⛶'}
        </button>
      </div>

      {/* ── OHLC HEADER ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '3px 10px', background: '#131722',
        borderBottom: '1px solid #1e222d', flexShrink: 0,
        fontSize: 11, fontFamily: 'monospace',
      }}>
        <span style={{ color: '#94a3b8', fontWeight: 700 }}>{instrument} · {timeframe}</span>
        {ohlcBar && (<>
          <span style={{ color: '#94a3b8' }}>O <span style={{ color: '#e2e8f0' }}>{ohlcBar.open?.toFixed(2)}</span></span>
          <span style={{ color: '#94a3b8' }}>H <span style={{ color: '#089981' }}>{ohlcBar.high?.toFixed(2)}</span></span>
          <span style={{ color: '#94a3b8' }}>L <span style={{ color: '#f23645' }}>{ohlcBar.low?.toFixed(2)}</span></span>
          <span style={{ color: '#94a3b8' }}>C <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{ohlcBar.close?.toFixed(2)}</span></span>
          <span style={{ color: parseFloat(ohlcChange) >= 0 ? '#089981' : '#f23645', fontWeight: 700 }}>
            {parseFloat(ohlcChange) >= 0 ? '+' : ''}{ohlcChange} ({parseFloat(ohlcChangePct) >= 0 ? '+' : ''}{ohlcChangePct}%)
          </span>
          {ohlcBar.volume > 0 && (
            <span style={{ color: '#64748b' }}>Vol <span style={{ color: '#94a3b8' }}>{(ohlcBar.volume / 1000).toFixed(1)}K</span></span>
          )}
        </>)}
        {showIndicators && lwcCandles.length >= 20 && (<>
          <span style={{ color: '#00e5ff', fontSize: 10 }}>EMA 20</span>
          <span style={{ color: '#eab308', fontSize: 10 }}>EMA 50</span>
          <span style={{ color: '#c084fc', fontSize: 10 }}>EMA 200</span>
        </>)}
        {fetchError && <span style={{ color: '#f59e0b', fontSize: 9 }}>⚠ {fetchError}</span>}
      </div>

      {/* ── CHART CANVAS (LWC renders here) ──────────────────────────────────── */}
      <div
        ref={chartContainerRef}
        style={{ flex: 1, minHeight: 0, position: 'relative', width: '100%' }}
      />

      {/* ── BUY / SELL BAR ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'stretch', flexShrink: 0,
        height: 56, background: '#0a0f1e',
        borderTop: '1px solid #2a2e39',
      }}>
        {/* SELL */}
        <button
          onClick={() => onSellClick && onSellClick()}
          style={{
            flex: 1, background: '#dc2626', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2,
          }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 10, letterSpacing: 1 }}>SELL / SHORT</span>
          <span style={{ color: '#fecaca', fontWeight: 800, fontSize: 15, fontFamily: 'monospace' }}>
            {bid ? bid.toFixed(2) : '—'}
          </span>
        </button>

        {/* Spread */}
        <div style={{
          width: 80, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2,
          background: '#0d1117', borderLeft: '1px solid #2a2e39', borderRight: '1px solid #2a2e39',
        }}>
          <span style={{ color: '#64748b', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>SPREAD</span>
          <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, fontFamily: 'monospace' }}>
            {spreadNum.toFixed(2)}
          </span>
          <span style={{ fontSize: 7, color: '#475569', fontFamily: 'monospace' }}>pts</span>
        </div>

        {/* BUY */}
        <button
          onClick={() => onBuyClick && onBuyClick()}
          style={{
            flex: 1, background: '#16a34a', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2,
          }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 10, letterSpacing: 1 }}>BUY / LONG</span>
          <span style={{ color: '#bbf7d0', fontWeight: 800, fontSize: 15, fontFamily: 'monospace' }}>
            {ask ? ask.toFixed(2) : '—'}
          </span>
        </button>
      </div>
    </div>
  );
}

