/** @format */
/**
 * AI Analyst Panel — analyzes validated OHLC candles from MarketDataService.
 * Signals are informational and are withheld when data is missing or insufficient.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { marketDataServiceInstance, TIMEFRAMES } from '../../services/trading/MarketDataService.js';
import { getChartCandles } from '../../services/trading/ChartReader.js';
import { calculateIndicators } from '../../services/trading/IndicatorCalculator.js';

const initialState = {
  dataStatus: 'DISCONNECTED', dataFreshness: 'UNKNOWN', candleCount: 0,
  trend: 'NEUTRAL', momentum: 'NEUTRAL', volatility: 'UNKNOWN',
  support: null, resistance: null, scenario: 'WAIT', confidence: 0,
  entryCondition: 'Menunggu data harga yang valid.', stopLoss: null,
  takeProfit: null, riskReward: null, reasoning: 'Menunggu data pasar...',
  invalidation: 'Sinyal tidak berlaku sebelum data mencukupi.',
  lastAnalysis: null, price: null,
};

const number = (value, digits = 2) =>
  Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const priceDigits = (symbol) => symbol === 'XAUUSD' ? 2 : 5;

export default function AIAnalystPanel({ instrument = 'XAUUSD', timeframe = TIMEFRAMES.M15 }) {
  const [analysis, setAnalysis] = useState(initialState);

  useEffect(() => {
    let active = true;
    const runAnalysis = () => {
      const result = getChartCandles(instrument, timeframe, 200);
      const candles = result?.candles || [];
      const tick = marketDataServiceInstance.getTick(instrument);
      const latest = candles[candles.length - 1];
      const price = Number.isFinite(tick?.bid) ? tick.bid : (latest?.close ?? null);
      const base = {
        ...initialState, instrument, timeframe,
        dataStatus: result?.status === 'READY' && candles.length >= 20 ? 'CONNECTED' : candles.length ? 'INSUFFICIENT_DATA' : 'NO_DATA',
        dataFreshness: result?.freshness || 'UNKNOWN', candleCount: candles.length,
        price, lastAnalysis: new Date().toISOString(),
      };

      if (candles.length < 50) {
        if (active) setAnalysis({
          ...base, confidence: 0,
          reasoning: `Data historis ${instrument} ${timeframe} belum mencukupi (${candles.length} candle; minimal 50 untuk konfigurasi EMA 50). Analisis dan sinyal ditahan sampai data tersedia.`,
          entryCondition: 'Belum tersedia — data tidak mencukupi.',
          invalidation: 'Tidak ada sinyal aktif.',
        });
        return;
      }

      const indicators = calculateIndicators(candles, { emaPeriods: [9, 20, 50], rsiPeriod: 14, atrPeriod: 14 });
      if (indicators.error) {
        if (active) setAnalysis({ ...base, dataStatus: 'INSUFFICIENT_DATA', reasoning: 'Indikator tidak dapat dihitung dari data yang tersedia.' });
        return;
      }

      const recent = candles.slice(-20);
      const support = Math.min(...recent.map(c => c.low));
      const resistance = Math.max(...recent.map(c => c.high));
      const ema9 = indicators.ema[9], ema20 = indicators.ema[20], ema50 = indicators.ema[50];
      const bullish = price > ema20 && ema9 > ema20 && ema20 > ema50;
      const bearish = price < ema20 && ema9 < ema20 && ema20 < ema50;
      const rsi = indicators.rsi, atr = indicators.atr;
      const momentum = rsi == null ? 'UNKNOWN' : rsi >= 55 ? 'BULLISH' : rsi <= 45 ? 'BEARISH' : 'NEUTRAL';
      const trend = bullish ? 'BULLISH' : bearish ? 'BEARISH' : 'SIDEWAYS';
      const rawScenario = bullish && rsi < 70 ? 'BUY BIAS' : bearish && rsi > 30 ? 'SELL BIAS' : 'WAIT';
      const freshness = result.freshness || 'UNKNOWN';
      const isStale = ['STALE', 'UNKNOWN', 'NO_DATA', 'ERROR', 'SIMULATED'].includes(freshness);
      const scenario = isStale ? 'WAIT' : rawScenario;
      const stopLoss = scenario === 'BUY BIAS' && atr ? price - atr * 1.5 : scenario === 'SELL BIAS' && atr ? price + atr * 1.5 : null;
      const takeProfit = scenario === 'BUY BIAS' && atr ? price + atr * 3 : scenario === 'SELL BIAS' && atr ? price - atr * 3 : null;
      const riskReward = stopLoss != null && takeProfit != null ? Math.abs(takeProfit - price) / Math.abs(price - stopLoss) : null;
      const confidence = scenario === 'WAIT' ? 0 : Math.min(80, 50 + Math.abs((rsi ?? 50) - 50) * 0.6);
      const reasoning = [
        `Tren ${trend}; momentum ${momentum}; RSI ${number(rsi, 1)}.`,
        `EMA 9/20/50: ${number(ema9)}/${number(ema20)}/${number(ema50)}.`,
        `ATR(14): ${number(atr)}. Support/resistance 20 candle: ${number(support)}/${number(resistance)}.`,
        isStale ? `PERINGATAN: freshness data ${freshness}; sinyal ditahan sampai data non-simulasi dan segar tersedia.` : `Freshness data: ${freshness}.`,
        'Bias analitis berbasis candle, bukan jaminan hasil atau instruksi transaksi.',
      ].join(' ');
      if (active) setAnalysis({
        ...base, dataStatus: isStale ? 'STALE' : 'CONNECTED', trend, momentum,
        volatility: atr != null && price != null && price !== 0 ? (atr / price > 0.01 ? 'HIGH' : 'NORMAL') : 'UNKNOWN',
        support, resistance, scenario, confidence: Math.round(confidence),
        entryCondition: isStale ? 'Tunggu data segar dan konfirmasi candle.' : scenario === 'BUY BIAS' ? 'Tunggu konfirmasi bullish; jangan entry hanya berdasarkan bias.' : scenario === 'SELL BIAS' ? 'Tunggu konfirmasi bearish; jangan entry hanya berdasarkan bias.' : 'Belum ada konfirmasi arah yang memadai.',
        stopLoss: isStale ? null : stopLoss, takeProfit: isStale ? null : takeProfit,
        riskReward: isStale ? null : riskReward, reasoning,
        invalidation: scenario === 'BUY BIAS' ? `Bias bullish melemah bila harga turun di bawah EMA20 (${number(ema20)}).` : scenario === 'SELL BIAS' ? `Bias bearish melemah bila harga naik di atas EMA20 (${number(ema20)}).` : 'Tunggu struktur tren yang lebih jelas.',
      });
    };

    const unsubscribe = marketDataServiceInstance.subscribe(runAnalysis);
    runAnalysis();
    return () => { active = false; unsubscribe?.(); };
  }, [instrument, timeframe]);

  const digits = priceDigits(instrument);
  const rows = useMemo(() => [
    ['Status Data', analysis.dataStatus], ['Freshness', analysis.dataFreshness],
    ['Jumlah Candle', String(analysis.candleCount)], ['Harga', number(analysis.price, digits)],
    ['Tren', analysis.trend], ['Momentum', analysis.momentum], ['Volatilitas', analysis.volatility],
    ['Support', number(analysis.support, digits)], ['Resistance', number(analysis.resistance, digits)],
    ['Stop Loss (indikatif)', number(analysis.stopLoss, digits)], ['Take Profit (indikatif)', number(analysis.takeProfit, digits)],
    ['Risk/Reward', analysis.riskReward == null ? '—' : `1:${number(analysis.riskReward, 2)}`],
    ['Confidence heuristik', `${analysis.confidence}%`],
  ], [analysis, digits]);

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
