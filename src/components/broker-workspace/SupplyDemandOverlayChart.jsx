/**
 * SupplyDemandOverlayChart.jsx
 * JIN-rendered XM OHLC chart with S&D zone boxes.
 *
 * Important limitation: XM's native WebContentsView chart is a separate native
 * layer and cannot be safely overlaid by renderer HTML. This chart is drawn
 * from the same validated XM OHLC feed inside the JINI panel, so BUY/SELL/SL/TP
 * controls on the native XM chart are never covered or modified.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineStyle,
} from 'lightweight-charts';

const TF_SECONDS = {
  M1: 60,
  M5: 300,
  M15: 900,
  H1: 3600,
  H4: 14_400,
};

function toLwcCandles(candles) {
  if (!Array.isArray(candles)) return [];
  const valid = candles
    .filter((candle) => candle
      && Number.isFinite(Number(candle.open))
      && Number.isFinite(Number(candle.high))
      && Number.isFinite(Number(candle.low))
      && Number.isFinite(Number(candle.close)))
    .map((candle) => ({
      time: Math.floor(Date.parse(candle.timestamp) / 1000),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
    }))
    .filter((candle) => Number.isFinite(candle.time))
    .sort((a, b) => a.time - b.time);

  const deduped = [];
  let lastTime = -Infinity;
  for (const candle of valid) {
    if (candle.time <= lastTime) continue;
    lastTime = candle.time;
    deduped.push(candle);
  }
  return deduped;
}

function toSeconds(timestamp) {
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export default function SupplyDemandOverlayChart({
  candles = [],
  zones = [],
  levels = [],
  showLevels = true,
  timeframe = 'M5',
  height = 190,
}) {
  const containerRef = useRef(null);
  const chartHostRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const zonesRef = useRef(zones);
  const levelLinesRef = useRef([]);
  const resizeRef = useRef(null);

  zonesRef.current = zones;

  const drawZones = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!chart || !series || !container || !canvas) return;

    const width = container.clientWidth;
    const heightPx = container.clientHeight;
    if (width <= 0 || heightPx <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(heightPx * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(heightPx * dpr);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${heightPx}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, heightPx);

    const priceScaleWidth = chart.priceScale('right').width();
    const plotWidth = Math.max(0, width - priceScaleWidth - 2);
    if (plotWidth <= 0) return;
    const visibleRange = chart.timeScale().getVisibleRange();

    for (const zone of zonesRef.current || []) {
      const yHigh = series.priceToCoordinate(zone.high);
      const yLow = series.priceToCoordinate(zone.low);
      if (!Number.isFinite(yHigh) || !Number.isFinite(yLow)) continue;

      const top = Math.min(yHigh, yLow);
      const bottom = Math.max(yHigh, yLow);
      if (bottom - top < 2) continue;

      const originSeconds = toSeconds(zone.originTime);
      if (visibleRange && originSeconds != null && originSeconds > visibleRange.to) {
        continue;
      }
      const rawX = originSeconds == null
        ? null
        : chart.timeScale().timeToCoordinate(originSeconds);
      const xStart = Number.isFinite(rawX) ? Math.max(0, rawX) : 0;
      const xEnd = plotWidth;
      if (xEnd <= xStart) continue;

      const isSupply = zone.side === 'SUPPLY';
      const fill = isSupply ? 'rgba(242,54,69,0.13)' : 'rgba(8,153,129,0.13)';
      const stroke = isSupply ? 'rgba(242,54,69,0.75)' : 'rgba(8,153,129,0.75)';
      const text = isSupply ? '#fda4af' : '#6ee7b7';

      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.fillRect(xStart, top, xEnd - xStart, bottom - top);
      ctx.strokeRect(xStart + 0.5, top + 0.5, Math.max(0, xEnd - xStart - 1), Math.max(0, bottom - top - 1));

      const proximalY = series.priceToCoordinate(zone.proximal);
      const distalY = series.priceToCoordinate(zone.distal);
      if (Number.isFinite(proximalY)) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(xStart, proximalY);
        ctx.lineTo(xEnd, proximalY);
        ctx.stroke();
      }
      if (Number.isFinite(distalY)) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xStart, distalY);
        ctx.lineTo(xEnd, distalY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const label = `${zone.timeframe} ${isSupply ? 'SUPPLY' : 'DEMAND'} ${zone.lifecycle || ''} ${Math.round(zone.score)}`;
      ctx.font = '700 9px Inter, system-ui, sans-serif';
      const labelWidth = ctx.measureText(label).width + 8;
      const labelY = Math.max(2, top + 2);
      ctx.fillStyle = 'rgba(3,8,20,0.82)';
      ctx.fillRect(xStart + 2, labelY, labelWidth, 14);
      ctx.fillStyle = text;
      ctx.fillText(label, xStart + 6, labelY + 10);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const chartHost = chartHostRef.current;
    if (!container || !chartHost) return undefined;

    let disposed = false;

    const chart = createChart(chartHost, {
      width: Math.max(1, container.clientWidth),
      height,
      layout: {
        background: { color: '#050b16' },
        textColor: '#94a3b8',
        fontSize: 10,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.06)' },
        horzLines: { color: 'rgba(148,163,184,0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.18)',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.18)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 5,
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(148,163,184,0.3)', width: 1, style: LineStyle.Dotted },
        horzLine: { color: 'rgba(148,163,184,0.3)', width: 1, style: LineStyle.Dotted },
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onRangeChange = () => {
      if (!disposed) drawZones();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const observer = new ResizeObserver((entries) => {
      if (disposed) return;
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0) return;
      chart.applyOptions({
        width: rect.width,
        height: container.clientHeight || height,
      });
      drawZones();
    });
    observer.observe(container);
    resizeRef.current = observer;

    const frame = requestAnimationFrame(drawZones);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      observer.disconnect();
      resizeRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [drawZones]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return undefined;

    const styleMap = {
      solid: LineStyle.Solid,
      dashed: LineStyle.Dashed,
      dotted: LineStyle.Dotted,
    };

    for (const line of levelLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch (_) {}
    }
    levelLinesRef.current = [];

    if (showLevels) {
      for (const level of levels) {
        const price = Number(level.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        const line = series.createPriceLine({
          price,
          color: level.color || '#94a3b8',
          lineWidth: level.lineWidth === 2 ? 2 : 1,
          lineStyle: styleMap[level.style] ?? LineStyle.Solid,
          axisLabelVisible: true,
          title: level.label || '',
        });
        levelLinesRef.current.push(line);
      }
    }

    return () => {
      for (const line of levelLinesRef.current) {
        try {
          series.removePriceLine(line);
        } catch (_) {}
      }
      levelLinesRef.current = [];
    };
  }, [levels, showLevels, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const lwcCandles = toLwcCandles(candles);
    series.setData(lwcCandles);
    if (lwcCandles.length > 0) {
      chart.timeScale().fitContent();
    }
    const frame = requestAnimationFrame(drawZones);
    return () => cancelAnimationFrame(frame);
  }, [candles, drawZones, timeframe]);

  useEffect(() => {
    const frame = requestAnimationFrame(drawZones);
    return () => cancelAnimationFrame(frame);
  }, [zones, drawZones, timeframe]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid rgba(0,229,255,0.14)',
        background: '#050b16',
      }}
    >
      <div ref={chartHostRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </div>
  );
}
