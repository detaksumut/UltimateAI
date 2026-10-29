/** @format */
/**
 * AI Analyst Panel — uses the project's actual MarketDataService and ChartReader APIs.
 * Never presents a directional bias as a confirmed trade signal.
 */
import React, { useEffect, useState } from 'react';
import { marketDataServiceInstance, TIMEFRAMES } from '../../services/trading/MarketDataService.js';
import { getChartCandles } from '../../services/trading/ChartReader.js';
import { calculateIndicators } from '../../services/trading/IndicatorCalculator.js';

const initialState = {
  instrument: 'XAUUSD', timeframe: TIMEFRAMES.M15,
  dataStatus: 'DISCONNECTED', dataFreshness: 'UNKNOWN', candleCount: 0,
  marketStructure: 'UNKNOWN', trend: 'NEUTRAL', momentum: 'NEUTRAL',
  volatility: 'UNKNOWN', support: null, resistance: null, scenario: 'WAIT',
  confidence: 0, entryCondition: 'Menunggu data harga yang valid.',
  stopLoss: null, takeProfit: null, riskReward: null, confidenceScore: 0,
  reasoning: 'Menunggu data pasar...', invalidation: 'Tidak ada sinyal aktif.',
  lastAnalysis: null, price: null,
};

const fmt = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  : '—';

export default function AIAnalystPanel({ instrument = 'XAUUSD', timeframe = TIMEFRAMES.M15 }) {
  const [analysis, setAnalysis] = useState({ ...initialState, instrument, timeframe });
  const [visualData, setVisualData] = useState(null);

  useEffect(() => {
    const onVisualData = (event) => {
      const data = event.detail || {};
      if (data.instrument !== instrument || data.timeframe !== timeframe) return;
      setVisualData(data);
    };
    window.addEventListener('jin:visual-analysis-ready', onVisualData);
    return () => window.removeEventListener('jin:visual-analysis-ready', onVisualData);
  }, [instrument, timeframe]);

  useEffect(() => {
    let active = true;

    const runAnalysis = () => {
      const result = getChartCandles(instrument, timeframe, 200);
      const candles = result.candles || [];
      const tick = marketDataServiceInstance.getTick(instrument);
      const latest = candles[candles.length - 1];
      const price = Number.isFinite(tick?.bid) ? tick.bid : (latest?.close ?? null);
      const base = {
        ...initialState, instrument, timeframe, price,
        candleCount: candles.length, dataFreshness: result.freshness || 'UNKNOWN',
        dataStatus: result.status === 'ERROR' ? 'ERROR' : candles.length ? 'CONNECTED' : 'NO_DATA',
        lastAnalysis: new Date().toISOString(),
      };

      if (candles.length < 50) {
        if (active) setAnalysis({
          ...base, dataStatus: candles.length ? 'INSUFFICIENT_DATA' : base.dataStatus,
          reasoning: `Data candle ${instrument} ${timeframe} belum mencukupi: ${candles.length}/50 candle minimum. Sinyal ditahan sampai data tersedia.`,
          entryCondition: 'Belum tersedia — data tidak mencukupi.',
          confidence: 0, confidenceScore: 0,
        });
        return;
      }

      const indicators = calculateIndicators(candles, { emaPeriods: [9, 20, 50], rsiPeriod: 14, atrPeriod: 14 });
      if (indicators.error || !Number.isFinite(price)) {
        if (active) setAnalysis({
          ...base, dataStatus: 'INSUFFICIENT_DATA', confidence: 0,
          reasoning: 'Indikator atau harga tidak dapat dihitung dari data yang tersedia.',
          entryCondition: 'Tunggu data harga valid.', confidenceScore: 0,
        });
        return;
      }

      const recent = candles.slice(-20);
      const support = Math.min(...recent.map(c => c.low));
      const resistance = Math.max(...recent.map(c => c.high));
      const { 9: ema9, 20: ema20, 50: ema50 } = indicators.ema;
      const rsi = indicators.rsi;
      const atr = indicators.atr;
      const bullish = price > ema20 && ema9 > ema20 && ema20 > ema50;
      const bearish = price < ema20 && ema9 < ema20 && ema20 < ema50;
      const trend = bullish ? 'BULLISH' : bearish ? 'BEARISH' : 'SIDEWAYS';
      const momentum = !Number.isFinite(rsi) ? 'UNKNOWN' : rsi >= 55 ? 'BULLISH' : rsi <= 45 ? 'BEARISH' : 'NEUTRAL';
      const stale = ['STALE', 'RECENT', 'SIMULATED', 'UNKNOWN', 'ERROR', 'NO_DATA'].includes(result.freshness);
      const scenario = stale || !Number.isFinite(rsi) || !Number.isFinite(atr) || ![ema9, ema20, ema50].every(Number.isFinite)
        ? 'WAIT' : bullish && rsi < 70 ? 'BUY BIAS' : bearish && rsi > 30 ? 'SELL BIAS' : 'WAIT';
      const stopLoss = Number.isFinite(atr) && scenario === 'BUY BIAS' ? price - atr * 1.5
        : Number.isFinite(atr) && scenario === 'SELL BIAS' ? price + atr * 1.5 : null;
      const takeProfit = Number.isFinite(atr) && scenario === 'BUY BIAS' ? price + atr * 3
        : Number.isFinite(atr) && scenario === 'SELL BIAS' ? price - atr * 3 : null;
      const riskReward = stopLoss != null && takeProfit != null && price !== stopLoss
        ? Math.abs(takeProfit - price) / Math.abs(price - stopLoss) : null;
      const confidence = scenario === 'WAIT' ? 0 : Math.min(80, Math.round(50 + Math.abs((rsi ?? 50) - 50) * 0.6));
      const reasoning = [
        `Tren ${trend}; momentum ${momentum}; RSI ${fmt(rsi, 1)}.`,
        `EMA 9/20/50: ${fmt(ema9)}/${fmt(ema20)}/${fmt(ema50)}.`,
        `ATR(14): ${fmt(atr)}; support/resistance 20 candle: ${fmt(support)}/${fmt(resistance)}.`,
        `Freshness data: ${result.freshness || 'UNKNOWN'}.`,
        stale ? 'Data stale/simulasi/tidak diketahui; bias trading ditahan.' : 'Bias ini bukan konfirmasi entry dan bukan jaminan hasil.',
      ].join(' ');

      if (active) setAnalysis({
        ...base, dataStatus: stale ? (result.freshness === 'RECENT' ? 'DATA_AGING' : 'STALE') : 'CONNECTED',
        marketStructure: trend, trend, momentum,
        volatility: Number.isFinite(atr) && price ? (atr / price > 0.01 ? 'HIGH' : 'NORMAL') : 'UNKNOWN',
        support, resistance, scenario, confidence, confidenceScore: confidence,
        entryCondition: stale ? 'Tunggu data segar dan konfirmasi candle.'
          : scenario === 'BUY BIAS' ? 'Bias bullish; tunggu konfirmasi entry terpisah.'
          : scenario === 'SELL BIAS' ? 'Bias bearish; tunggu konfirmasi entry terpisah.'
          : 'Belum ada konfirmasi arah yang memadai.',
        stopLoss: stale ? null : stopLoss, takeProfit: stale ? null : takeProfit,
        riskReward: stale ? null : riskReward, reasoning,
        invalidation: scenario === 'BUY BIAS' ? `Bias melemah bila harga turun di bawah EMA20 (${fmt(ema20)}).`
          : scenario === 'SELL BIAS' ? `Bias melemah bila harga naik di atas EMA20 (${fmt(ema20)}).`
          : 'Tunggu struktur tren yang lebih jelas.',
      });
    };

    const unsubscribe = marketDataServiceInstance.subscribe(runAnalysis);
    runAnalysis();
    return () => { active = false; if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [instrument, timeframe]);

  const digits = instrument === 'XAUUSD' ? 2 : 5;
  const rows = [
    ['Status Data', analysis.dataStatus], ['Freshness', analysis.dataFreshness],
    ['Jumlah Candle', String(analysis.candleCount)], ['Harga', fmt(analysis.price, digits)],
    ['Tren', analysis.trend], ['Momentum', analysis.momentum], ['Volatilitas', analysis.volatility],
    ['Support', fmt(analysis.support, digits)], ['Resistance', fmt(analysis.resistance, digits)],
    ['Stop Loss (indikatif)', fmt(analysis.stopLoss, digits)], ['Take Profit (indikatif)', fmt(analysis.takeProfit, digits)],
    ['Risk/Reward', analysis.riskReward == null ? '—' : `1:${fmt(analysis.riskReward, 2)}`],
    ['Confidence heuristik', `${analysis.confidence}%`],
  ];

  if (visualData) {
    const digits = instrument === 'XAUUSD' ? 2 : 5;
    const visualFmt = value => Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
    const qualityColor = visualData.dataStatus === 'VISUAL_READY' ? '#10b981' : '#f59e0b';
    const visualRows = [
      ['Sumber', 'SCREEN VISION'], ['Status', visualData.dataStatus],
      ['Instrumen', visualData.instrument || instrument], ['Timeframe', visualData.timeframe || timeframe],
      ['Candle terlihat', String(visualData.visible_candles ?? 0)],
      ['OHLC numerik', visualData.ohlc_readable ? 'TERBACA' : 'TIDAK TERBACA'],
      ['Harga terakhir', visualFmt(visualData.last_price)], ['Open', visualFmt(visualData.open)],
      ['High', visualFmt(visualData.high)], ['Low', visualFmt(visualData.low)], ['Close', visualFmt(visualData.close)],
      ['Tren visual', visualData.trend || 'UNKNOWN'], ['Momentum', visualData.momentum || 'UNKNOWN'],
      ['Support visual', visualFmt(visualData.support)], ['Resistance visual', visualFmt(visualData.resistance)],
      ['Volatilitas', visualData.volatility || 'UNKNOWN'], ['Confidence', `${visualData.confidence ?? 0}%`],
    ];
    return <section style={{ color: '#cbd5e1', background: 'rgba(8,15,30,0.92)', border: '1px solid rgba(0,229,255,0.18)', borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 10 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
        <strong style={{ color: '#00e5ff', letterSpacing: '.04em' }}>AI TECHNICAL ANALYST · VISUAL DATA</strong>
        <span style={{ color: qualityColor, fontWeight: 700 }}>{visualData.dataStatus}</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '7px 12px' }}>
        {visualRows.map(([label, value]) => <div key={label} style={{ minWidth: 0 }}>
          <div style={{ color: '#64748b', fontSize: 9, marginBottom: 2 }}>{label}</div>
          <div style={{ color: label === 'Tren visual' && visualData.trend === 'BULLISH' ? '#10b981' : label === 'Tren visual' && visualData.trend === 'BEARISH' ? '#f87171' : '#e2e8f0', overflowWrap: 'anywhere' }}>{value}</div>
        </div>)}
      </div>
      <div style={{ marginTop: 9, padding: 8, borderRadius: 5, background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.1)' }}>
        <div style={{ color: '#00e5ff', fontWeight: 700 }}>SKENARIO: {visualData.dataStatus === 'VISUAL_READY' ? (visualData.scenario || 'WAIT') : 'WAIT'}</div>
        <div style={{ color: '#94a3b8', marginTop: 5 }}>{visualData.note || 'Hasil berasal dari pembacaan visual screenshot.'}</div>
        <div style={{ color: '#fbbf24', marginTop: 5 }}>Angka yang tidak terbaca ditampilkan sebagai —, bukan ditebak. Screenshot: {visualData.capturedAt ? new Date(visualData.capturedAt).toLocaleTimeString() : '—'}.</div>
      </div>
    </section>;
  }

  const statusColor = analysis.dataStatus === 'CONNECTED' ? '#10b981' : '#f59e0b';
  return (
    <section style={{ color: '#cbd5e1', background: 'rgba(8,15,30,0.92)', border: '1px solid rgba(0,229,255,0.18)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 11 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <strong style={{ color: '#00e5ff', letterSpacing: '.04em' }}>AI TECHNICAL ANALYST</strong>
        <span style={{ color: statusColor, fontWeight: 700 }}>{analysis.dataStatus}</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '7px 14px' }}>
        {rows.map(([label, value]) => <div key={label} style={{ minWidth: 0 }}>
          <div style={{ color: '#64748b', fontSize: 9, marginBottom: 2 }}>{label}</div>
          <div style={{ color: label === 'Tren' && analysis.trend === 'BULLISH' ? '#10b981' : label === 'Tren' && analysis.trend === 'BEARISH' ? '#f87171' : '#e2e8f0', overflowWrap: 'anywhere' }}>{value}</div>
        </div>)}
      </div>
      <div style={{ marginTop: 10, padding: 9, borderRadius: 5, background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.1)' }}>
        <div style={{ color: '#00e5ff', fontWeight: 700, marginBottom: 5 }}>SKENARIO: {analysis.scenario}</div>
        <div style={{ marginBottom: 7 }}>{analysis.entryCondition}</div>
        <div style={{ color: '#94a3b8', marginBottom: 5 }}>{analysis.reasoning}</div>
        <div style={{ color: '#fbbf24' }}>Invalidasi: {analysis.invalidation}</div>
      </div>
      <footer style={{ marginTop: 7, color: '#64748b', fontSize: 9 }}>
        Bukan nasihat keuangan. Sinyal ditahan jika data tidak cukup atau tidak segar.
        {analysis.lastAnalysis ? ` • Analisis: ${new Date(analysis.lastAnalysis).toLocaleTimeString('id-ID')}` : ''}
      </footer>
    </section>
  );
}
