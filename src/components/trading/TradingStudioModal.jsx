import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AIAnalystPanel from './AIAnalystPanel.jsx';
import VisualChartCapturePanel from './VisualChartCapturePanel.jsx';
import GoldNewsModal from './GoldNewsModal.jsx';
import CrossAssetMonitor from './CrossAssetMonitor.jsx';
import BrokerViewport from '../broker-workspace/BrokerViewport.jsx';
import JiniMonitorPanel from '../broker-workspace/JiniMonitorPanel.jsx';
import ScalpingM1Panel from './ScalpingM1Panel.jsx';
import {
  brokerConnectionLabel,
  brokerErrorHint,
  brokerGoBack,
  brokerGoForward,
  clearBrokerSession,
  getBrokerStatus,
  listBrokers,
  loadBrokerLogin,
  openBrokerExternal,
  reloadBroker,
  subscribeBrokerStatus,
} from '../../services/broker/brokerClient.js';

const instruments = [
  { value: 'OANDA:XAUUSD', label: 'XAUUSD (Gold)' },
  { value: 'TVC:USOIL', label: 'USOIL (WTI Crude Oil)' },
  { value: 'BINANCE:BTCUSDT', label: 'BTCUSDT' },
  { value: 'BINANCE:ETHUSDT', label: 'ETHUSDT' },
  { value: 'OANDA:EURUSD', label: 'EURUSD' },
  { value: 'OANDA:GBPUSD', label: 'GBPUSD' },
  { value: 'CAPITALCOM:US30', label: 'US30' },
];
const intervals = [
  { value: '5', label: 'M5' },
  { value: '15', label: 'M15' },
  { value: '30', label: 'M30' },
  { value: '60', label: 'H1' },
  { value: '240', label: 'H4' },
  { value: 'D', label: 'D1' },
];

const PLATFORM_MODES = [
  { id: 'tradingview', label: '▥ TradingView Mode' },
  { id: 'broker', label: '◈ Original Broker Mode' },
];

export default function TradingStudioModal({ onClose }) {
  const [symbol, setSymbol] = useState('OANDA:XAUUSD');
  const [interval, setInterval] = useState('240');
  const [chartMode, setChartMode] = useState('normal');
  const [tradingViewMode, setTradingViewMode] = useState('widget');
  const [platformMode, setPlatformMode] = useState('tradingview');
  const [signal, setSignal] = useState(null);
  const [showGoldNews, setShowGoldNews] = useState(true);

  // ── Original Broker Mode state (native WebContentsView) ──
  const [brokers, setBrokers] = useState([]);
  const [brokerId, setBrokerId] = useState('xm');
  const [platformId, setPlatformId] = useState('xm-web');
  const [brokerStatus, setBrokerStatus] = useState(null);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [monitorState, setMonitorState] = useState({ monitoring: false, busy: false });

  useEffect(() => {
    const onSignal = event => setSignal(event.detail || null);
    const onClear = () => setSignal(null);
    window.addEventListener('jin:signal-ready', onSignal);
    window.addEventListener('jin:signal-clear', onClear);
    return () => { window.removeEventListener('jin:signal-ready', onSignal); window.removeEventListener('jin:signal-clear', onClear); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listBrokers().then((items) => {
      if (cancelled) return;
      setBrokers(items);
      const first = items.find((item) => item.enabled && item.platforms?.length) || items[0];
      if (first) {
        setBrokerId(first.id);
        setPlatformId(first.defaultPlatformId || first.platforms?.[0]?.id || '');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBrokerStatus((next) => setBrokerStatus(next));
    getBrokerStatus().then((current) => {
      if (current) setBrokerStatus(current);
    }).catch(() => {});
    return unsubscribe;
  }, []);

  const selectedBroker = useMemo(
    () => brokers.find((broker) => broker.id === brokerId) || null,
    [brokers, brokerId],
  );
  const selectedPlatform = useMemo(
    () => selectedBroker?.platforms?.find((platform) => platform.id === platformId)
      || selectedBroker?.platforms?.[0]
      || null,
    [selectedBroker, platformId],
  );

  const handleBrokerChange = useCallback((nextBrokerId) => {
    const broker = brokers.find((item) => item.id === nextBrokerId);
    if (!broker) return;
    setBrokerId(broker.id);
    setPlatformId(broker.defaultPlatformId || broker.platforms?.[0]?.id || '');
  }, [brokers]);

  const handlePlatformModeChange = useCallback((nextMode) => {
    setPlatformMode(nextMode);
    if (nextMode === 'tradingview') setNativeAvailable(false);
  }, []);

  const handleBrokerLogin = useCallback(async () => {
    if (!nativeAvailable) {
      window.alert(
        'Login XM di dalam workspace membutuhkan Electron (WebContentsView).\n\nJalankan aplikasi desktop UltimateAI, bukan hanya Vite di browser.',
      );
      return;
    }
    try {
      const result = await loadBrokerLogin(
        selectedBroker?.id || brokerId,
        selectedPlatform?.id || platformId,
      );
      if (result?.ok === false) {
        window.alert(result.reason === 'electron_required'
          ? 'Login XM di dalam workspace membutuhkan Electron.'
          : 'Gagal membuka halaman login XM.');
      }
    } catch (err) {
      window.alert(err?.message || 'Gagal membuka halaman login XM.');
    }
  }, [brokerId, nativeAvailable, platformId, selectedBroker, selectedPlatform]);

  const handleBrokerReload = useCallback(() => {
    reloadBroker().catch(() => {});
  }, []);

  const handleBrokerBack = useCallback(() => {
    brokerGoBack().catch(() => {});
  }, []);

  const handleBrokerForward = useCallback(() => {
    brokerGoForward().catch(() => {});
  }, []);

  const handleBrokerClearSession = useCallback(async () => {
    const ok = window.confirm(
      'Keluar dari sesi XM?\n\nCookies dan sesi login XM akan dihapus dari workspace. UltimateAI tidak pernah menyimpan password Anda.',
    );
    if (!ok) return;
    try {
      await clearBrokerSession();
    } catch (err) {
      window.alert(err?.message || 'Gagal menghapus sesi XM.');
    }
  }, []);

  const handleOpenBrokerExternal = useCallback(async () => {
    try {
      await openBrokerExternal(
        selectedBroker?.id || brokerId,
        selectedPlatform?.id || platformId,
        brokers,
      );
    } catch (err) {
      window.alert(err?.message || 'Gagal membuka terminal resmi XM.');
    }
  }, [brokerId, brokers, platformId, selectedBroker, selectedPlatform]);

  const handleViewportError = useCallback((message) => {
    setBrokerStatus((prev) => ({ ...(prev || {}), error: message }));
  }, []);

  const handleMonitoringChange = useCallback((next) => {
    setMonitorState({ monitoring: Boolean(next?.monitoring), busy: Boolean(next?.busy) });
  }, []);

  const instrument = symbol.split(':').pop();
  const timeframe = ({ '5': 'M5', '15': 'M15', '30': 'M30', '60': 'H1', '240': 'H4', D: 'D1' })[interval] || 'H1';
  const isFullChart = chartMode === 'full';
  const isBrokerMode = platformMode === 'broker';
  const showAnalysisPanel = isBrokerMode ? true : !isFullChart;
  const gridColumns = isBrokerMode
    ? 'minmax(0, 1.65fr) minmax(320px, 1fr)'
    : isFullChart
      ? 'minmax(0, 1fr)'
      : chartMode === 'compact'
        ? 'minmax(0, 1.5fr) minmax(320px, 1fr)'
        : 'minmax(0, 1.65fr) minmax(320px, 1fr)';

  const canUseNativeControls = nativeAvailable && Boolean(brokerStatus?.url);
  const brokerLabel = brokerStatus?.brokerId === brokerId
    ? brokerConnectionLabel(brokerStatus)
    : 'BELUM DIBUKA';
  const jiniStatus = isBrokerMode
    ? brokerStatus?.error
      ? 'BROKER ERROR'
      : monitorState.monitoring
        ? (monitorState.busy ? 'ANALYZING XM' : 'MONITORING XM')
        : brokerStatus?.loginRequired
          ? 'XM LOGIN'
          : 'XM READY'
    : 'ONLINE';

  return (
    <main style={{ minHeight: 'calc(100vh - 24px)', background: '#030812', color: '#e2e8f0', padding: 10, fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ color: '#22d3ee', fontSize: 11, letterSpacing: 1.6, fontWeight: 800 }}>JIN TRADING INTELLIGENCE STUDIO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={labelStyle}>Instrumen
            <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}>
              {instruments.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Timeframe
            <select value={interval} onChange={e => setInterval(e.target.value)} style={selectStyle}>
              {intervals.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>

          <div role="group" aria-label="Platform Mode" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid #164e63', borderRadius: 5, background: '#06101d' }}>
            {PLATFORM_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => handlePlatformModeChange(mode.id)}
                aria-pressed={platformMode === mode.id}
                style={modeButtonStyle(platformMode === mode.id)}
                title={mode.id === 'broker'
                  ? 'Tampilkan login & terminal asli XM di area chart utama (Electron WebContentsView)'
                  : 'Gunakan chart TradingView widget OANDA / S&D'}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {!isBrokerMode && (
            <div role="group" aria-label="Mode TradingView" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid #164e63', borderRadius: 5, background: '#06101d' }}>
              <button type="button" onClick={() => window.open('https://id.tradingview.com/chart/W7kNYFdb/', '_blank', 'noopener,noreferrer')} aria-pressed={false} style={modeButtonStyle(false)} title="Buka chart TradingView tersimpan di tab baru">↗ Chart Lengkap</button>
              <button type="button" onClick={() => setTradingViewMode('widget')} aria-pressed={tradingViewMode === 'widget'} style={modeButtonStyle(tradingViewMode === 'widget')} title="Gunakan widget chart embed">▥ Widget</button>
            </div>
          )}

          {isBrokerMode && (
            <div role="group" aria-label="Broker XM" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid #164e63', borderRadius: 5, background: '#06101d' }}>
              <select
                value={brokerId}
                onChange={(event) => handleBrokerChange(event.target.value)}
                style={{ ...selectStyle, padding: '5px 7px' }}
                title="Pilih broker untuk Original Broker Mode"
              >
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id} disabled={!broker.enabled}>
                    {broker.name}{broker.enabled ? '' : ' (belum aktif)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div role="group" aria-label="Ukuran chart" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid #164e63', borderRadius: 5, background: '#06101d' }}>
            <button type="button" onClick={() => setChartMode('compact')} aria-pressed={chartMode === 'compact'} style={modeButtonStyle(chartMode === 'compact')} title="Perkecil chart, perluas area analisis">▤ Compact</button>
            <button type="button" onClick={() => setChartMode('normal')} aria-pressed={chartMode === 'normal'} style={modeButtonStyle(chartMode === 'normal')} title="Tampilan chart dan AI normal">▥ Normal</button>
            <button type="button" onClick={() => setChartMode('full')} aria-pressed={chartMode === 'full'} style={modeButtonStyle(chartMode === 'full')} title="Perbesar chart">⛶ Full Chart</button>
          </div>
          {onClose && <button type="button" onClick={onClose} style={closeStyle} aria-label="Tutup Trading Studio">✕</button>}
        </div>
      </header>

      <div className="jin-trading-grid" style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 10, minHeight: 'calc(100vh - 95px)', alignItems: 'start' }}>
        {isBrokerMode ? (
          <section aria-label="Terminal XM asli" style={{ position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '6px 9px', border: '1px solid #164e63', borderRadius: 6, background: '#06101d' }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#67e8f9', letterSpacing: 1 }}>XM ORIGINAL TERMINAL</span>
              <span style={statusPillStyle(brokerStatus)}>{brokerLabel}</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={handleBrokerLogin} disabled={!nativeAvailable} style={{ ...toolbarBtnStyle, color: '#67e8f9', borderColor: 'rgba(0,229,255,0.35)', opacity: nativeAvailable ? 1 : 0.45 }} title="Muat halaman login resmi XM">LOGIN XM</button>
              <button type="button" onClick={handleBrokerReload} disabled={!canUseNativeControls} style={{ ...toolbarBtnStyle, opacity: canUseNativeControls ? 1 : 0.45 }} title="Reload terminal XM">RELOAD</button>
              <button type="button" onClick={handleBrokerBack} disabled={!canUseNativeControls || !brokerStatus?.canGoBack} style={{ ...toolbarBtnStyle, opacity: canUseNativeControls && brokerStatus?.canGoBack ? 1 : 0.45 }} title="Kembali di dalam halaman XM">← BACK</button>
              <button type="button" onClick={handleBrokerForward} disabled={!canUseNativeControls || !brokerStatus?.canGoForward} style={{ ...toolbarBtnStyle, opacity: canUseNativeControls && brokerStatus?.canGoForward ? 1 : 0.45 }} title="Maju di dalam halaman XM">FORWARD →</button>
              <button type="button" onClick={handleBrokerClearSession} disabled={!canUseNativeControls} style={{ ...toolbarBtnStyle, color: '#fda4af', borderColor: 'rgba(251,113,133,0.4)', opacity: canUseNativeControls ? 1 : 0.45 }} title="Hapus cookies/sesi login XM">LOGOUT</button>
              <button type="button" onClick={handleOpenBrokerExternal} style={{ ...toolbarBtnStyle, color: '#67e8f9', borderColor: 'rgba(0,229,255,0.35)' }} title="Buka terminal resmi XM di browser Anda">OPEN BROWSER</button>
            </div>

            {brokerStatus?.fatalError && (
              <div style={{ padding: '7px 9px', fontSize: 10, color: '#fda4af', background: 'rgba(80,7,20,0.4)', border: '1px solid rgba(251,113,133,0.35)', borderRadius: 6, lineHeight: 1.55 }}>
                <strong style={{ color: '#fb7185' }}>KONEKSI XM GAGAL: </strong>
                {brokerStatus.error || 'Terminal XM tidak dapat dimuat.'}
                <div style={{ marginTop: 3, color: '#fecdd3' }}>{brokerErrorHint(brokerStatus)}</div>
              </div>
            )}

            <div style={{ position: 'relative', width: '100%', height: isFullChart ? 'calc(100vh - 175px)' : 560, minHeight: 480, border: '1px solid #164e63', borderRadius: 7, overflow: 'hidden', background: '#030812' }}>
              <BrokerViewport
                broker={selectedBroker}
                platform={selectedPlatform}
                status={brokerStatus}
                suspended={showGoldNews}
                onNativeAvailability={setNativeAvailable}
                onOpenExternal={handleOpenBrokerExternal}
                onViewportError={handleViewportError}
              />
            </div>
          </section>
        ) : (
          <section aria-label="TradingView live chart" style={{ position: 'relative', minWidth: 0, minHeight: isFullChart ? 'calc(100vh - 105px)' : 560, height: isFullChart ? 'calc(100vh - 105px)' : 'auto', border: '1px solid #164e63', borderRadius: 7, overflow: 'hidden', background: '#030812' }}>
            <iframe
              title={`TradingView ${instrument} ${timeframe}`}
              src={`https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=030812&studies=[]&theme=dark&style=1&timezone=Asia%2FJakarta&withdateranges=1&hideideas=1`}
              style={{ width: '100%', height: '100%', minHeight: isFullChart ? 'calc(100vh - 105px)' : 560, border: 0, display: 'block' }}
              allowFullScreen
            />
            {signal && <div role="status" style={{ position: 'absolute', zIndex: 5, top: 58, right: 18, width: 220, padding: 10, borderRadius: 6, border: '1px solid ' + (signal.side === 'BUY' ? '#10b981' : signal.side === 'SELL' ? '#f43f5e' : '#f59e0b'), background: 'rgba(3,8,18,.94)', boxShadow: '0 4px 18px #0008', pointerEvents: 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: signal.side === 'BUY' ? '#34d399' : signal.side === 'SELL' ? '#fb7185' : '#fbbf24' }}>JIN SIGNAL · {signal.side}</div>
              <div style={{ fontSize: 10, color: '#e2e8f0', marginTop: 5 }}>Entry: {Number.isFinite(signal.entry) ? signal.entry.toFixed(2) : '—'}</div>
              <div style={{ fontSize: 10, color: '#e2e8f0' }}>SL: {Number.isFinite(signal.stopLoss) ? signal.stopLoss.toFixed(2) : '—'} · TP: {Number.isFinite(signal.takeProfit) ? signal.takeProfit.toFixed(2) : '—'}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 5 }}>{signal.reason}</div>
              <div style={{ fontSize: 8, color: '#64748b', marginTop: 5 }}>Dari pembacaan 4 TF · {signal.createdAt ? new Date(signal.createdAt).toLocaleTimeString() : ''}</div>
            </div>}
          </section>
        )}
        {showAnalysisPanel && <section aria-label="AI Technical Analyst" style={{ minWidth: 0, border: '1px solid #164e63', borderRadius: 7, background: '#06101d', padding: 12, overflowY: 'auto', maxHeight: isBrokerMode ? 'calc(100vh - 110px)' : 'none' }}>
          <h2 style={{ color: '#22d3ee', fontSize: 12, letterSpacing: 1, fontWeight: 800, margin: '0 0 12px' }}>AI TECHNICAL ANALYST</h2>
          {isBrokerMode ? (
            <>
              <div style={{ border: '1px solid rgba(0,229,255,0.2)', borderRadius: 6, background: '#050b16', marginBottom: 10, overflow: 'hidden' }}>
                <JiniMonitorPanel
                  broker={selectedBroker}
                  brokerStatus={brokerStatus}
                  nativeAvailable={nativeAvailable}
                  onMonitoringChange={handleMonitoringChange}
                />
              </div>
              <ScalpingM1Panel symbol={instrument} />
            </>
          ) : (
            <>
              <VisualChartCapturePanel instrument={instrument} timeframe={timeframe} onTimeframeChange={setInterval} />
              <ScalpingM1Panel symbol={instrument} />
            </>
          )}
          <AIAnalystPanel instrument={instrument} timeframe={timeframe} />
          {isBrokerMode && (
            <div style={{ marginTop: 8, fontSize: 8.5, color: '#64748b', lineHeight: 1.6 }}>
              Analisis visual XM memakai native capture dari WebContentsView dengan izin pengguna.
              Analisis indikator numerik memakai feed MT5 terpisah; harga pada terminal XM tidak
              diganti dengan data OANDA. Status JINI: {jiniStatus}.
            </div>
          )}
        </section>}
      </div>
      <section aria-label="Trend Instrumen Live" style={{ marginTop: 12, minWidth: 0 }}>
        <CrossAssetMonitor />
      </section>
      <section id="jin-gold-news-panel" aria-label="Berita Fundamental Emas" style={{ marginTop: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#22d3ee', fontSize: 13, letterSpacing: 1, fontWeight: 900 }}>✦ BERITA FUNDAMENTAL EMAS</h2>
          <button type="button" onClick={() => setShowGoldNews(v => !v)} aria-expanded={showGoldNews} style={{ padding: '7px 10px', border: '1px solid #155e75', borderRadius: 5, background: '#071827', color: '#a5f3fc', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
            {showGoldNews ? 'SEMBUNYIKAN BERITA' : 'TAMPILKAN BERITA'}
          </button>
        </div>
        {showGoldNews && <GoldNewsModal open={showGoldNews} onClose={() => setShowGoldNews(false)} instrument={instrument} inline />}
      </section>
      <style>{'@media(max-width:1150px){.jin-trading-grid{grid-template-columns:1fr!important}.jin-trading-grid section[aria-label="TradingView live chart"]{height:auto!important;min-height:60vh!important}}'}</style>
    </main>
  );
}

const labelStyle = { display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 10, fontWeight: 700 };
const selectStyle = { padding: '6px 8px', background: '#071827', color: '#dbeafe', border: '1px solid #155e75', borderRadius: 4, fontSize: 11 };
const closeStyle = { width: 28, height: 28, border: '1px solid #ef4444', borderRadius: 4, background: '#220b12', color: '#f87171', fontWeight: 900, cursor: 'pointer' };
const modeButtonStyle = active => ({ padding: '6px 8px', border: active ? '1px solid #22d3ee' : '1px solid transparent', borderRadius: 4, background: active ? 'rgba(8,145,178,0.2)' : 'transparent', color: active ? '#67e8f9' : '#94a3b8', fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' });
const toolbarBtnStyle = { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 5, background: 'rgba(15,23,42,0.75)', color: '#cbd5e1', fontSize: 9, fontWeight: 800, padding: '5px 7px', cursor: 'pointer', whiteSpace: 'nowrap' };
const statusPillStyle = (status) => {
  const color = status?.error ? '#fb7185' : status?.loading ? '#fbbf24' : status?.platformReady ? '#34d399' : status?.loginRequired ? '#38bdf8' : '#64748b';
  return {
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: '0.04em',
    padding: '3px 8px',
    borderRadius: 999,
    border: `1px solid ${color}55`,
    background: `${color}18`,
    color,
    maxWidth: 300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
};
