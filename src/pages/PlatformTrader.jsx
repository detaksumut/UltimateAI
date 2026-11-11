import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PlatformTraderSidebar from '../components/platform-trader/PlatformTraderSidebar.jsx';
import PlatformTraderHeader from '../components/platform-trader/PlatformTraderHeader.jsx';
import MultiTimeframePanel from '../components/platform-trader/MultiTimeframePanel.jsx';
import SignalPlanCard from '../components/platform-trader/SignalPlanCard.jsx';
import AnalysisSummaryCard from '../components/platform-trader/AnalysisSummaryCard.jsx';
import MarketSentimentGauge from '../components/platform-trader/MarketSentimentGauge.jsx';
import EconomicCalendarPanel from '../components/platform-trader/EconomicCalendarPanel.jsx';
import PredictionJournalModal from '../components/platform-trader/PredictionJournalModal.jsx';

// Existing isolated panels for tabs
import FundamentalResearchPanel from '../components/trading/FundamentalResearchPanel.jsx';
import CrossAssetMonitor from '../components/trading/CrossAssetMonitor.jsx';
import TradingStudioModal from '../components/trading/TradingStudioModal.jsx';

// Services
import { marketDataServiceInstance } from '../services/trading/MarketDataService.js';
import { getChartCandles } from '../services/trading/ChartReader.js';
import { calculateIndicators } from '../services/trading/IndicatorCalculator.js';
import { RouterConfig } from '../services/router/RouterConfig.js';
import { visualChartCapture } from '../services/trading/VisualChartCapture.js';

// Embedded Trading View component & Order modal
import EmbeddedTradingView from '../components/platform-trader/EmbeddedTradingView.jsx';
import ProfessionalCandlestickChart from '../components/platform-trader/ProfessionalCandlestickChart.jsx';
import OrderConfirmModal from '../components/platform-trader/OrderConfirmModal.jsx';
import SupplyDemandScalpPanel from '../components/platform-trader/SupplyDemandScalpPanel.jsx';
import { detectSupplyDemandZones } from '../services/trading/SupplyDemandDetector.js';

// Demo Trading Integration
import { demoTradingEngineInstance } from '../services/trading/DemoTradingEngine.js';
import DemoAccountBar from '../components/platform-trader/DemoAccountBar.jsx';
import TradingAccountCenterModal from '../components/platform-trader/TradingAccountCenterModal.jsx';

// Helper to compute OHLC indicators per timeframe
function computeOhlcTf(instrument, tf) {
  const res = getChartCandles(instrument, tf, 200);
  const candles = res.candles || [];
  if (candles.length < 20) {
    return {
      bias: 'INSUFFICIENT_DATA',
      trend: `DATA BELUM CUKUP (${candles.length}/20 candle)`,
      count: candles.length,
      freshness: res.freshness,
      price: null,
      atr: null,
      rsi: null,
      source: 'OHLC'
    };
  }
  const ind = calculateIndicators(candles);
  if (!ind || ind.error) {
    return {
      bias: 'UNKNOWN',
      trend: 'Indikator tidak dapat dihitung',
      count: candles.length,
      freshness: res.freshness,
      price: null,
      atr: null,
      rsi: null,
      source: 'OHLC'
    };
  }
  const { ema = {}, rsi, atr } = ind;
  const ema9 = ema[9], ema20 = ema[20], ema50 = ema[50];
  const price = candles[candles.length - 1].close;
  const isBull = price > ema20 && ema9 > ema20 && (ema50 ? ema20 > ema50 : true);
  const isBear = price < ema20 && ema9 < ema20 && (ema50 ? ema20 < ema50 : true);
  const trend = isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'SIDEWAYS';
  const rsiStr = Number.isFinite(rsi) ? ` · RSI ${rsi.toFixed(1)}` : '';
  return {
    bias: trend,
    trend: `${trend}${rsiStr} (MT5)`,
    count: candles.length,
    freshness: res.freshness,
    price,
    atr,
    rsi,
    source: 'XM_GLOBAL_MT5'
  };
}

const SUMMARY_TABS = [
  { id: 'M1', label: 'TF1' },
  { id: 'M5', label: 'TF5' },
  { id: 'M15', label: 'TF15' },
  { id: 'H1', label: 'TF1H' },
  { id: 'H4', label: 'TF4H' }
];

function buildTfSummary(instrument, tf) {
  const res = getChartCandles(instrument, tf, 200);
  const candles = res.candles || [];
  const base = {
    timeframe: tf,
    bullets: [],
    resistance: null,
    support: null,
    trend: 'UNKNOWN',
    sentiment: 'BELUM TERSEDIA',
    confidence: null,
    lastPrice: null,
    count: candles.length
  };

  if (candles.length < 20) return base;

  const recent = candles.slice(-20);
  const calcRes = Math.max(...recent.map(c => c.high));
  const calcSup = Math.min(...recent.map(c => c.low));
  const lastPrice = candles[candles.length - 1].close;
  const ind = calculateIndicators(candles);

  if (!ind || ind.error) {
    return {
      ...base,
      resistance: calcRes,
      support: calcSup,
      lastPrice,
      bullets: [
        `Struktur ${tf}: indikator belum dapat dihitung dari ${candles.length} candle.`,
        `Level Swing 20-bar: Resistance ${calcRes.toFixed(2)}, Support ${calcSup.toFixed(2)}.`,
        'Ringkasan lengkap akan muncul setelah data indikator valid.'
      ]
    };
  }

  const { ema = {}, rsi, atr } = ind;
  const ema9 = ema[9], ema20 = ema[20], ema50 = ema[50];
  const isBull = lastPrice > ema20 && ema9 > ema20 && (ema50 ? ema20 > ema50 : true);
  const isBear = lastPrice < ema20 && ema9 < ema20 && (ema50 ? ema20 < ema50 : true);
  const currentTrend = isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'KONSOLIDASI';
  const momentum = !Number.isFinite(rsi) ? 'NETRAL' : rsi >= 55 ? 'BULLISH' : rsi <= 45 ? 'BEARISH' : 'NETRAL';

  let trendScore = isBull ? 2 : isBear ? -2 : 0;
  let rsiScore = !Number.isFinite(rsi) ? 0 : rsi >= 65 ? 2 : rsi >= 55 ? 1 : rsi <= 35 ? -2 : rsi <= 45 ? -1 : 0;
  let compositePct = Math.round(50 + ((trendScore + rsiScore) / 4) * 45);
  compositePct = Math.max(10, Math.min(90, compositePct));

  return {
    ...base,
    resistance: calcRes,
    support: calcSup,
    lastPrice,
    trend: currentTrend,
    sentiment: currentTrend === 'BULLISH' ? 'Bullish' : currentTrend === 'BEARISH' ? 'Bearish' : 'Neutral',
    confidence: compositePct,
    bullets: [
      `Struktur ${tf}: Tren terhitung ${currentTrend}, momentum ${momentum}, RSI(14) bernilai ${Number.isFinite(rsi) ? rsi.toFixed(1) : '—'}.`,
      `Level Swing 20-bar: Resistance terdekat di ${calcRes.toFixed(2)}, Support di ${calcSup.toFixed(2)}.`,
      `Volatilitas ATR(14): ${Number.isFinite(atr) ? atr.toFixed(2) : '—'}. Pertahankan bias ${currentTrend.toLowerCase()} selama harga bertahan dalam batas level validasi.`
    ]
  };
}

export default function PlatformTrader() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instrument, setInstrument] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('M1');
  const [chartMode, setChartMode] = useState('pro'); // 'pro' (Supply & Demand Overlay & Positions) | 'tradingview'
  const [activeTab, setActiveTab] = useState('Teknikal'); // 'Teknikal' | 'Fundamental' | 'Cross-Asset' | 'Kalender Ekonomi'
  const [summaryTf, setSummaryTf] = useState('M1');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Demo Trading Account State ──
  const [tradingMode, setTradingMode] = useState('DEMO'); // 'DEMO' | 'LIVE'
  const [demoState, setDemoState] = useState(() => demoTradingEngineInstance.getSnapshot());
  const [demoAutoMode, setDemoAutoMode] = useState(false); // Auto-execute JIN signals on DEMO

  // Modals
  const [journalOpen, setJournalOpen] = useState(false);
  const [tradingStudioOpen, setTradingStudioOpen] = useState(false);
  const [orderModal, setOrderModal] = useState({ open: false, side: 'BUY' });

  // Deep link: /platform-trader?journal=1 opens the Prediction Journal directly.
  useEffect(() => {
    if (searchParams.get('journal') !== '1') return;
    setJournalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('journal');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // ── Trading Account Center & E-Wallet Deposit State ──
  const [accountCenterOpen, setAccountCenterOpen] = useState(false);
  const [depositBalanceIdr, setDepositBalanceIdr] = useState(0);

  // Sync Deposit IDR Wallet balance
  useEffect(() => {
    fetch(RouterConfig.api('/api/payment/wallet?userId=user-default'))
      .then(r => r.json())
      .then(d => {
        if (d?.success && d.wallet) {
          setDepositBalanceIdr(d.wallet.depositBalanceIdr || 0);
        }
      })
      .catch(() => {});
  }, [accountCenterOpen]);
  const [journalEntries, setJournalEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('jin_prediction_journal');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Honest Market & Pricing State
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [priceChangePercent, setPriceChangePercent] = useState(null);
  const [spread, setSpread] = useState('—');
  const [source, setSource] = useState(instrument === 'XAUUSD' ? 'MT5 Canvas' : 'Market Data Feed');
  const [isLive, setIsLive] = useState(false);
  const [statusLabel, setStatusLabel] = useState('OFFLINE / MENUNGGU MT5');
  const [lastUpdated, setLastUpdated] = useState('—');
  const [revision, setRevision] = useState(0);

  // Supply & Demand Zones Detection for M1 & M5 scalping
  const m1Candles = useMemo(() => {
    return getChartCandles(instrument, 'M1', 100)?.candles || [];
  }, [instrument, revision]);

  const m5Candles = useMemo(() => {
    return getChartCandles(instrument, 'M5', 100)?.candles || [];
  }, [instrument, revision]);

  // Wider history for the chart viewport only (kept separate from the 100-bar
  // S&D window) so the user can zoom out and inspect older candles.
  const chartM1Candles = useMemo(() => {
    return getChartCandles(instrument, 'M1', 400)?.candles || [];
  }, [instrument, revision]);

  const chartM5Candles = useMemo(() => {
    return getChartCandles(instrument, 'M5', 400)?.candles || [];
  }, [instrument, revision]);

  const tfSummary = useMemo(
    () => buildTfSummary(instrument, summaryTf),
    [instrument, summaryTf, revision]
  );

  const m1Zones = useMemo(() => {
    return detectSupplyDemandZones(m1Candles, 'M1');
  }, [m1Candles]);

  const m5Zones = useMemo(() => {
    return detectSupplyDemandZones(m5Candles, 'M5');
  }, [m5Candles]);

  const handleSelectScalpSetup = useCallback((setup) => {
    if (!setup) return;
    setSignal({
      side: setup.side,
      isValid: true,
      entry: setup.entry,
      entryRange: String(setup.entry.toFixed(2)),
      stopLoss: setup.stopLoss,
      takeProfit1: setup.takeProfit,
      takeProfit2: setup.takeProfit + (setup.takeProfit - setup.entry) * 0.5,
      riskReward: "1 : " + String(setup.riskReward || "2.0"),
      confidence: 85,
      reason: setup.note,
      calculatedAt: new Date().toISOString()
    });
    setOrderModal({ open: true, side: setup.side });
  }, []);

  // Multi-timeframe analysis state
  const [tfData, setTfData] = useState({
    D1: { trend: 'Menunggu data candle D1...', bias: 'UNKNOWN', count: 0, freshness: 'NO_DATA' },
    H4: { trend: 'Menunggu data candle H4...', bias: 'UNKNOWN', count: 0, freshness: 'NO_DATA' },
    H1: { trend: 'Menunggu data candle H1...', bias: 'UNKNOWN', count: 0, freshness: 'NO_DATA' },
    M15: { trend: 'Menunggu data candle M15...', bias: 'UNKNOWN', count: 0, freshness: 'NO_DATA' },
    M5: { trend: 'Menunggu data candle M5...', bias: 'UNKNOWN', count: 0, freshness: 'NO_DATA' },
    M1: { trend: 'Menunggu data candle M1...', bias: 'UNKNOWN', count: 0, freshness: 'NO_DATA' }
  });

  // Automated Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

  // Active Signal & Plan
  const [signal, setSignal] = useState({
    side: 'WAIT',
    isValid: false,
    entry: null,
    entryRange: '—',
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    riskReward: '—',
    confidence: null,
    reason: 'Menunggu koneksi dan verifikasi candle MT5.'
  });

  // Subscribe to market data updates
  useEffect(() => {
    const unsub = marketDataServiceInstance.subscribe(() => {
      setRevision(r => r + 1);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // ── Subscribe to Demo Trading Engine state changes ──
  useEffect(() => {
    const unsub = demoTradingEngineInstance.subscribe((snapshot) => {
      setDemoState(snapshot);
    });
    return unsub;
  }, []);

  // ── Feed live ticks to Demo Trading Engine for floating P/L, SL/TP hits ──
  const lastDemoTickRef = useRef(null);
  useEffect(() => {
    if (tradingMode !== 'DEMO') return;
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;
    
    const spreadVal = Number.isFinite(Number(spread)) ? Number(spread) : 0.35;
    const bid = currentPrice;
    const ask = bid + spreadVal;
    
    // Throttle: only update if price actually changed
    const key = `${bid.toFixed(2)}-${ask.toFixed(2)}`;
    if (lastDemoTickRef.current === key) return;
    lastDemoTickRef.current = key;
    
    demoTradingEngineInstance.updateTick(bid, ask);
  }, [currentPrice, spread, tradingMode]);

  // Dual-Speed Market Data Polling
  useEffect(() => {
    let cancelled = false;
    const allTfs = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];

    // ── 1. Fast Active Loop (1 detik): Fetch active TF & live tick ──
    const pollActiveFast = async () => {
      try {
        const activeUrl = RouterConfig.api(`/trading/ohlc?symbol=${encodeURIComponent(instrument)}&timeframe=${timeframe}&limit=150`);
        const res = await fetch(activeUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        const activeTick = data?.tick || null;
        const candles = Array.isArray(data?.candles) ? data.candles : [];
        const resTf = String(data?.timeframe || timeframe).toUpperCase();

        if (candles.length > 0) {
          marketDataServiceInstance.addBatchCandles(
            candles.map(c => ({
              ...c,
              symbol: instrument,
              timeframe: resTf,
              source: c.source || 'MT5 Canvas',
              isSimulated: false
            }))
          );
        }

        if (activeTick && Number.isFinite(activeTick.bid)) {
          marketDataServiceInstance.setTick(instrument, activeTick);
          setCurrentPrice(activeTick.bid);
          setSpread(Number.isFinite(activeTick.spread) ? activeTick.spread.toFixed(2) : '0.35');

          const tickTime = activeTick.timestamp ? Date.parse(activeTick.timestamp) : null;
          const isFresh = Number.isFinite(tickTime) && (Date.now() - tickTime < 300000);
          setIsLive(isFresh);
          setStatusLabel(isFresh ? 'LIVE' : 'DATA STALE');
          setSource(activeTick.source || 'MT5 Canvas');
          setLastUpdated(activeTick.timestamp ? new Date(activeTick.timestamp).toLocaleTimeString('id-ID') : '—');
        } else if (candles.length > 0) {
          const lastCandle = candles[candles.length - 1];
          if (lastCandle && Number.isFinite(lastCandle.close)) {
            setCurrentPrice(lastCandle.close);
            setSpread('0.35');
            const candleTime = Date.parse(lastCandle.timestamp);
            const isFresh = Number.isFinite(candleTime) && (Date.now() - candleTime < 3600000);
            setIsLive(isFresh);
            setStatusLabel(isFresh ? 'LIVE' : 'DATA STALE');
            setSource(lastCandle.source || 'MT5 Canvas');
            setLastUpdated(lastCandle.timestamp ? new Date(lastCandle.timestamp).toLocaleTimeString('id-ID') : '—');
          }
        }

        if (candles.length >= 2) {
          const prevClose = candles[candles.length - 2].close;
          const latestClose = candles[candles.length - 1].close;
          if (Number.isFinite(prevClose) && Number.isFinite(latestClose) && prevClose > 0) {
            const diff = latestClose - prevClose;
            setPriceChange(diff);
            setPriceChangePercent((diff / prevClose) * 100);
          }
        }

      } catch (err) {
        if (!cancelled) {}
      }
    };

    // ── 2. Background Multi-TF Loop (4 detik): Sync other timeframes ──
    const pollMultiTfBackground = async () => {
      try {
        const otherTfs = allTfs.filter(t => t !== timeframe);
        const results = await Promise.all(
          otherTfs.map(async tf => {
            try {
              const url = RouterConfig.api(`/trading/ohlc?symbol=${encodeURIComponent(instrument)}&timeframe=${tf}&limit=120`);
              const res = await fetch(url, { cache: 'no-store' });
              if (!res.ok) return null;
              return await res.json();
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        for (const res of results) {
          if (res?.ok && Array.isArray(res.candles) && res.candles.length > 0) {
            const resTf = String(res.timeframe || '').toUpperCase();
            marketDataServiceInstance.addBatchCandles(
              res.candles.map(c => ({
                ...c,
                symbol: instrument,
                timeframe: resTf,
                source: c.source || 'MT5 Canvas',
                isSimulated: false
              }))
            );
          }
        }

        // Auto-update tfData for MultiTimeframePanel
        const scanTfs = ['D1', 'H4', 'H1', 'M15', 'M5'];
        const updatedTfs = {};
        for (const t of scanTfs) {
          const item = computeOhlcTf(instrument, t);
          if (item.count >= 20) {
            updatedTfs[t] = item;
          }
        }
        if (Object.keys(updatedTfs).length > 0) {
          setTfData(prev => ({ ...prev, ...updatedTfs }));
        }
      } catch (_) {}
    };

    pollActiveFast();
    pollMultiTfBackground();

    const fastInterval = setInterval(pollActiveFast, 1000);
    const bgInterval = setInterval(pollMultiTfBackground, 4000);

    return () => {
      cancelled = true;
      clearInterval(fastInterval);
      clearInterval(bgInterval);
    };
  }, [instrument, timeframe]);

  // ── runAutoScan: 4-TF + Macro Multi-TF Scanner ──
  const runAutoScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress('Memulai scan 5 TF...');
    window.dispatchEvent(new CustomEvent('jin:signal-clear'));

    const scanOrder = [
      { tf: 'D1',  tvInterval: 'D',   label: 'D1: Tren Makro' },
      { tf: 'H4',  tvInterval: '240', label: 'H4: Tren Utama' },
      { tf: 'H1',  tvInterval: '60',  label: 'H1: Struktur' },
      { tf: 'M15', tvInterval: '15',  label: 'M15: Momentum' },
      { tf: 'M5',  tvInterval: '5',   label: 'M5: Entry' },
    ];

    const captureVisualTf = async (tf, tvInterval) => {
      setScanProgress(`📸 Capture ${tf}...`);
      try {
        window.dispatchEvent(new CustomEvent('jin:request-timeframe', { detail: { interval: tvInterval, tf } }));
        await new Promise(r => setTimeout(r, 10000));
        setScanProgress(`🔍 AI Vision ${tf}...`);
        const frame = visualChartCapture.capture({ maxWidth: 2200, quality: 0.95 });
        const endpoint = RouterConfig.api('/trading/visual-chart-analysis');
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instrument, timeframe: tf, image: frame.dataUrl, schema: 'chart-ohlc-v1' }),
          signal: AbortSignal.timeout(90000),
          cache: 'no-store',
        });
        const text = await resp.text();
        let payload;
        try { payload = JSON.parse(text); } catch { return null; }
        if (!resp.ok || payload?.success !== true || !payload?.data) return null;
        const data = payload.data;
        ['last_price','open','high','low','close','support','resistance'].forEach(k => {
          if (!Number.isFinite(data[k])) data[k] = null;
        });
        data.confidence = Number.isFinite(Number(data.confidence)) ? Math.max(0, Math.min(100, Number(data.confidence))) : 0;
        data.visible_candles = Number.isFinite(Number(data.visible_candles)) ? Math.max(0, Number(data.visible_candles)) : 0;
        data.requestedTimeframe = tf;
        data.requestedInstrument = instrument;
        data.capturedAt = frame.capturedAt;
        const rawTrend = String(data.trend || '').toUpperCase();
        data.trend = rawTrend.includes('BULL') ? 'BULLISH' : rawTrend.includes('BEAR') ? 'BEARISH' : 'SIDEWAYS';
        const normSym = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const normTf = v => {
          const map = { '5':'M5','15':'M15','30':'M30','60':'H1','240':'H4','D':'D1','1D':'D1','D1':'D1','H1':'H1','H4':'H4','M5':'M5','M15':'M15','M30':'M30' };
          return map[String(v||'').trim().toUpperCase()] || String(v||'').toUpperCase();
        };
        const reqSym = normSym(instrument);
        const obsSym = normSym(data.instrument || '');
        data.symbol_match = obsSym.includes(reqSym) || reqSym.includes(obsSym) || (reqSym === 'XAUUSD' && (obsSym.includes('XAU') || obsSym.includes('GOLD')));
        data.timeframe_match = normTf(data.timeframe) === normTf(tf);
        data.dataStatus = data.data_quality === 'POOR' ? 'VISUAL_POOR'
          : !data.symbol_match || !data.timeframe_match ? 'VISUAL_MISMATCH'
          : data.visible_candles < 20 ? 'VISUAL_INSUFFICIENT'
          : 'VISUAL_READY';
        window.dispatchEvent(new CustomEvent('jin:visual-analysis-ready', { detail: { ...data } }));
        return data;
      } catch {
        return null;
      }
    };

    const analyzeOhlcTf = (tf) => {
      const res = getChartCandles(instrument, tf, 200);
      const candles = res.candles || [];
      if (candles.length < 20) return { bias: 'INSUFFICIENT_DATA', count: candles.length, freshness: res.freshness, trend: null, price: null, atr: null, rsi: null };
      const ind = calculateIndicators(candles);
      if (!ind || ind.error) return { bias: 'UNKNOWN', count: candles.length, freshness: res.freshness, trend: null, price: null, atr: null, rsi: null };
      const { ema = {}, rsi, atr } = ind;
      const ema9 = ema[9], ema20 = ema[20], ema50 = ema[50];
      const price = candles[candles.length - 1].close;
      const isBull = price > ema20 && ema9 > ema20 && (ema50 ? ema20 > ema50 : true);
      const isBear = price < ema20 && ema9 < ema20 && (ema50 ? ema20 < ema50 : true);
      const trend = isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'SIDEWAYS';
      return { bias: trend, trend, count: candles.length, freshness: res.freshness, price, atr, rsi };
    };

    const visualActive = visualChartCapture.active;

    try {
      const scanned = {};
      const visualBatch = [];

      for (const step of scanOrder) {
        setScanProgress(`${step.label}...`);
        let tfEntry = null;

        if (visualActive) {
          const vd = await captureVisualTf(step.tf, step.tvInterval);
          if (vd && vd.dataStatus === 'VISUAL_READY') {
            tfEntry = {
              trend: `${vd.trend} · Vision AI (${vd.confidence}% conf)`,
              bias: vd.trend,
              count: vd.visible_candles,
              freshness: 'VISUAL',
              price: vd.last_price,
              atr: null,
              rsi: null,
              source: 'VISUAL',
              visualData: vd,
            };
            visualBatch.push({ ...vd, requestedTimeframe: step.tf });
          }
        }

        if (!tfEntry) {
          if (!visualActive) await new Promise(r => setTimeout(r, 200));
          const ohlc = analyzeOhlcTf(step.tf);
          if (ohlc.bias === 'INSUFFICIENT_DATA') {
            tfEntry = {
              trend: `DATA BELUM CUKUP (${ohlc.count}/20 candle)`,
              bias: 'INSUFFICIENT_DATA',
              count: ohlc.count,
              freshness: ohlc.freshness,
              source: 'OHLC',
            };
          } else if (ohlc.bias === 'UNKNOWN') {
            tfEntry = {
              trend: 'Indikator tidak dapat dihitung',
              bias: 'UNKNOWN',
              count: ohlc.count,
              freshness: ohlc.freshness,
              source: 'OHLC',
            };
          } else {
            const rsiStr = Number.isFinite(ohlc.rsi) ? ` · RSI ${ohlc.rsi.toFixed(1)}` : '';
            tfEntry = {
              trend: `${ohlc.trend}${rsiStr} (OHLC)`,
              bias: ohlc.bias,
              count: ohlc.count,
              freshness: ohlc.freshness,
              price: ohlc.price,
              atr: ohlc.atr,
              rsi: ohlc.rsi,
              source: 'OHLC',
            };
          }
        }

        scanned[step.tf] = tfEntry;
        setTfData(prev => ({ ...prev, [step.tf]: tfEntry }));
      }

      if (visualBatch.length > 0) {
        window.dispatchEvent(new CustomEvent('jin:visual-analysis-batch-ready', {
          detail: { instrument, requestedAt: new Date().toISOString(), results: visualBatch }
        }));
      }

      setScanProgress('Menghitung sinyal...');
      await new Promise(r => setTimeout(r, 200));

      const d1 = scanned.D1, h4 = scanned.H4, h1 = scanned.H1, m15 = scanned.M15, m5 = scanned.M5;
      const allHaveData = [h4, h1, m15, m5].every(x => x?.bias && x.bias !== 'INSUFFICIENT_DATA' && x.bias !== 'UNKNOWN');

      if (!allHaveData) {
        const missing = [h4, h1, m15, m5].filter(x => !x?.bias || x.bias === 'INSUFFICIENT_DATA' || x.bias === 'UNKNOWN').length;
        setSignal({
          side: 'WAIT', isValid: false, entry: null, entryRange: '—',
          stopLoss: null, takeProfit1: null, takeProfit2: null,
          riskReward: '—', confidence: null,
          reason: `${missing} timeframe sedang memuat riwayat candle. Mengumpulkan data sinkron...`,
          calculatedAt: new Date().toISOString()
        });
        return;
      }

      const isAlignedBull = [h4, h1, m15].every(x => x.bias === 'BULLISH');
      const isAlignedBear = [h4, h1, m15].every(x => x.bias === 'BEARISH');
      const m5Bull = m5.bias === 'BULLISH';
      const m5Bear = m5.bias === 'BEARISH';
      const d1Bull = d1?.bias === 'BULLISH';
      const d1Bear = d1?.bias === 'BEARISH';

      const entryPrice = Number.isFinite(currentPrice) ? currentPrice
        : (m5?.visualData && Number.isFinite(m5.visualData.last_price) ? m5.visualData.last_price : null)
        || (Number.isFinite(h1?.price) ? h1.price : null);

      const atrValue = Number.isFinite(h1?.atr) && h1.atr > 0 ? h1.atr : (entryPrice ? entryPrice * 0.0035 : 5);

      const baseConf = 60;
      const rsiBoost = Number.isFinite(h1?.rsi) ? Math.abs(h1.rsi - 50) * 0.8 : 0;
      const d1Boost = (isAlignedBull && d1Bull) || (isAlignedBear && d1Bear) ? 10 : 0;
      const visualBoost = visualBatch.length >= 3 ? 8 : 0;

      if (isAlignedBull && m5Bull && Number.isFinite(entryPrice)) {
        const sl = entryPrice - atrValue * 1.5;
        const tp1 = entryPrice + atrValue * 2.0;
        const tp2 = entryPrice + atrValue * 3.5;
        const conf = Math.min(90, Math.round(baseConf + rsiBoost + d1Boost + visualBoost));
        const src = visualBatch.length > 0 ? `Visual AI (${visualBatch.length}/5 TF) + OHLC` : 'Live OHLC Feed';
        setSignal({
          side: 'BUY', isValid: true, entry: entryPrice,
          entryRange: `${entryPrice.toFixed(2)} – ${(entryPrice - atrValue * 0.3).toFixed(2)}`,
          stopLoss: sl, takeProfit1: tp1, takeProfit2: tp2,
          riskReward: `1 : ${(2.0 / 1.5).toFixed(1)}`,
          confidence: conf,
          reason: `H4·H1·M15 BULLISH, M5 konfirmasi.${d1Bull ? ' D1 mendukung naik.' : ''} Sumber: ${src}.`,
          calculatedAt: new Date().toISOString()
        });
      } else if (isAlignedBear && m5Bear && Number.isFinite(entryPrice)) {
        const sl = entryPrice + atrValue * 1.5;
        const tp1 = entryPrice - atrValue * 2.0;
        const tp2 = entryPrice - atrValue * 3.5;
        const conf = Math.min(90, Math.round(baseConf + rsiBoost + d1Boost + visualBoost));
        const src = visualBatch.length > 0 ? `Visual AI (${visualBatch.length}/5 TF) + OHLC` : 'Live OHLC Feed';
        setSignal({
          side: 'SELL', isValid: true, entry: entryPrice,
          entryRange: `${entryPrice.toFixed(2)} – ${(entryPrice + atrValue * 0.3).toFixed(2)}`,
          stopLoss: sl, takeProfit1: tp1, takeProfit2: tp2,
          riskReward: `1 : ${(2.0 / 1.5).toFixed(1)}`,
          confidence: conf,
          reason: `H4·H1·M15 BEARISH, M5 konfirmasi.${d1Bear ? ' D1 mendukung turun.' : ''} Sumber: ${src}.`,
          calculatedAt: new Date().toISOString()
        });
      } else {
        setSignal({
          side: 'WAIT', isValid: false, entry: null, entryRange: '—',
          stopLoss: null, takeProfit1: null, takeProfit2: null,
          riskReward: '—', confidence: null,
          reason: `4-TF belum selaras (D1:${d1?.bias||'?'} H4:${h4.bias} H1:${h1.bias} M15:${m15.bias} M5:${m5.bias}). Tunggu konfirmasi.`,
          calculatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[PlatformTrader] AutoScan error:', err);
      setSignal({
        side: 'WAIT', isValid: false, entry: null, entryRange: '—',
        stopLoss: null, takeProfit1: null, takeProfit2: null,
        riskReward: '—', confidence: null,
        reason: `Scan gagal: ${err?.message || 'Error tidak diketahui.'}`,
        calculatedAt: new Date().toISOString()
      });
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  }, [instrument, currentPrice, isScanning]);

  // Order Handlers
  const handleBuyClick = useCallback(() => {
    setOrderModal({ open: true, side: 'BUY' });
  }, []);

  const handleSellClick = useCallback(() => {
    setOrderModal({ open: true, side: 'SELL' });
  }, []);

  const handleConfirmOrder = useCallback((order) => {
    console.info('[PlatformTrader] Order confirmed:', order);
    window.dispatchEvent(new CustomEvent('jin:order-confirmed', { detail: order }));
    if (order.mode === 'DEMO') {
      alert(`🎯 Order Demo ${order.side} ${order.instrument} ${order.lotSize} lot berhasil dibuka pada Virtual Ledger.`);
    } else {
      alert(`⚡ Order LIVE XM ${order.side} ${order.instrument} sejumlah ${order.lotSize} lot dikonfirmasi ke broker.`);
    }
  }, []);

  const handleCloseDemoPosition = useCallback((posId, price, reason, partialRatio = 1.0) => {
    demoTradingEngineInstance.closePosition(posId, price, reason, partialRatio);
  }, []);

  const handleExecuteDemoSignal = useCallback((sig) => {
    if (!sig?.isValid) return;
    setOrderModal({ open: true, side: sig.side });
  }, []);

  // ── Auto-Execute JIN Signals in Demo Mode (when enabled) ──
  const lastExecutedSignalRef = useRef(null);
  useEffect(() => {
    if (!demoAutoMode || tradingMode !== 'DEMO') return;
    if (!signal?.isValid || (signal.side !== 'BUY' && signal.side !== 'SELL')) return;
    if (!signal.entry || (signal.confidence || 0) < 65) return;

    const signalKey = `${signal.side}-${signal.entry.toFixed(2)}-${signal.calculatedAt}`;
    if (lastExecutedSignalRef.current === signalKey) return;
    lastExecutedSignalRef.current = signalKey;

    const res = demoTradingEngineInstance.openPosition({
      side: signal.side,
      instrument,
      lotSize: 0.01,
      entryPrice: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit1: signal.takeProfit1,
      takeProfit2: signal.takeProfit2,
      comment: `JIN AUTO ${signal.side}`,
      signal
    });

    if (res.ok) {
      console.info('[PlatformTrader] JIN Auto-executed demo order:', res.message);
    }
  }, [signal, demoAutoMode, tradingMode, instrument]);

  // Log to Prediction Journal
  const handleLogToJournal = useCallback(() => {
    if (!signal?.isValid) {
      alert('Sinyal belum tervalidasi. Hanya setup valid yang dapat disimpan ke Prediction Journal.');
      return;
    }
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      instrument,
      timeframe,
      side: signal.side,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit1,
      riskReward: signal.riskReward,
      confidence: signal.confidence,
      reason: signal.reason
    };

    const updated = [entry, ...journalEntries];
    setJournalEntries(updated);
    try {
      localStorage.setItem('jin_prediction_journal', JSON.stringify(updated));
    } catch {}
    alert(`✅ Setup ${signal.side} ${instrument} berhasil disimpan ke Prediction Journal!`);
  }, [instrument, timeframe, signal, journalEntries]);

  const handleClearJournal = useCallback(() => {
    if (window.confirm('Yakin ingin menghapus seluruh catatan riwayat Prediction Journal?')) {
      setJournalEntries([]);
      try {
        localStorage.removeItem('jin_prediction_journal');
      } catch {}
    }
  }, []);

  const tabs = ['Teknikal', 'Fundamental', 'Cross-Asset', 'Kalender Ekonomi'];

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: '#030814',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* ── 1. Left Sidebar ── */}
      {sidebarOpen && (
        <PlatformTraderSidebar
          activeMenu="Platform Trader"
          onOpenJournal={() => setJournalOpen(true)}
          onOpenTradingStudio={() => setTradingStudioOpen(true)}
          signalCardProps={{
            signal,
            instrument,
            tradingMode,
            demoAutoMode,
            onToggleAutoMode: setDemoAutoMode,
            onExecuteDemo: handleExecuteDemoSignal,
            onLogJournal: handleLogToJournal,
          }}
        />
      )}

      {/* ── 2. Main Content Workspace ── */}
      <main
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 16px',
          boxSizing: 'border-box',
          gap: 12
        }}
      >
        {/* Top Header & Instrument Bar */}
        <PlatformTraderHeader
          instrument={instrument}
          onSelectInstrument={setInstrument}
          currentPrice={currentPrice}
          priceChange={priceChange}
          priceChangePercent={priceChangePercent}
          spread={spread}
          source={source}
          isLive={isLive}
          statusLabel={statusLabel}
          lastUpdated={lastUpdated}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          accountBar={
            <DemoAccountBar
              embedded
              tradingMode={tradingMode}
              onToggleMode={setTradingMode}
              demoState={demoState}
              onResetDemo={() => {
                demoTradingEngineInstance.resetAccount();
              }}
              onOpenAccountCenter={() => setAccountCenterOpen(true)}
              onOpenBrokerWorkspace={() => navigate('/broker-workspace')}
              depositBalanceIdr={depositBalanceIdr}
            />
          }
        />

        {/* Workspace Body Grid: Left (Chart + Tabs + Panels) / Right (AI Analyst & Signals) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            gap: 12,
            alignItems: 'start'
          }}
          className="platform-trader-grid"
        >
          {/* Left Column: Chart & Lower Analysis Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {/* Chart View Switcher Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: -4 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setChartMode('pro')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 900,
                    cursor: 'pointer',
                    border: chartMode === 'pro' ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.08)',
                    background: chartMode === 'pro' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(2,6,23,0.6)',
                    color: chartMode === 'pro' ? '#00e5ff' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🎯 TRADINGVIEW S&D CHART (PRO)
                </button>
                <button
                  onClick={() => setChartMode('tradingview')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: chartMode === 'tradingview' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                    background: chartMode === 'tradingview' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2,6,23,0.6)',
                    color: chartMode === 'tradingview' ? '#38bdf8' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  📊 TRADINGVIEW WIDGET (OANDA)
                </button>
              </div>

              <div style={{ fontSize: 9.5, color: '#64748b', fontFamily: 'monospace' }}>
                Mode: <strong style={{ color: chartMode === 'pro' ? '#00e5ff' : '#38bdf8' }}>{chartMode === 'pro' ? 'JIN Pro TradingView Engine (Feed XM MT5)' : 'External TV Widget (OANDA)'}</strong>
              </div>
            </div>

            {/* Render selected chart engine */}
            {chartMode === 'pro' ? (
              <ProfessionalCandlestickChart
                instrument={instrument}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                currentPrice={currentPrice}
                spread={spread}
                candles={timeframe === 'M1' ? chartM1Candles : timeframe === 'M5' ? chartM5Candles : (getChartCandles(instrument, timeframe, 300)?.candles || [])}
                dataStatus={statusLabel}
                source={source}
                signal={signal}
                openPositions={demoState.openPositions}
                onClosePosition={handleCloseDemoPosition}
                onBuyClick={handleBuyClick}
                onSellClick={handleSellClick}
              />
            ) : (
              <EmbeddedTradingView
                instrument={instrument}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                dataStatus={statusLabel}
                source={source}
                currentPrice={currentPrice}
                spread={spread}
                signal={signal}
                openPositions={demoState.openPositions}
                onClosePosition={handleCloseDemoPosition}
                onBuyClick={handleBuyClick}
                onSellClick={handleSellClick}
              />
            )}

            {/* Ringkasan Multi-Timeframe (selalu tampil di atas bar tab) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SUMMARY_TABS.map(({ id, label }) => {
                  const isActive = summaryTf === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSummaryTf(id)}
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '5px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: isActive
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(56, 189, 248, 0.25)',
                        background: isActive
                          ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                          : 'transparent',
                        color: isActive ? '#ffffff' : '#94a3b8',
                        boxShadow: isActive ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Ringkasan {label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <AnalysisSummaryCard
                  instrument={instrument}
                  timeframe={summaryTf}
                  summaryBullets={tfSummary.bullets}
                  resistance={tfSummary.resistance}
                  support={tfSummary.support}
                  trend={tfSummary.trend}
                  lastPrice={tfSummary.lastPrice}
                  dataStatus={statusLabel}
                />
                <MarketSentimentGauge
                  sentiment={tfSummary.sentiment}
                  confidence={tfSummary.confidence}
                />
              </div>
            </div>

            {/* Analysis Category Tabs Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                background: '#071224',
                border: '1px solid rgba(0, 229, 255, 0.15)',
                borderRadius: 8,
                flexWrap: 'wrap'
              }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '6px 14px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: isActive
                        ? '1px solid #38bdf8'
                        : '1px solid transparent',
                      background: isActive
                        ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                        : 'transparent',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      boxShadow: isActive ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Sub-panels based on selected tab */}
            {activeTab === 'Teknikal' && (
              <div style={{ fontSize: 10, color: '#64748b', padding: '0 2px' }}>
                Ringkasan teknikal multi-timeframe ditampilkan di atas.
              </div>
            )}

            {activeTab === 'Fundamental' && (
              <div style={{ background: '#071224', borderRadius: 8, padding: 8 }}>
                <FundamentalResearchPanel instrument={instrument} />
              </div>
            )}

            {activeTab === 'Cross-Asset' && (
              <div style={{ background: '#071224', borderRadius: 8, padding: 8 }}>
                <CrossAssetMonitor />
              </div>
            )}

            {activeTab === 'Kalender Ekonomi' && (
              <EconomicCalendarPanel instrument={instrument} />
            )}
          </div>

          {/* Right Column: Multi-Timeframe, Sinyal & Rencana */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 1. Scalping Supply & Demand Zones (M1 & M5) */}
            <SupplyDemandScalpPanel
              m1Zones={m1Zones}
              m5Zones={m5Zones}
              currentPrice={currentPrice}
              onSelectSetup={handleSelectScalpSetup}
            />

            {/* 3. Analisis Multi-Timeframe with Auto Scanner */}
            <MultiTimeframePanel
              instrument={instrument}
              tfData={tfData}
              onRunScan={runAutoScan}
              isScanning={isScanning}
              scanProgress={scanProgress}
            />

            {/* 3. Sinyal & Rencana (fallback saat sidebar ditutup) */}
            {!sidebarOpen && (
              <SignalPlanCard
                signal={signal}
                instrument={instrument}
                tradingMode={tradingMode}
                demoAutoMode={demoAutoMode}
                onToggleAutoMode={setDemoAutoMode}
                onExecuteDemo={handleExecuteDemoSignal}
                onLogJournal={handleLogToJournal}
              />
            )}
          </div>
        </div>
      </main>

      {/* Prediction Journal Modal */}
      <PredictionJournalModal
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        journalEntries={journalEntries}
        onClearJournal={handleClearJournal}
      />

      {/* Order Confirmation Modal */}
      <OrderConfirmModal
        open={orderModal.open}
        onClose={() => setOrderModal(prev => ({ ...prev, open: false }))}
        side={orderModal.side}
        instrument={instrument}
        signal={signal}
        currentPrice={currentPrice}
        spread={spread}
        tradingMode={tradingMode}
        onConfirm={handleConfirmOrder}
      />

      {/* Trading Account Center Modal (Deposit DANA / OVO / GoPay) */}
      <TradingAccountCenterModal
        isOpen={accountCenterOpen}
        onClose={() => setAccountCenterOpen(false)}
        demoBalance={demoState.balance}
        xmBalance={0}
        userId="user-default"
      />

      {/* Trading Studio Modal */}
      {tradingStudioOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTradingStudioOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10099,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(8px)',
            padding: 12
          }}
        >
          <TradingStudioModal onClose={() => setTradingStudioOpen(false)} />
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 1080px) {
          .platform-trader-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
