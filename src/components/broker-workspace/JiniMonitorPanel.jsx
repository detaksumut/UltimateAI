import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RouterConfig } from '../../services/router/RouterConfig.js';
import { visualChartCapture } from '../../services/trading/VisualChartCapture.js';
import { captureBroker, probeBroker } from '../../services/broker/brokerClient.js';

const INSTRUMENTS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'USOIL'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
const INTERVALS = [10, 20, 30, 60, 120];

const ui = {
  card: {
    border: '1px solid rgba(0,229,255,0.16)',
    borderRadius: 8,
    background: 'rgba(7,18,36,0.75)',
    padding: 10,
  },
  label: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: 'rgba(148,163,184,0.7)',
    marginBottom: 5,
  },
  btn: {
    border: '1px solid rgba(0,229,255,0.35)',
    borderRadius: 5,
    background: 'rgba(0,229,255,0.08)',
    color: '#67e8f9',
    fontSize: 9.5,
    fontWeight: 800,
    padding: '5px 7px',
    cursor: 'pointer',
  },
  btnActive: {
    border: '1px solid #00e5ff',
    background: 'rgba(0,229,255,0.2)',
    color: '#e0f7ff',
  },
  small: { fontSize: 10, color: '#94a3b8', lineHeight: 1.6 },
};

function formatError(value) {
  if (value instanceof Error) return value.message || value.name || 'Unknown error';
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const message = value.message || value.error?.message || value.details;
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(value);
    } catch {
      return 'Error tidak dapat dibaca.';
    }
  }
  return String(value ?? 'Error tidak diketahui.');
}

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeTf(value) {
  const v = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  const map = {
    '1': 'M1', '1M': 'M1', '1MIN': 'M1', '1MINUTE': 'M1',
    '5': 'M5', '5M': 'M5', '5MIN': 'M5', '5MINUTES': 'M5',
    '15': 'M15', '15M': 'M15', '15MIN': 'M15', '15MINUTES': 'M15',
    '30': 'M30', '30M': 'M30', '30MIN': 'M30',
    '60': 'H1', '1H': 'H1', '1HR': 'H1', '1HOUR': 'H1',
    '240': 'H4', '4H': 'H4', '4HR': 'H4', '4HOUR': 'H4',
    'D': 'D1', '1D': 'D1', 'D1': 'D1',
  };
  return map[v] || v;
}

function normalizeSymbol(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeVisionResult(raw, frame, instrument, timeframe) {
  const data = { ...(raw || {}) };
  ['last_price', 'open', 'high', 'low', 'close', 'support', 'resistance'].forEach((key) => {
    data[key] = finite(data[key]);
  });
  data.confidence = finite(data.confidence) ?? 0;
  data.visible_candles = finite(data.visible_candles) ?? 0;

  const observedInstrument = String(data.instrument || '').trim();
  const observedTimeframe = String(data.timeframe || '').trim();
  const requestedSymbol = normalizeSymbol(instrument);
  const observedSymbol = normalizeSymbol(observedInstrument);
  const isXauRequest = requestedSymbol === 'XAUUSD';
  const xauObserved = isXauRequest && (
    observedSymbol.includes('XAUUSD') ||
    observedSymbol.includes('GOLDSPOT') ||
    observedSymbol.includes('GOLD')
  );

  data.requestedInstrument = instrument;
  data.requestedTimeframe = timeframe;
  data.observedInstrument = observedInstrument || null;
  data.observedTimeframe = observedTimeframe || null;
  data.symbol_match = Boolean(
    observedInstrument && (
      observedSymbol === requestedSymbol ||
      observedSymbol.includes(requestedSymbol) ||
      requestedSymbol.includes(observedSymbol) ||
      xauObserved
    ),
  );
  data.timeframe_match = Boolean(
    observedTimeframe && normalizeTf(observedTimeframe) === normalizeTf(timeframe),
  );
  data.dataStatus = data.data_quality === 'POOR'
    ? 'VISUAL_POOR'
    : !data.symbol_match || !data.timeframe_match
      ? 'VISUAL_MISMATCH'
      : data.visible_candles < 20
        ? 'VISUAL_INSUFFICIENT'
        : 'VISUAL_READY';
  data.capturedAt = frame?.capturedAt || new Date().toISOString();
  data.visionAt = new Date().toISOString();
  return data;
}

function buildTradePlan(result) {
  if (!result || result.dataStatus !== 'VISUAL_READY') return null;
  const price = result.last_price ?? result.close;
  if (!Number.isFinite(price)) return null;

  const support = Number.isFinite(result.support) ? result.support : null;
  const resistance = Number.isFinite(result.resistance) ? result.resistance : null;
  const range = support != null && resistance != null ? Math.abs(resistance - support) : null;
  const buffer = range && range > 0 ? Math.max(range * 0.12, price * 0.0004) : price * 0.002;

  const scenario = String(result.scenario || '').toUpperCase();
  const trend = String(result.trend || '').toUpperCase();
  const side = scenario.includes('BUY') || (!scenario.includes('SELL') && trend === 'BULLISH')
    ? 'BUY'
    : scenario.includes('SELL') || trend === 'BEARISH'
      ? 'SELL'
      : null;
  if (!side) return null;

  let stopLoss;
  let takeProfit;
  if (side === 'BUY') {
    stopLoss = support != null && support < price ? support - buffer : price - buffer * 2;
    takeProfit = resistance != null && resistance > price ? resistance : price + buffer * 3;
  } else {
    stopLoss = resistance != null && resistance > price ? resistance + buffer : price + buffer * 2;
    takeProfit = support != null && support < price ? support : price - buffer * 3;
  }

  const risk = Math.abs(price - stopLoss);
  const reward = Math.abs(takeProfit - price);
  if (!Number.isFinite(risk) || risk <= 0) return null;

  return {
    side,
    entry: price,
    stopLoss,
    takeProfit,
    riskReward: `1 : ${(reward / risk).toFixed(2)}`,
    basis: support != null && resistance != null
      ? 'Level support/resistance yang terbaca dari chart'
      : 'Estimasi volatilitas visual (level belum terbaca jelas)',
  };
}

function describeChange(previous, next) {
  if (!previous || !next) return null;
  const changes = [];
  const prevScenario = String(previous.scenario || 'UNKNOWN').toUpperCase();
  const nextScenario = String(next.scenario || 'UNKNOWN').toUpperCase();
  if (prevScenario !== nextScenario) changes.push(`Skenario ${prevScenario} → ${nextScenario}`);

  const prevTrend = String(previous.trend || 'UNKNOWN').toUpperCase();
  const nextTrend = String(next.trend || 'UNKNOWN').toUpperCase();
  if (prevTrend !== nextTrend) changes.push(`Tren ${prevTrend} → ${nextTrend}`);

  const prevPrice = previous.last_price;
  const nextPrice = next.last_price;
  if (Number.isFinite(prevPrice) && Number.isFinite(nextPrice) && prevPrice > 0) {
    const diffPct = ((nextPrice - prevPrice) / prevPrice) * 100;
    if (Math.abs(diffPct) >= 0.15) {
      changes.push(`Harga ${diffPct > 0 ? 'naik' : 'turun'} ${Math.abs(diffPct).toFixed(2)}%`);
    }
  }

  if (Number.isFinite(previous.support) && Number.isFinite(nextPrice) && Number.isFinite(previous.last_price)) {
    if (previous.last_price > previous.support && nextPrice < previous.support) changes.push('Harga menembus support');
    if (previous.last_price < previous.support && nextPrice > previous.support) changes.push('Harga kembali di atas support');
  }
  if (Number.isFinite(previous.resistance) && Number.isFinite(nextPrice) && Number.isFinite(previous.last_price)) {
    if (previous.last_price < previous.resistance && nextPrice > previous.resistance) changes.push('Harga menembus resistance');
    if (previous.last_price > previous.resistance && nextPrice < previous.resistance) changes.push('Harga kembali di bawah resistance');
  }

  return changes.length ? changes.join(' • ') : null;
}

function dataStatusLabel(status) {
  switch (status) {
    case 'VISUAL_READY': return 'SIAP ANALISIS';
    case 'VISUAL_POOR': return 'GAMBAR TIDAK JELAS';
    case 'VISUAL_MISMATCH': return 'SIMBOL/TF TIDAK COCOK';
    case 'VISUAL_INSUFFICIENT': return 'CANDLE TERBACA KURANG';
    default: return 'MENUNGGU DATA';
  }
}

export default function JiniMonitorPanel({
  broker,
  brokerStatus,
  nativeAvailable,
  onMonitoringChange,
}) {
  const [instrument, setInstrument] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('M5');
  const [intervalSec, setIntervalSec] = useState(20);
  const [monitoring, setMonitoring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [probing, setProbing] = useState(false);

  const busyRef = useRef(false);
  const runOnceRef = useRef(null);
  const previousResultRef = useRef(null);

  const plan = useMemo(() => buildTradePlan(lastResult), [lastResult]);

  const pushAlert = useCallback((message, level = 'info') => {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, message, level, at: new Date().toISOString() };
    setAlerts((prev) => [entry, ...prev].slice(0, 8));
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('JINI Market Alert', { body: message, silent: false });
      }
    } catch (_) {}
  }, []);

  const runOnce = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      let frame;
      if (nativeAvailable) {
        if (!brokerStatus?.url) {
          throw new Error('Buka platform broker terlebih dahulu sebelum memulai monitoring JINI.');
        }
        if (brokerStatus?.fatalError) {
          throw new Error(`Terminal XM belum terhubung: ${brokerStatus.error || 'koneksi gagal'}`);
        }
        if (brokerStatus?.loginRequired) {
          throw new Error('Selesaikan login manual XM terlebih dahulu. JINI tidak membaca halaman login.');
        }
        frame = await captureBroker({ maxWidth: 2200, quality: 0.92 });
      } else {
        if (!visualChartCapture.active) {
          throw new Error('Izin screen capture belum aktif. Mulai monitoring untuk memilih layar/jendela broker.');
        }
        frame = visualChartCapture.capture({ maxWidth: 2200, quality: 0.95 });
      }

      const response = await fetch(RouterConfig.api('/trading/visual-chart-analysis'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument,
          timeframe,
          image: frame.dataUrl,
          schema: 'chart-ohlc-v1',
        }),
        signal: AbortSignal.timeout(90000),
        cache: 'no-store',
      });

      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`Vision API mengembalikan non-JSON (HTTP ${response.status}). Pastikan endpoint /trading/visual-chart-analysis aktif.`);
      }
      if (!response.ok || payload?.success !== true || !payload?.data) {
        throw new Error(payload?.error || `Vision API gagal (HTTP ${response.status}).`);
      }

      const normalized = normalizeVisionResult(payload.data, frame, instrument, timeframe);
      const change = describeChange(previousResultRef.current, normalized);
      previousResultRef.current = normalized;

      setLastResult(normalized);
      setHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          at: normalized.visionAt,
          trend: normalized.trend || 'UNKNOWN',
          scenario: normalized.scenario || 'WAIT',
          price: normalized.last_price,
          status: normalized.dataStatus,
          confidence: normalized.confidence,
        },
        ...prev,
      ].slice(0, 10));

      if (change) {
        pushAlert(`Perubahan kondisi pasar: ${change}`, 'change');
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [brokerStatus?.url, brokerStatus?.fatalError, brokerStatus?.loginRequired, brokerStatus?.error, instrument, nativeAvailable, pushAlert, timeframe]);

  runOnceRef.current = runOnce;

  useEffect(() => {
    if (!monitoring) return undefined;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      runOnceRef.current?.();
    };
    tick();
    const id = setInterval(tick, Math.max(10, Number(intervalSec) || 20) * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [monitoring, intervalSec]);

  useEffect(() => {
    if (typeof onMonitoringChange === 'function') {
      onMonitoringChange({ monitoring, busy, lastResult, screenShareActive });
    }
  }, [monitoring, busy, lastResult, screenShareActive, onMonitoringChange]);

  useEffect(() => () => {
    if (visualChartCapture.active) visualChartCapture.stop();
  }, []);

  const startMonitoring = async () => {
    setError('');
    if (nativeAvailable) {
      if (brokerStatus?.fatalError) {
        setError(`Terminal XM belum terhubung: ${brokerStatus.error || 'koneksi gagal'}`);
        return;
      }
      if (brokerStatus?.loginRequired) {
        setError('Login manual XM dulu. JINI tidak akan membaca atau merekam halaman login.');
        return;
      }
      const consent = window.confirm(
        'Izinkan JINI membaca chart XM?\n\nJINI hanya mengambil screenshot dari area terminal XM di Broker Workspace, bukan seluruh layar. Screenshot dikirim ke pipeline analisis visual saat monitoring aktif. Tidak ada order otomatis.',
      );
      if (!consent) return;
    }
    if (!nativeAvailable) {
      if (!visualChartCapture.supported) {
        setError('Screen capture tidak didukung browser ini. Gunakan UltimateAI desktop atau browser modern.');
        return;
      }
      try {
        if (!visualChartCapture.active) {
          await visualChartCapture.start();
        }
        setScreenShareActive(visualChartCapture.active);
      } catch (err) {
        setError(`Izin capture layar ditolak atau gagal: ${formatError(err)}`);
        return;
      }
    }
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (_) {}
    setMonitoring(true);
  };

  const stopMonitoring = () => {
    setMonitoring(false);
    if (!nativeAvailable && visualChartCapture.active) {
      visualChartCapture.stop();
    }
    setScreenShareActive(false);
  };

  const handleManualAnalyze = () => {
    runOnceRef.current?.();
  };

  const handleProbeConnection = async () => {
    setProbing(true);
    setError('');
    try {
      await probeBroker();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setProbing(false);
    }
  };

  const diagnostics = brokerStatus?.diagnostics || null;
  const chartDiag = diagnostics?.chart || null;
  const wsDiag = diagnostics?.websocket || null;
  const lastDataRequest = diagnostics?.http?.slice(-1)?.[0] || null;
  const lastFailure = diagnostics?.lastFailure || null;

  const statusColor = brokerStatus?.error
    ? '#fb7185'
    : monitoring
      ? '#34d399'
      : '#fbbf24';

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 10px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ ...ui.card, borderColor: 'rgba(0,229,255,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#67e8f9', letterSpacing: '0.06em' }}>
              JINI AI TRADING ANALYST
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
              Visual chart reader • {nativeAvailable ? 'native broker capture' : 'screen-share capture'}
            </div>
          </div>
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 900,
              padding: '3px 7px',
              borderRadius: 999,
              border: `1px solid ${statusColor}55`,
              background: `${statusColor}18`,
              color: statusColor,
              whiteSpace: 'nowrap',
            }}
          >
            {monitoring ? (busy ? 'MENGANALISIS' : 'MONITORING') : 'STANDBY'}
          </span>
        </div>
        <div style={{ ...ui.small, marginTop: 7 }}>
          JINI hanya membaca tampilan chart secara visual dan memberi analisis. JINI tidak mengirim
          order, tidak mengubah SL/TP, dan tidak mengambil alih transaksi.
        </div>
      </div>

      <div style={ui.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={ui.label}>DIAGNOSTIK KONEKSI XM</div>
          <button
            type="button"
            onClick={handleProbeConnection}
            disabled={probing || !nativeAvailable}
            style={{ ...ui.btn, opacity: probing || !nativeAvailable ? 0.55 : 1 }}
            title="Periksa ulang DOM, chart, dan koneksi data XM"
          >
            {probing ? 'MEMERIKSA...' : 'CEK KONEKSI DATA'}
          </button>
        </div>
        <div style={{ ...ui.small, fontSize: 9.5 }}>
          Chart canvas: {chartDiag?.canvasCount ?? '-'} • No data: {chartDiag?.noDataVisible ? 'YA' : 'TIDAK'} • Market Watch: {chartDiag?.marketWatchVisible ? 'ADA' : '-'}
        </div>
        <div style={{ ...ui.small, fontSize: 9.5 }}>
          WebSocket: {wsDiag?.state || 'none'} • frame: {wsDiag?.frames ?? 0} • handshake: {wsDiag?.handshakeStatus ?? '-'}
        </div>
        <div style={{ ...ui.small, fontSize: 9.5 }}>
          Data request: {lastDataRequest
            ? `${lastDataRequest.host}${lastDataRequest.path} • ${lastDataRequest.status ?? lastDataRequest.error ?? '-'}`
            : 'belum ada'}
        </div>
        <div style={{ ...ui.small, fontSize: 9.5 }}>
          Proxy: {diagnostics?.proxy || '-'} • Debugger: {diagnostics?.debuggerAttached ? 'aktif' : 'tidak'}
        </div>

        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer', fontSize: 9.5, color: '#67e8f9', fontWeight: 800 }}>
            Lihat detail diagnostik
          </summary>
          {lastFailure && (
            <div style={{ ...ui.small, fontSize: 9, marginTop: 5, color: '#fda4af' }}>
              Gagal {lastFailure.phase} kode {lastFailure.code}: {lastFailure.description}
              {lastFailure.url ? ` • ${lastFailure.url.host}${lastFailure.url.path}` : ''}
            </div>
          )}
          {(diagnostics?.http || []).slice(-6).map((entry, index) => (
            <div key={`${entry.at}-${index}`} style={{ ...ui.small, fontSize: 8.5, color: '#94a3b8' }}>
              {entry.host}{entry.path} • {entry.status ?? entry.error ?? '-'}
            </div>
          ))}
          {(diagnostics?.console || []).slice(-3).map((entry, index) => (
            <div key={`${entry.at}-c-${index}`} style={{ ...ui.small, fontSize: 8.5, color: '#fbbf24' }}>
              {entry.message}
            </div>
          ))}
          {diagnostics?.lastBlockedNavigation && (
            <div style={{ ...ui.small, fontSize: 8.5, color: '#fda4af' }}>
              Navigasi popup diblokir: {diagnostics.lastBlockedNavigation.url?.host || '-'}
            </div>
          )}
        </details>
      </div>

      <div style={ui.card}>
        <div style={ui.label}>INSTRUMEN (HINT UNTUK AI)</div>
        <input
          list="jin-broker-instruments"
          value={instrument}
          onChange={(event) => setInstrument(String(event.target.value || '').toUpperCase())}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#06101f',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 5,
            color: '#e2e8f0',
            fontSize: 11,
            padding: '6px 8px',
            outline: 'none',
          }}
        />
        <datalist id="jin-broker-instruments">
          {INSTRUMENTS.map((symbol) => <option key={symbol} value={symbol} />)}
        </datalist>

        <div style={{ ...ui.label, marginTop: 9 }}>TIMEFRAME (HINT UNTUK AI)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              style={{ ...ui.btn, padding: '4px 0', ...(timeframe === tf ? ui.btnActive : {}) }}
            >
              {tf}
            </button>
          ))}
        </div>

        <div style={{ ...ui.label, marginTop: 9 }}>INTERVAL ANALISIS</div>
        <select
          value={intervalSec}
          onChange={(event) => setIntervalSec(Number(event.target.value) || 20)}
          style={{
            width: '100%',
            background: '#06101f',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 5,
            color: '#e2e8f0',
            fontSize: 10.5,
            padding: '6px 8px',
          }}
        >
          {INTERVALS.map((seconds) => (
            <option key={seconds} value={seconds}>
              Setiap {seconds} detik
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 5, marginTop: 9 }}>
          {!monitoring ? (
            <button type="button" onClick={startMonitoring} style={{ ...ui.btn, flex: 1, padding: '7px 8px' }}>
              MULAI MONITORING
            </button>
          ) : (
            <button
              type="button"
              onClick={stopMonitoring}
              style={{ ...ui.btn, flex: 1, padding: '7px 8px', borderColor: 'rgba(251,113,133,0.6)', color: '#fda4af', background: 'rgba(251,113,133,0.1)' }}
            >
              HENTIKAN MONITORING
            </button>
          )}
          <button type="button" onClick={handleManualAnalyze} disabled={busy} style={{ ...ui.btn, opacity: busy ? 0.55 : 1 }}>
            {busy ? 'MEMBACA...' : 'ANALISIS SEKARANG'}
          </button>
        </div>

        <div style={{ ...ui.small, marginTop: 7, fontSize: 9.5 }}>
          {nativeAvailable
            ? 'Capture hanya diambil saat monitoring aktif atau tombol analisis ditekan.'
            : screenShareActive
              ? 'Screen share aktif. Pastikan jendela broker yang dipilih tetap terlihat.'
              : 'Monitoring web memerlukan izin screen share dan pemilihan jendela broker.'}
        </div>
      </div>

      {error && (
        <div style={{ ...ui.card, borderColor: 'rgba(251,113,133,0.45)', background: 'rgba(80,7,20,0.35)' }}>
          <div style={{ fontSize: 10, color: '#fda4af', lineHeight: 1.6 }}>{error}</div>
        </div>
      )}

      <div style={ui.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={ui.label}>REKOMENDASI TERAKHIR</div>
          <span style={{ fontSize: 9, color: '#64748b' }}>
            {lastResult?.visionAt ? new Date(lastResult.visionAt).toLocaleTimeString('id-ID') : '—'}
          </span>
        </div>

        {!lastResult ? (
          <div style={ui.small}>Belum ada analisis. Mulai monitoring atau tekan ANALISIS SEKARANG.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: String(lastResult.scenario || '').includes('BUY')
                    ? '#34d399'
                    : String(lastResult.scenario || '').includes('SELL')
                      ? '#fb7185'
                      : '#fbbf24',
                }}
              >
                {lastResult.scenario || 'WAIT'}
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                {lastResult.trend || 'UNKNOWN'} • confidence {Number(lastResult.confidence || 0).toFixed(0)}%
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9.5, color: '#67e8f9' }}>{dataStatusLabel(lastResult.dataStatus)}</span>
              <span style={{ fontSize: 9.5, color: '#64748b' }}>
                {lastResult.observedInstrument || '—'} / {lastResult.observedTimeframe || '—'}
              </span>
              <span style={{ fontSize: 9.5, color: '#64748b' }}>
                {lastResult.visible_candles || 0} candle terbaca
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              <div style={{ background: '#06101f', borderRadius: 5, padding: '6px 7px' }}>
                <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>HARGA TERBACA</div>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 800 }}>
                  {Number.isFinite(lastResult.last_price) ? lastResult.last_price : '—'}
                </div>
              </div>
              <div style={{ background: '#06101f', borderRadius: 5, padding: '6px 7px' }}>
                <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>MOMENTUM</div>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 800 }}>
                  {lastResult.momentum || 'UNKNOWN'}
                </div>
              </div>
              <div style={{ background: '#06101f', borderRadius: 5, padding: '6px 7px' }}>
                <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>SUPPORT</div>
                <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 800 }}>
                  {Number.isFinite(lastResult.support) ? lastResult.support : '—'}
                </div>
              </div>
              <div style={{ background: '#06101f', borderRadius: 5, padding: '6px 7px' }}>
                <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>RESISTANCE</div>
                <div style={{ fontSize: 12, color: '#fb7185', fontWeight: 800 }}>
                  {Number.isFinite(lastResult.resistance) ? lastResult.resistance : '—'}
                </div>
              </div>
            </div>

            {plan ? (
              <div style={{ marginTop: 9, borderTop: '1px solid rgba(0,229,255,0.12)', paddingTop: 8 }}>
                <div style={{ ...ui.label, marginBottom: 6 }}>RENCANA INDIKATIF (BUKAN ORDER OTOMATIS)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {[
                    ['ENTRY', plan.entry, '#e2e8f0'],
                    ['STOP LOSS', plan.stopLoss, '#fb7185'],
                    ['TAKE PROFIT', plan.takeProfit, '#34d399'],
                    ['RISK/REWARD', plan.riskReward, '#67e8f9'],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ background: '#06101f', borderRadius: 5, padding: '6px 7px' }}>
                      <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>{label}</div>
                      <div style={{ fontSize: 11.5, color, fontWeight: 800 }}>
                        {typeof value === 'number' ? value.toFixed(value >= 100 ? 2 : 4) : value}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ ...ui.small, fontSize: 9, marginTop: 6 }}>
                  Bias {plan.side}. {plan.basis}. Validasi manual di platform broker sebelum bertransaksi.
                </div>
              </div>
            ) : (
              <div style={{ ...ui.small, fontSize: 9.5, marginTop: 8 }}>
                Belum ada rencana Entry/SL/TP valid. Tunggu sampai simbol, timeframe, dan candle
                terbaca cukup jelas.
              </div>
            )}

            {lastResult.note && (
              <div style={{ ...ui.small, fontSize: 9.5, marginTop: 8, color: '#cbd5e1' }}>
                Catatan AI: {lastResult.note}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8.5, color: lastResult.symbol_match ? '#34d399' : '#fb7185' }}>
                {lastResult.symbol_match ? 'SIMBOL COCOK' : 'SIMBOL TIDAK COCOK'}
              </span>
              <span style={{ fontSize: 8.5, color: lastResult.timeframe_match ? '#34d399' : '#fb7185' }}>
                {lastResult.timeframe_match ? 'TIMEFRAME COCOK' : 'TIMEFRAME TIDAK COCOK'}
              </span>
              <span style={{ fontSize: 8.5, color: '#64748b' }}>
                {lastResult.data_quality || 'UNKNOWN'} • {lastResult.volatility || 'UNKNOWN'}
              </span>
            </div>
          </>
        )}
      </div>

      {alerts.length > 0 && (
        <div style={ui.card}>
          <div style={ui.label}>NOTIFIKASI PERUBAHAN PASAR</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{ display: 'flex', gap: 6, fontSize: 9.5, color: '#fbbf24', lineHeight: 1.5 }}>
                <span style={{ color: '#64748b', flexShrink: 0 }}>
                  {new Date(alert.at).toLocaleTimeString('id-ID')}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={ui.card}>
          <div style={ui.label}>RIWAYAT ANALISIS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 6,
                  fontSize: 9.5,
                  color: '#94a3b8',
                  borderBottom: '1px solid rgba(148,163,184,0.08)',
                  paddingBottom: 4,
                }}
              >
                <span>{new Date(item.at).toLocaleTimeString('id-ID')} • {item.scenario}</span>
                <span style={{ color: '#67e8f9' }}>{Number.isFinite(item.price) ? item.price : '—'}</span>
                <span style={{ color: '#64748b' }}>{item.confidence?.toFixed?.(0) ?? 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...ui.small, fontSize: 8.5, color: '#475569', lineHeight: 1.6 }}>
        Informasi edukatif, bukan nasihat keuangan. Analisis visual dapat salah baca. Selalu
        verifikasi level, spread, ukuran kontrak, dan risiko langsung di platform broker.
      </div>
    </div>
  );
}
