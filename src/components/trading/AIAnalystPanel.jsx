/** @format */
/**
 * AI Analyst Panel — uses the project's actual MarketDataService and ChartReader APIs.
 * Never presents a directional bias as a confirmed trade signal.
 */
import React, { useEffect, useState } from 'react';
import { marketDataServiceInstance, TIMEFRAMES } from '../../services/trading/MarketDataService.js';
import { getChartCandles } from '../../services/trading/ChartReader.js';
import { calculateIndicators } from '../../services/trading/IndicatorCalculator.js';
import AdvancedAnalysisModal from './JINAdvancedAnalysisModal.jsx';

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
  const [visualResults, setVisualResults] = useState({});
  const [activeTab, setActiveTab] = useState('advanced');
  const [advancedData, setAdvancedData] = useState(null);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

  useEffect(() => {
    setActiveTab('advanced');
  }, [instrument, timeframe]);

  useEffect(() => {
    const onVisualData = (event) => {
      const data = event.detail || {};
      // Keep visual evidence visible even when the chart symbol/timeframe does not match
      // the selected analysis context; the dashboard must show the mismatch, not hide it.
      const normalized = { ...data,
        symbol_match: data.symbol_match ?? (data.instrument === instrument),
        timeframe_match: data.timeframe_match ?? (data.timeframe === timeframe),
        requestedInstrument: instrument,
        requestedTimeframe: timeframe,
      };
      setVisualData(normalized);
      const key = String(normalized.requestedTimeframe || normalized.timeframe || timeframe).toUpperCase();
      setVisualResults(previous => ({ ...previous, [key]: normalized }));
    };
    const onVisualBatch = event => {
      const results = Array.isArray(event.detail?.results) ? event.detail.results : [];
      if (!results.length) return;
      setVisualResults(previous => {
        const next = { ...previous };
        for (const result of results) {
          const key = String(result.requestedTimeframe || result.timeframe || '').toUpperCase();
          if (key) next[key] = { ...result, requestedInstrument: instrument };
        }
        return next;
      });
      const last = results[results.length - 1];
      setVisualData({ ...last, requestedInstrument: instrument });
    };
    window.addEventListener('jin:visual-analysis-ready', onVisualData);
    window.addEventListener('jin:visual-analysis-batch-ready', onVisualBatch);
    return () => {
      window.removeEventListener('jin:visual-analysis-ready', onVisualData);
      window.removeEventListener('jin:visual-analysis-batch-ready', onVisualBatch);
    };
  }, [instrument, timeframe]);

  // Poll the local MT5 bridge for independent H4/H1/M15/M5/D1 OHLC series.
  // TradingView's embedded chart is cross-origin and is not used as a numeric feed.
  useEffect(() => {
    let cancelled = false;
    const timeframes = ['H4','H1','M15','M5','D1'];
    const poll = async () => {
      const results = await Promise.all(timeframes.map(async tf => {
        try {
          const response = await fetch(`http://127.0.0.1:20200/api/trading/ohlc?symbol=${encodeURIComponent(instrument)}&timeframe=${tf}&limit=300`, { cache: 'no-store' });
          if (!response.ok) throw new Error(`MT5 bridge HTTP ${response.status}`);
          return await response.json();
        } catch (error) {
          return { ok: false, timeframe: tf, error: error?.message || 'MT5 bridge unavailable' };
        }
      }));
      if (cancelled) return;
      let total = 0;
      let latestTimestamp = null;
      for (const result of results) {
        if (!result?.ok || !Array.isArray(result.candles)) continue;
        total += result.candles.length;
        if (result.lastUpdate && (!latestTimestamp || Date.parse(result.lastUpdate) > Date.parse(latestTimestamp))) latestTimestamp = result.lastUpdate;
        marketDataServiceInstance.addBatchCandles(result.candles.map(c => ({
          ...c, symbol: instrument, timeframe: result.timeframe, source: 'MT5_LOCAL_BRIDGE', isSimulated: false,
        })));
        if (result.tick && Number.isFinite(result.tick.bid) && Number.isFinite(result.tick.ask)) {
          marketDataServiceInstance.setTick(instrument, result.tick);
        }
      }
      if (total > 0) {
        marketDataServiceInstance.setStatus('CONNECTED', { source: 'MT5_LOCAL_BRIDGE', isSimulated: false });
      }
    };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [instrument]);

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
      const prior = candles.slice(-21, -1);
      const priorSupport = prior.length ? Math.min(...prior.map(c => c.low)) : null;
      const priorResistance = prior.length ? Math.max(...prior.map(c => c.high)) : null;
      const lastCandle = candles[candles.length - 1];
      const candleRange = lastCandle.high - lastCandle.low;
      const candleBody = Math.abs(lastCandle.close - lastCandle.open);
      const candleShape = candleRange > 0 ? (candleBody / candleRange) : null;
      const priceVsEma20Pct = Number.isFinite(ema20) && ema20 !== 0 ? ((price - ema20) / ema20) * 100 : null;
      const recentCloses = candles.slice(-5).map(c => c.close);
      const shortMomentumPct = recentCloses.length > 1 && recentCloses[0] !== 0 ? ((recentCloses.at(-1) - recentCloses[0]) / recentCloses[0]) * 100 : null;
      const rsi = indicators.rsi;
      const atr = indicators.atr;
      setAdvancedData({ ema9, ema20, ema50, rsi, atr, priorSupport, priorResistance, candleShape, priceVsEma20Pct, shortMomentumPct, lastCandle, candleRange });
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

  const openAdvancedButton = <button type="button" onClick={() => setShowAdvancedModal(true)} style={{ width: '100%', marginBottom: 10, padding: '10px 12px', border: '1px solid #0891b2', borderRadius: 6, background: 'linear-gradient(100deg,rgba(8,145,178,.22),rgba(3,8,18,.95))', color: '#67e8f9', fontWeight: 900, letterSpacing: '.04em', cursor: 'pointer', textAlign: 'left' }}>✦ BUKA AI ANALISIS LANJUTAN <span style={{ float: 'right' }}>↗</span><div style={{ color: '#94a3b8', fontSize: 9, fontWeight: 500, marginTop: 4 }}>Ringkasan · Struktur · Fundamental · Skenario · Risiko</div></button>;
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
    return <>{openAdvancedButton}<AdvancedAnalysisModal open={showAdvancedModal} onClose={() => setShowAdvancedModal(false)} instrument={instrument} timeframe={timeframe} analysis={analysis} advancedData={advancedData} visualData={visualData} visualResults={visualResults} /><section style={{ color: '#cbd5e1', background: 'rgba(8,15,30,0.92)', border: '1px solid rgba(0,229,255,0.18)', borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 10 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
        <strong style={{ color: '#00e5ff', letterSpacing: '.04em' }}>AI TECHNICAL ANALYST · VISUAL DATA</strong>
        <span style={{ color: qualityColor, fontWeight: 700 }}>{visualData.dataStatus}</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6, marginBottom: 10 }}>
        {['H4','H1','M15','M5'].map(tf => {
          const item = visualResults[tf];
          const ok = item?.dataStatus === 'VISUAL_READY' && item.symbol_match !== false && item.timeframe_match !== false;
          return <div key={tf} style={{ minWidth: 0, padding: 7, borderRadius: 5, border: '1px solid ' + (ok ? '#166534' : '#854d0e'), background: '#071321' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 5, marginBottom: 6 }}>
              <strong style={{ color: '#67e8f9', fontSize: 11 }}>TF {tf}</strong>
              <span style={{ color: ok ? '#34d399' : '#fbbf24', fontSize: 8 }}>{item?.dataStatus || 'BELUM DIREKAM'}</span>
            </div>
            <div style={{ color: '#64748b', fontSize: 8 }}>Harga terakhir</div>
            <div style={{ color: '#e2e8f0', fontSize: 11, marginBottom: 5 }}>{item && Number.isFinite(item.last_price) ? item.last_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</div>
            <div style={{ color: item?.trend === 'BEARISH' ? '#f87171' : item?.trend === 'BULLISH' ? '#34d399' : '#e2e8f0', fontSize: 9 }}>Tren: {item?.trend || '—'} · Momentum: {item?.momentum || '—'}</div>
            <div style={{ color: '#94a3b8', fontSize: 8, marginTop: 4 }}>S: {item && Number.isFinite(item.support) ? item.support.toFixed(2) : '—'} · R: {item && Number.isFinite(item.resistance) ? item.resistance.toFixed(2) : '—'}</div>
            <div style={{ color: '#64748b', fontSize: 8, marginTop: 4 }}>{item?.capturedAt ? new Date(item.capturedAt).toLocaleTimeString() : 'Menunggu capture'}</div>
          </div>;
        })}
      </div>
      <div style={{ marginTop: 9, padding: 8, borderRadius: 5, background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.1)' }}>
        <div style={{ color: '#00e5ff', fontWeight: 700 }}>SCENARIO / SKENARIO: {visualData.dataStatus === 'VISUAL_READY' ? (visualData.scenario || 'WAIT') : 'WAIT'}</div>
        <div style={{ color: '#e2e8f0', marginTop: 6, fontWeight: 700 }}>EN — Visual reading</div>
        <div style={{ color: '#94a3b8', marginTop: 3 }}>{visualData.note || 'The chart was read from the captured screen. Unreadable values are not estimated.'}</div>
        <div style={{ color: '#e2e8f0', marginTop: 8, fontWeight: 700 }}>ID — Pembacaan visual</div>
        <div style={{ color: '#94a3b8', marginTop: 3 }}>{visualData.note_id || visualData.note || 'Grafik dibaca dari tangkapan layar. Angka yang tidak terbaca tidak ditebak.'}</div>
        <div style={{ color: '#fbbf24', marginTop: 7 }}>EN: Values marked — are unreadable, not guessed. / ID: Tanda — berarti angka tidak terbaca, bukan hasil tebakan.</div>
        <div style={{ color: '#64748b', marginTop: 5 }}>Captured / Ditangkap: {visualData.capturedAt ? new Date(visualData.capturedAt).toLocaleTimeString() : '—'}</div>
      </div>
    </section></>;
  }

  const statusColor = analysis.dataStatus === 'CONNECTED' ? '#10b981' : '#f59e0b';
  const tabStyle = key => ({ padding: '8px 10px', border: '1px solid ' + (activeTab === key ? '#0891b2' : '#1e293b'), borderRadius: 5, background: activeTab === key ? 'rgba(8,145,178,.18)' : '#07111f', color: activeTab === key ? '#67e8f9' : '#94a3b8', cursor: 'pointer', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' });
  const metric = (label, value, note = '') => <div key={label} style={{ minWidth: 0, padding: 8, background: '#071321', border: '1px solid #142d40', borderRadius: 5 }}><div style={{ color: '#64748b', fontSize: 9, marginBottom: 4 }}>{label}</div><div style={{ color: '#e2e8f0', fontSize: 11, overflowWrap: 'anywhere' }}>{value ?? '—'}</div>{note && <div style={{ color: '#64748b', fontSize: 9, marginTop: 4 }}>{note}</div>}</div>;
  const fmtPct = v => Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(3)}%` : '—';
  const sourceLink = (label, url, description) => <a key={label} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: 9, border: '1px solid #164e63', borderRadius: 5, color: '#67e8f9', textDecoration: 'none', background: '#071321' }}><strong style={{ fontSize: 10 }}>{label} ↗</strong><div style={{ color: '#94a3b8', fontSize: 9, marginTop: 4 }}>{description}</div></a>;
  return (
    <><AdvancedAnalysisModal open={showAdvancedModal} onClose={() => setShowAdvancedModal(false)} instrument={instrument} timeframe={timeframe} analysis={analysis} advancedData={advancedData} visualData={visualData} />{openAdvancedButton}<section style={{ color: '#cbd5e1', background: 'rgba(8,15,30,0.92)', border: '1px solid rgba(0,229,255,0.18)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 11 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <strong style={{ color: '#00e5ff', letterSpacing: '.04em' }}>JIN MARKET ANALYSIS</strong>
        <span style={{ color: statusColor, fontWeight: 700 }}>{analysis.dataStatus}</span>
      </header>
      <nav aria-label="Tab analisis pasar" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        <button type="button" onClick={() => setActiveTab('advanced')} style={tabStyle('advanced')}>ANALISIS LANJUTAN</button>
        <button type="button" onClick={() => setActiveTab('fundamental')} style={tabStyle('fundamental')}>ANALISIS FUNDAMENTAL</button>
      </nav>
      {activeTab === 'advanced' && <>
        <div style={{ color: '#67e8f9', fontWeight: 800, marginBottom: 8 }}>ADVANCED PRICE & INDICATOR ANALYSIS</div>
        {analysis.candleCount < 50 || !advancedData ? <div style={{ padding: 10, border: '1px solid #92400e', borderRadius: 5, color: '#fbbf24', background: '#211608' }}>Analisis lanjutan belum dapat dihitung. Data valid tersedia: {analysis.candleCount}/50 candle minimum. Pastikan feed candle terhubung dan data tidak kedaluwarsa.</div> : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }}>
            {metric('EMA 9', fmt(advancedData.ema9, 2))}
            {metric('EMA 20', fmt(advancedData.ema20, 2))}
            {metric('EMA 50', fmt(advancedData.ema50, 2))}
            {metric('RSI (14)', fmt(advancedData.rsi, 1), Number.isFinite(advancedData.rsi) ? advancedData.rsi >= 70 ? 'Zona overbought' : advancedData.rsi <= 30 ? 'Zona oversold' : 'Belum ekstrem' : '')}
            {metric('ATR (14)', fmt(advancedData.atr, 2), 'Ukuran volatilitas, bukan arah')}
            {metric('Harga vs EMA20', fmtPct(advancedData.priceVsEma20Pct))}
            {metric('Momentum 5 candle', fmtPct(advancedData.shortMomentumPct))}
            {metric('Rasio body/range candle terakhir', Number.isFinite(advancedData.candleShape) ? fmtPct(advancedData.candleShape * 100) : '—')}
            {metric('Support 20 candle sebelumnya', fmt(advancedData.priorSupport, 2))}
            {metric('Resistance 20 candle sebelumnya', fmt(advancedData.priorResistance, 2))}
          </div>
          <div style={{ marginTop: 9, padding: 9, border: '1px solid #164e63', borderRadius: 5, background: '#071321' }}>
            <strong style={{ color: '#67e8f9' }}>KONDISI KONFIRMASI</strong>
            <p style={{ color: '#cbd5e1', margin: '6px 0' }}>Bullish: harga di atas EMA20, EMA9 &gt; EMA20 &gt; EMA50, dan RSI mendukung.</p>
            <p style={{ color: '#cbd5e1', margin: '6px 0' }}>Bearish: harga di bawah EMA20, EMA9 &lt; EMA20 &lt; EMA50, dan RSI mendukung.</p>
            <p style={{ color: '#fbbf24', margin: '6px 0 0' }}>Konfirmasi ini bersifat teknikal; tetap periksa kualitas dan kesegaran data serta risiko berita berdampak tinggi.</p>
          </div>
        </>}
      </>}
      {activeTab === 'fundamental' && <>
        <div style={{ color: '#67e8f9', fontWeight: 800, marginBottom: 6 }}>JIN GOLD FUNDAMENTAL INTELLIGENCE</div>
        <div style={{ padding: 9, border: '1px solid #92400e', borderRadius: 5, background: '#211608', color: '#fbbf24', marginBottom: 10 }}>
          STATUS FEED: BELUM TERHUBUNG. Panel ini tidak mengarang data aktual, konsensus, countdown, atau bias berita. Buka sumber resmi di bawah untuk memverifikasi rilis terbaru.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }}>
          {metric('FED / SUKU BUNGA', 'Perlu verifikasi rilis terbaru', 'FOMC, minutes, pidato pejabat Fed')}
          {metric('DATA INFLASI & TENAGA KERJA', 'Perlu verifikasi rilis terbaru', 'CPI, PCE, NFP, pengangguran')}
          {metric('USD & TREASURY YIELDS', 'Feed pasar belum terhubung', 'DXY, yield 2Y/10Y, real yield')}
          {metric('DAMPAK TERHADAP EMAS', 'BELUM DINILAI', 'Bias bullish/bearish ditahan sampai data diverifikasi')}
        </div>
        <div style={{ color: '#94a3b8', margin: '12px 0 7px', fontWeight: 800 }}>SUMBER DATA RESMI</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }}>
          {sourceLink('Federal Reserve', 'https://www.federalreserve.gov/monetarypolicy.htm', 'Keputusan FOMC, jadwal rapat, minutes dan kebijakan moneter.')}
          {sourceLink('BLS — CPI & Employment', 'https://www.bls.gov/schedule/news_release/', 'Jadwal rilis resmi inflasi dan data tenaga kerja AS.')}
          {sourceLink('BEA — PCE & GDP', 'https://www.bea.gov/news/schedule', 'Jadwal PCE, GDP, dan rilis ekonomi resmi.')}
          {sourceLink('US Treasury — Yields', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates', 'Data suku bunga Treasury AS.')}
          {sourceLink('CFTC — COT Reports', 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm', 'Posisi futures terlapor; bukan sinyal real-time.')}
          {sourceLink('FRED — Economic Data', 'https://fred.stlouisfed.org/', 'Deret waktu makroekonomi; perhatikan tanggal pembaruan.')}
        </div>
        <div style={{ color: '#94a3b8', marginTop: 10, lineHeight: 1.6 }}>Interpretasi yang harus diuji: ekspektasi suku bunga riil yang naik dan USD menguat sering menekan emas; ekspektasi pelonggaran atau USD melemah dapat mendukung emas. Ini hanya kerangka umum, bukan pembacaan kondisi saat ini. Geopolitik, positioning, dan respons harga dapat mengubah dampak.</div>
      </>}
      <footer style={{ marginTop: 10, color: '#64748b', fontSize: 9 }}>
        Bukan nasihat keuangan. Sinyal ditahan jika data tidak cukup atau tidak segar.
        {analysis.lastAnalysis ? ` • Analisis: ${new Date(analysis.lastAnalysis).toLocaleTimeString('id-ID')}` : ''}
      </footer>
    </section></>
  );
}

