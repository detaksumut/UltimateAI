/** @format */
/**
 * AI Analyst Panel — uses the project's actual MarketDataService and ChartReader APIs.
 * Calls the AI model via LocalRouter for technical interpretation.
 * Never presents a directional bias as a confirmed trade signal.
 */
import React, { useEffect, useState } from 'react';
import { marketDataServiceInstance, TIMEFRAMES } from '../../services/trading/MarketDataService.js';
import { getChartCandles } from '../../services/trading/ChartReader.js';
import { calculateIndicators } from '../../services/trading/IndicatorCalculator.js';
import AdvancedAnalysisModal from './JINAdvancedAnalysisModal.jsx';
import { RouterConfig } from '../../services/router/RouterConfig.js';

const AI_MODEL_ENDPOINT = RouterConfig.api('/api/magic');

/**
 * Calls the AI model via LocalRouter SSE endpoint for trading interpretation.
 * Returns parsed JSON response or null on failure.
 * Never falls back to presenting local calculations as AI output.
 */
async function callAIModel(technicalData) {
  const systemPrompt = `You are JIN, an expert trading intelligence analyst for XAUUSD (Gold).
You receive technical indicator data calculated from REAL MT5 candle data.
Your job is to provide interpretation and reasoning, NOT to fabricate data.

REQUIRED OUTPUT FORMAT — Return ONLY valid JSON, no markdown:
{
  "marketBias": "BUY_BIAS|SELL_BIAS|WAIT",
  "trendAnalysis": "string",
  "marketStructure": "UPTREND|DOWNTREND|RANGE|UNKNOWN",
  "supportResistance": {"support": number|null, "resistance": number|null},
  "bullishScenario": {"trigger": string, "target": number|null, "stopLoss": number|null},
  "bearishScenario": {"trigger": string, "target": number|null, "stopLoss": number|null},
  "entryZone": {"min": number|null, "max": number|null},
  "stopLoss": number|null,
  "takeProfit1": number|null,
  "takeProfit2": number|null,
  "riskReward": number|null,
  "confidence": number (0-100),
  "reasoning": "string",
  "invalidation": "string"
}

Rules:
- If data freshness is STALE/SIMULATED/UNKNOWN/ERROR or candleCount < 50, set marketBias to "WAIT" and confidence to 0.
- Do NOT invent prices. Use null if a value cannot be determined from the provided data.
- confidence must be an integer 0-100.
- reasoning must be a concise explanation in English.
- invalidation must describe what price action would invalidate the current bias.`;

  const userPrompt = JSON.stringify({
    instrument: technicalData.instrument,
    timeframe: technicalData.timeframe,
    price: technicalData.price,
    candleCount: technicalData.candleCount,
    dataFreshness: technicalData.dataFreshness,
    indicators: {
      ema9: technicalData.ema9,
      ema20: technicalData.ema20,
      ema50: technicalData.ema50,
      rsi: technicalData.rsi,
      atr: technicalData.atr,
      macd: technicalData.macd,
      pattern: technicalData.pattern,
      structure: technicalData.structure,
      supplyDemand: technicalData.supplyDemand,
      volume: technicalData.volume,
      candleShape: technicalData.candleShape,
      priceVsEma20Pct: technicalData.priceVsEma20Pct,
      shortMomentumPct: technicalData.shortMomentumPct,
    },
    support: technicalData.support,
    resistance: technicalData.resistance,
  }, null, 2);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(AI_MODEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        capability: 'FAST_CHAT',
        stream: false,
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI model HTTP ${response.status}`);
    }

    // SSE stream parsing
    const text = await response.text();
    const lines = text.split('\\n');
    let accumulated = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'token' && payload.data?.content) {
            accumulated += payload.data.content;
          } else if (payload.type === 'ready') {
            break;
          } else if (payload.type === 'error') {
            throw new Error(payload.data?.message || 'AI stream error');
          }
        } catch (_) { }
      }
    }

    if (!accumulated) {
      throw new Error('No AI response content received');
    }

    // Extract JSON from response
    let jsonStr = accumulated.trim();
    const jsonMatch = jsonStr.match(/\\`\\`\\`json\\s*([\\s\\S]*?)\\s*\\`\\`\\`/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
      // Already JSON
    } else {
      // Try to find JSON object in text
      const braceStart = jsonStr.indexOf('{');
      const braceEnd = jsonStr.lastIndexOf('}');
      if (braceStart !== -1 && braceEnd > braceStart) {
        jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    const requiredFields = ['marketBias', 'trendAnalysis', 'marketStructure', 'confidence', 'reasoning', 'invalidation'];
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        throw new Error(`AI response missing required field: ${field}`);
      }
    }

    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[JIN AI Model] Error:', err.message);
    return null;
  }
}

const initialState = {
  instrument: 'XAUUSD', timeframe: TIMEFRAMES.M15,
  dataStatus: 'DISCONNECTED', dataFreshness: 'UNKNOWN', candleCount: 0,
  marketStructure: 'UNKNOWN', trend: 'NEUTRAL', momentum: 'NEUTRAL',
  volatility: 'UNKNOWN', support: null, resistance: null, scenario: 'WAIT',
  confidence: 0, entryCondition: 'Menunggu data harga yang valid.',
  stopLoss: null, takeProfit1: null, takeProfit2: null, riskReward: null, confidenceScore: 0,
  reasoning: 'Menunggu data pasar...', invalidation: 'Tidak ada sinyal aktif.',
  lastAnalysis: null, price: null,
  macd: null, macdSignal: null, macdHistogram: null,
  pattern: 'NONE', patternStrength: 0, patternBullish: false, patternBearish: false,
  supplyZone: null, demandZone: null,
  volumeSpike: false, avgVolume: null, currentVolume: null, volumeTrend: 'UNKNOWN',
  structure: 'UNKNOWN', higherHighs: false, higherLows: false, lowerHighs: false, lowerLows: false,
  mtfConfluence: 0, entryZone: null,
  aiStatus: null, aiError: null, aiSource: 'LOCAL_ONLY',
  aiReasoning: null, aiInvalidation: null, aiConfidence: null,
  aiMarketBias: null, aiTrendAnalysis: null, aiBullishScenario: null, aiBearishScenario: null, aiEntryZone: null,
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
  const [jinSignal, setJinSignal] = useState(null);
  const [signalClock, setSignalClock] = useState(Date.now());
  // Re-evaluate time-based expiry even when no new React event arrives.
  useEffect(() => {
    const timer = window.setInterval(() => setSignalClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const onSignal = event => setJinSignal(event.detail || null);
    const onClear = () => setJinSignal(null);
    window.addEventListener('jin:signal-ready', onSignal);
    window.addEventListener('jin:signal-clear', onClear);
    return () => { window.removeEventListener('jin:signal-ready', onSignal); window.removeEventListener('jin:signal-clear', onClear); };
  }, []);

  useEffect(() => {
    setActiveTab('advanced');
  }, [instrument, timeframe]);

  useEffect(() => {
    const onVisualData = (event) => {
      const data = event.detail || {};
      // Keep visual evidence visible even when the chart symbol/timeframe does not match
      // the selected analysis context; the dashboard must show the mismatch, not hide it.
      const normalized = {
        ...data,
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
    const timeframes = ['H4', 'H1', 'M15', 'M5', 'D1'];
    const poll = async () => {
      const results = await Promise.all(timeframes.map(async tf => {
        try {
          const url = RouterConfig.api(`/trading/ohlc?symbol=${encodeURIComponent(instrument)}&timeframe=${tf}&limit=300`);
          const response = await fetch(url, { cache: 'no-store' });
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

    const runAnalysis = async () => {
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
      const ema9 = indicators.ema[9];
      const ema20 = indicators.ema[20];
      const ema50 = indicators.ema[50];
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
      const macd = indicators.macd;
      const pattern = indicators.pattern;
      const supplyDemand = indicators.supplyDemand;
      const volume = indicators.volume;
      const structure = indicators.structure;
      setAdvancedData({ ema9, ema20, ema50, rsi, atr, macd, pattern, supplyDemand, volume, structure, priorSupport, priorResistance, candleShape, priceVsEma20Pct, shortMomentumPct, lastCandle, candleRange });

      const bullish = price > ema20 && ema9 > ema20 && ema20 > ema50;
      const bearish = price < ema20 && ema9 < ema20 && ema20 < ema50;
      const trend = bullish ? 'BULLISH' : bearish ? 'BEARISH' : 'SIDEWAYS';
      const momentum = !Number.isFinite(rsi) ? 'UNKNOWN' : rsi >= 55 ? 'BULLISH' : rsi <= 45 ? 'BEARISH' : 'NEUTRAL';
      const stale = ['STALE', 'RECENT', 'SIMULATED', 'UNKNOWN', 'ERROR', 'NO_DATA'].includes(result.freshness);

      const technicalData = {
        instrument, timeframe, price,
        candleCount: candles.length,
        dataFreshness: result.freshness || 'UNKNOWN',
        ema9, ema20, ema50, rsi, atr,
        macd: macd.macd, macdSignal: macd.signal, macdHistogram: macd.histogram,
        pattern: pattern.pattern, patternStrength: pattern.strength,
        patternBullish: pattern.bullish, patternBearish: pattern.bearish,
        structure: structure.structure,
        supplyDemand: supplyDemand.supply ? { price: supplyDemand.supply.price, strength: supplyDemand.supply.strength, touches: supplyDemand.supply.touches } : null,
        supplyDemandDemand: supplyDemand.demand ? { price: supplyDemand.demand.price, strength: supplyDemand.demand.strength, touches: supplyDemand.demand.touches } : null,
        volume: volume.volumeTrend, volumeSpike: volume.volumeSpike, avgVolume: volume.avgVolume, currentVolume: volume.currentVolume,
        candleShape, priceVsEma20Pct, shortMomentumPct,
        support, resistance,
      };

      let aiResult = null;
      let aiError = null;
      if (!stale && Number.isFinite(price) && Number.isFinite(rsi) && Number.isFinite(atr) && ![ema9, ema20, ema50].every(Number.isFinite) === false) {
        aiResult = await callAIModel(technicalData);
        if (!aiResult) {
          aiError = 'AI model tidak dapat dihubungi atau mengembalikan respons yang tidak valid.';
        }
      }

      const scenario = stale || !Number.isFinite(rsi) || !Number.isFinite(atr) || ![ema9, ema20, ema50].every(Number.isFinite)
        ? 'WAIT' : bullish && rsi < 70 ? 'BUY BIAS' : bearish && rsi > 30 ? 'SELL BIAS' : 'WAIT';

      const stopLoss = Number.isFinite(atr) && scenario === 'BUY BIAS' ? price - atr * 1.5
        : Number.isFinite(atr) && scenario === 'SELL BIAS' ? price + atr * 1.5 : null;
      const takeProfit1 = Number.isFinite(atr) && scenario === 'BUY BIAS' ? price + atr * 2
        : Number.isFinite(atr) && scenario === 'SELL BIAS' ? price - atr * 2 : null;
      const takeProfit2 = Number.isFinite(atr) && scenario === 'BUY BIAS' ? price + atr * 3.5
        : Number.isFinite(atr) && scenario === 'SELL BIAS' ? price - atr * 3.5 : null;
      const riskReward = stopLoss != null && takeProfit1 != null && price !== stopLoss
        ? Math.abs(takeProfit1 - price) / Math.abs(price - stopLoss) : null;
      const structureBullish = structure.structure === 'UPTREND' && trend === 'BULLISH';
      const structureBearish = structure.structure === 'DOWNTREND' && trend === 'BEARISH';
      const confidence = scenario === 'WAIT' ? 0 : Math.min(85, Math.round(45 + Math.abs((rsi ?? 50) - 50) * 0.5 + (structureBullish || structureBearish ? 15 : 0) + (pattern.bullish || pattern.bearish ? 10 : 0) + (volume.volumeSpike ? 5 : 0)));
      const mtfConfluence = [structureBullish, structureBearish, pattern.bullish && trend === 'BULLISH', pattern.bearish && trend === 'BEARISH', volume.volumeSpike && (pattern.bullish || pattern.bearish), macd.histogram != null && ((trend === 'BULLISH' && macd.histogram > 0) || (trend === 'BEARISH' && macd.histogram < 0))].filter(Boolean).length;
      const entryZone = scenario === 'BUY BIAS' ? `${fmt(Math.max(price - atr * 0.5, support || 0), digits)} - ${fmt(price, digits)}`
        : scenario === 'SELL BIAS' ? `${fmt(price, digits)} - ${fmt(Math.min(price + atr * 0.5, resistance || Infinity), digits)}`
          : null;

      const localReasoning = [
        `Tren ${trend}; momentum ${momentum}; RSI ${fmt(rsi, 1)}.`,
        `EMA 9/20/50: ${fmt(ema9)}/${fmt(ema20)}/${fmt(ema50)}.`,
        `ATR(14): ${fmt(atr)}; support/resistance 20 candle: ${fmt(support)}/${fmt(resistance)}.`,
        `MACD: ${fmt(macd.macd, 4)}/${fmt(macd.signal, 4)} hist:${fmt(macd.histogram, 4)}.`,
        `Pola candle: ${pattern.pattern} (${pattern.strength}/10).`,
        `Struktur: ${structure.structure}; Volume: ${volume.volumeTrend}.`,
        `Sektor pasokan: ${supplyDemand.supply ? fmt(supplyDemand.supply.price, digits) : '—'}; Sektor permintaan: ${supplyDemand.demand ? fmt(supplyDemand.demand.price, digits) : '—'}.`,
        `Confluence MTF: ${mtfConfluence}/6. Freshness data: ${result.freshness || 'UNKNOWN'}.`,
        stale ? 'Data stale/simulasi/tidak diketahui; bias trading ditahan.' : 'Bias ini bukan konfirmasi entry dan bukan jaminan hasil.',
      ].join(' ');

      if (active) {
        const aiStatus = aiError ? 'AI_UNAVAILABLE' : (aiResult ? 'AI_READY' : 'AI_PENDING');
        const combinedReasoning = aiResult?.reasoning || localReasoning;
        const combinedInvalidation = aiResult?.invalidation || (scenario === 'BUY BIAS' ? `Bias melemah bila harga turun di bawah EMA20 (${fmt(ema20)}).`
          : scenario === 'SELL BIAS' ? `Bias melemah bila harga naik di atas EMA20 (${fmt(ema20)}).`
            : 'Tunggu struktur tren yang lebih jelas.');

        setAnalysis({
          ...base,
          dataStatus: stale ? (result.freshness === 'RECENT' ? 'DATA_AGING' : 'STALE') : 'CONNECTED',
          marketStructure: structure.structure, trend, momentum,
          volatility: Number.isFinite(atr) && price ? (atr / price > 0.01 ? 'HIGH' : 'NORMAL') : 'UNKNOWN',
          support, resistance, scenario, confidence,
          confidenceScore: aiResult?.confidence ?? confidence,
          entryCondition: stale ? 'Tunggu data segar dan konfirmasi candle.'
            : scenario === 'BUY BIAS' ? 'Bias bullish; tunggu konfirmasi entry terpisah.'
              : scenario === 'SELL BIAS' ? 'Bias bearish; tunggu konfirmasi entry terpisah.'
                : 'Belum ada konfirmasi arah yang memadai.',
          stopLoss: stale ? null : stopLoss, takeProfit1: stale ? null : takeProfit1, takeProfit2: stale ? null : takeProfit2,
          riskReward: stale ? null : riskReward,
          reasoning: combinedReasoning,
          invalidation: combinedInvalidation,
          aiStatus,
          aiError: aiError || null,
          aiSource: aiResult?.marketBias ? 'AI_MODEL' : aiError ? 'AI_ERROR' : 'LOCAL_ONLY',
          macd: macd.macd, macdSignal: macd.signal, macdHistogram: macd.histogram,
          pattern: pattern.pattern, patternStrength: pattern.strength, patternBullish: pattern.bullish, patternBearish: pattern.bearish,
          supplyZone: supplyDemand.supply ? supplyDemand.supply.price : null, demandZone: supplyDemand.demand ? supplyDemand.demand.price : null,
          volumeSpike: volume.volumeSpike, avgVolume: volume.avgVolume, currentVolume: volume.currentVolume, volumeTrend: volume.volumeTrend,
          structure: structure.structure, higherHighs: structure.higherHighs, higherLows: structure.higherLows, lowerHighs: structure.lowerHighs, lowerLows: structure.lowerLows,
          mtfConfluence, entryZone,
          aiReasoning: aiResult?.reasoning || null,
          aiInvalidation: aiResult?.invalidation || null,
          aiConfidence: aiResult?.confidence || null,
          aiMarketBias: aiResult?.marketBias || null,
          aiTrendAnalysis: aiResult?.trendAnalysis || null,
          aiBullishScenario: aiResult?.bullishScenario || null,
          aiBearishScenario: aiResult?.bearishScenario || null,
          aiEntryZone: aiResult?.entryZone || null,
        });
      }
    };

    const unsubscribe = marketDataServiceInstance.subscribe(runAnalysis);
    runAnalysis();
    return () => { active = false; if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [instrument, timeframe]);

  const digits = instrument === 'XAUUSD' ? 2 : 5;
  const rows = [
    ['Market Bias', analysis.scenario], ['Trend Analysis', analysis.trend],
    ['Market Structure', analysis.structure], ['Support & Resistance', `${fmt(analysis.support, digits)} / ${fmt(analysis.resistance, digits)}`],
    ['Multi-TF Confluence', `${analysis.mtfConfluence}/6`],
    ['Entry Zone', analysis.entryZone || '—'],
    ['Stop Loss', fmt(analysis.stopLoss1 ?? analysis.stopLoss, digits)], ['Take Profit 1', fmt(analysis.takeProfit1, digits)],
    ['Take Profit 2', fmt(analysis.takeProfit2, digits)], ['Risk/Reward', analysis.riskReward == null ? '—' : `1:${fmt(analysis.riskReward, 2)}`],
    ['Confidence Score', `${analysis.confidenceScore}%`],
    ['Alasan & Kondisi', analysis.reasoning.length > 60 ? analysis.reasoning.slice(0, 60) + '…' : analysis.reasoning],
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
        {['H4', 'H1', 'M15', 'M5'].map(tf => {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7, marginTop: 8 }}>
        <div style={{ minWidth: 0, padding: 8, borderRadius: 5, background: '#071321', border: '1px solid #164e63' }}>
          <div style={{ color: '#67e8f9', fontWeight: 900, fontSize: 10, marginBottom: 6 }}>RS · SUPPORT / RESISTANCE</div>
          {(() => {
            const m5 = visualResults['M5'];
            const valid = m5?.dataStatus === 'VISUAL_READY' && m5.symbol_match === true && m5.timeframe_match === true;
            const fmtLevel = value => Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
            const rows = [
              { label: 'R3', value: m5?.r3, color: '#fb7185' },
              { label: 'R2', value: m5?.r2, color: '#fb7185' },
              { label: 'R1', value: valid ? m5?.resistance : null, color: '#fb7185' },
              { label: 'CURRENT', value: valid ? m5?.last_price : null, color: '#cbd5e1' },
              { label: 'S1', value: valid ? m5?.support : null, color: '#38bdf8' },
              { label: 'S2', value: m5?.s2, color: '#38bdf8' },
              { label: 'S3', value: m5?.s3, color: '#38bdf8' },
            ];
            return <>{rows.map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 5, padding: '6px 5px', marginTop: 4, border: '1px solid #193247', borderRadius: 4, background: '#06111e' }}>
              <strong style={{ fontSize: 9, color: row.color }}>{row.label}</strong>
              <strong style={{ fontSize: 9, color: valid && Number.isFinite(row.value) ? row.color : '#fbbf24', textAlign: 'right' }}>{valid ? fmtLevel(row.value) : 'BELUM VALID'}</strong>
            </div>)}<div style={{ fontSize: 8, color: '#64748b', marginTop: 5 }}>Level yang tidak tersedia ditampilkan sebagai —.</div></>;
          })()}
        </div>
        <div style={{ minWidth: 0, padding: 8, borderRadius: 5, background: '#071321', border: '1px solid #164e63' }}>
          <div style={{ color: '#67e8f9', fontWeight: 900, fontSize: 10, marginBottom: 6 }}>SD · SUPPLY / DEMAND M5</div>
          {(() => {
            const m5 = visualResults['M5'];
            const valid = m5?.dataStatus === 'VISUAL_READY' && m5.symbol_match === true && m5.timeframe_match === true && Number.isFinite(m5.support) && Number.isFinite(m5.resistance) && m5.support < m5.resistance;
            const rows = [
              { label: 'SUPPLY', value: valid ? m5.resistance : null, color: '#fb7185' },
              { label: 'DEMAND', value: valid ? m5.support : null, color: '#38bdf8' },
            ];
            return <>{rows.map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 5, padding: '8px 5px', marginTop: 5, border: '1px solid #193247', borderRadius: 4, background: '#06111e' }}>
              <strong style={{ fontSize: 9, color: row.color }}>{row.label}</strong>
              <strong style={{ fontSize: 9, color: row.value === null ? '#fbbf24' : row.color, textAlign: 'right' }}>{row.value === null ? 'BELUM VALID' : row.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>)}<div style={{ fontSize: 8, color: '#64748b', marginTop: 5 }}>Zona memakai data visual M5 yang lolos validasi.</div></>;
          })()}
        </div>
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
            {metric('MACD', fmt(advancedData.macd?.macd, 4), `Signal: ${fmt(advancedData.macd?.signal, 4)} Hist: ${fmt(advancedData.macd?.histogram, 4)}`)}
            {metric('Pola Candle', advancedData.pattern?.pattern === 'NONE' ? '—' : advancedData.pattern.pattern, `Kekuatan: ${advancedData.pattern?.strength ?? 0}/10 ${advancedData.pattern?.bullish ? 'BULLISH' : advancedData.pattern?.bearish ? 'BEARISH' : 'NEUTRAL'}`)}
            {metric('Struktur Tren', advancedData.structure?.structure || 'UNKNOWN', `HH:${advancedData.structure?.higherHighs ? 'YA' : 'TIDAK'} HL:${advancedData.structure?.higherLows ? 'YA' : 'TIDAK'}`)}
            {metric('Sektor Pasokan', fmt(advancedData.supplyDemand?.supply?.price, 2), `Touches: ${advancedData.supplyDemand?.supply?.touches ?? 0}`)}
            {metric('Sektor Permintaan', fmt(advancedData.supplyDemand?.demand?.price, 2), `Touches: ${advancedData.supplyDemand?.demand?.touches ?? 0}`)}
            {metric('Volume', fmt(advancedData.volume?.currentVolume, 0), `Trend: ${advancedData.volume?.volumeTrend ?? 'UNKNOWN'} Spike: ${advancedData.volume?.volumeSpike ? 'YA' : 'TIDAK'}`)}
          </div>
          <div style={{ marginTop: 9, padding: 9, border: '1px solid #164e63', borderRadius: 5, background: '#071321' }}>
            <strong style={{ color: '#67e8f9' }}>KONDISI KONFIRMASI</strong>
            <p style={{ color: '#cbd5e1', margin: '6px 0' }}>Bullish: harga di atas EMA20, EMA9 &gt; EMA20 &gt; EMA50, RSI mendukung, struktur uptrend, dan confluence MTF tinggi.</p>
            <p style={{ color: '#cbd5e1', margin: '6px 0' }}>Bearish: harga di bawah EMA20, EMA9 &lt; EMA20 &lt; EMA50, RSI mendukung, struktur downtrend, dan confluence MTF tinggi.</p>
            <p style={{ color: '#fbbf24', margin: '6px 0 0' }}>Konfirmasi ini bersifat teknikal; tetap periksa kualitas dan kesegaran data serta risiko berita berdampak tinggi.</p>
          </div>
        </>}
      </>}
      <footer style={{ marginTop: 10, color: '#64748b', fontSize: 9 }}>
        Bukan nasihat keuangan. Sinyal ditahan jika data tidak cukup atau tidak segar.
        {analysis.lastAnalysis ? ` • Analisis: ${new Date(analysis.lastAnalysis).toLocaleTimeString('id-ID')}` : ''}
      </footer>
    </section></>
  );
}

