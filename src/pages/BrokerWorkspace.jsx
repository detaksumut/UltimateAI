import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrokerViewport from '../components/broker-workspace/BrokerViewport.jsx';
import JiniMonitorPanel from '../components/broker-workspace/JiniMonitorPanel.jsx';
import M1LevelPreviewPanel from '../components/broker-workspace/M1LevelPreviewPanel.jsx';
import M1LevelLegend from '../components/broker-workspace/M1LevelLegend.jsx';
import SupplyDemandEnginePanel from '../components/broker-workspace/SupplyDemandEnginePanel.jsx';
import FaktorUpDownGoldPanel from '../components/broker-workspace/FaktorUpDownGoldPanel.jsx';
import JinGoldOrderFlowPanel from '../components/broker-workspace/JinGoldOrderFlowPanel.jsx';
import ScalpingM1Panel from '../components/trading/ScalpingM1Panel.jsx';
import {
  brokerConnectionLabel,
  brokerErrorHint,
  brokerGoBack,
  brokerGoForward,
  clearBrokerSession,
  getBrokerStatus,
  isElectronRuntime,
  listBrokers,
  loadBrokerLogin,
  openBrokerExternal,
  reloadBroker,
  requestDesktopBroker,
  subscribeBrokerStatus,
} from '../services/broker/brokerClient.js';

const PANEL_STORAGE_KEY = 'ultimateai_broker_workspace_panel_width';

function readPanelWidth() {
  try {
    const saved = Number(localStorage.getItem(PANEL_STORAGE_KEY));
    if (Number.isFinite(saved) && saved >= 300 && saved <= 640) return saved;
  } catch (_) {}
  return 380;
}

const controlBtn = {
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 5,
  background: 'rgba(15,23,42,0.75)',
  color: '#cbd5e1',
  fontSize: 10,
  fontWeight: 800,
  padding: '5px 9px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function StatusDot({ status }) {
  const color = status?.error
    ? '#fb7185'
    : status?.loading
      ? '#fbbf24'
      : status?.platformReady
        ? '#34d399'
        : status?.loginRequired
          ? '#38bdf8'
          : '#64748b';
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}`,
        display: 'inline-block',
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}

export default function BrokerWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [brokers, setBrokers] = useState([]);
  const [brokerId, setBrokerId] = useState('xm');
  const [platformId, setPlatformId] = useState('xm-web');
  const [status, setStatus] = useState(null);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [monitorState, setMonitorState] = useState({ monitoring: false, busy: false });
  const [panelWidth, setPanelWidth] = useState(readPanelWidth);
  const [panelTab, setPanelTab] = useState('monitor');
  const [m1Preview, setM1Preview] = useState(null);
  const [resizing, setResizing] = useState(false);
  const [loginRequestId, setLoginRequestId] = useState(0);
  const [desktopNotice, setDesktopNotice] = useState('');
  const chartColumnRef = useRef(null);

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

  useEffect(() => {
    let cancelled = false;
    listBrokers().then((items) => {
      if (cancelled) return;
      setBrokers(items);
      const requestedBrokerId = searchParams.get('broker');
      const requested = requestedBrokerId
        ? items.find((item) => item.id === requestedBrokerId && item.enabled && item.platforms?.length)
        : null;
      const first = requested
        || items.find((item) => item.enabled && item.platforms?.length)
        || items[0];
      if (first) {
        setBrokerId(first.id);
        const requestedPlatformId = searchParams.get('platform');
        const platform = first.platforms?.find((item) => item.id === requestedPlatformId);
        setPlatformId(platform?.id || first.defaultPlatformId || first.platforms?.[0]?.id || '');
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!brokers.length) return;
    const requestedBrokerId = searchParams.get('broker');
    if (!requestedBrokerId) return;
    const broker = brokers.find(
      (item) => item.id === requestedBrokerId && item.enabled && item.platforms?.length,
    );
    if (!broker) return;
    setBrokerId(broker.id);
    const requestedPlatformId = searchParams.get('platform');
    const platform = broker.platforms.find((item) => item.id === requestedPlatformId)
      || broker.platforms[0];
    setPlatformId(platform?.id || '');
  }, [brokers, searchParams]);

  useEffect(() => {
    const unsubscribe = subscribeBrokerStatus((next) => setStatus(next));
    getBrokerStatus().then((current) => {
      if (current) setStatus(current);
    }).catch(() => {});
    return unsubscribe;
  }, []);

  const handleBrokerChange = (nextBrokerId) => {
    const broker = brokers.find((item) => item.id === nextBrokerId);
    if (!broker) return;
    const nextPlatformId = broker.defaultPlatformId || broker.platforms?.[0]?.id || '';
    setBrokerId(broker.id);
    setPlatformId(nextPlatformId);
    setSearchParams({ broker: broker.id, platform: nextPlatformId }, { replace: true });
  };

  const handlePlatformChange = (nextPlatformId) => {
    setPlatformId(nextPlatformId);
    setSearchParams({ broker: brokerId, platform: nextPlatformId }, { replace: true });
  };

  const handleOpenExternal = useCallback(async (broker, platform) => {
    try {
      await openBrokerExternal(broker?.id || brokerId, platform?.id || platformId, brokers);
    } catch (err) {
      window.alert(err?.message || 'Gagal membuka terminal resmi broker.');
    }
  }, [brokerId, brokers, platformId]);

  const handleRequestDesktopApp = useCallback((broker, platform) => {
    const targetBrokerId = broker?.id || brokerId;
    const targetPlatformId = platform?.id || platformId;
    const result = requestDesktopBroker(targetBrokerId, targetPlatformId);
    if (result?.ok) {
      return {
        ...result,
        message:
          'Permintaan handoff ke aplikasi desktop dikirim lewat protokol ultimateai://. '
          + 'Browser tidak dapat memastikan aplikasi sudah terbuka. Jika tidak ada respons, '
          + 'jalankan "npm run dev:desktop" atau aplikasi UltimateAI Desktop, lalu buka Broker Workspace.',
      };
    }
    if (result?.reason === 'already_electron') {
      return {
        ...result,
        message: 'Anda sudah berada di aplikasi desktop UltimateAI; terminal XM dimuat di WebContentsView.',
      };
    }
    return {
      ...result,
      message: result?.message
        || 'Deep link desktop tidak dapat dimulai. Jalankan aplikasi UltimateAI Desktop lalu buka Broker Workspace.',
    };
  }, [brokerId, platformId]);

  const handleClearSession = async () => {
    const ok = window.confirm(
      'Keluar dari sesi broker ini?\n\nCookies dan sesi login broker akan dihapus dari workspace. UltimateAI tidak pernah menyimpan password Anda.',
    );
    if (!ok) return;
    try {
      await clearBrokerSession();
    } catch (err) {
      window.alert(err?.message || 'Gagal menghapus sesi broker.');
    }
  };

  const handleReload = () => {
    reloadBroker().catch(() => {});
  };

  const handleLogin = async () => {
    if (!nativeAvailable) {
      window.alert(
        'Login XM di dalam workspace membutuhkan Electron (WebContentsView).\n\nJalankan aplikasi desktop, bukan hanya Vite di browser.',
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
  };

  const handleViewportError = useCallback((message) => {
    setStatus((prev) => ({ ...(prev || {}), error: message }));
  }, []);

  const handleM1PreviewChange = useCallback((snapshot) => {
    setM1Preview(snapshot);
  }, []);

  const handleMonitoringChange = useCallback((next) => {
    setMonitorState((prev) => {
      if (
        prev.monitoring === next.monitoring &&
        prev.busy === next.busy &&
        prev.lastAnalysisAt === next.lastResult?.visionAt
      ) {
        return prev;
      }
      return {
        monitoring: next.monitoring,
        busy: next.busy,
        lastAnalysisAt: next.lastResult?.visionAt || null,
      };
    });
  }, []);

  const startResize = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = panelWidth;
    let latestWidth = startWidth;
    setResizing(true);

    const onMove = (moveEvent) => {
      const next = Math.min(640, Math.max(300, startWidth - (moveEvent.clientX - startX)));
      latestWidth = next;
      setPanelWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      try {
        localStorage.setItem(PANEL_STORAGE_KEY, String(latestWidth));
      } catch (_) {}
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const canUseNativeControls = nativeAvailable && Boolean(status?.url);
  const electronConnected = isElectronRuntime();
  const connectionLabel = status?.brokerId === brokerId
    ? brokerConnectionLabel(status)
    : 'BELUM DIBUKA';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#030814',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(0,229,255,0.18)',
          background: 'linear-gradient(90deg, #050b16 0%, #071224 60%, #06101f 100%)',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/simulator')}
          style={{ ...controlBtn, color: '#67e8f9', borderColor: 'rgba(0,229,255,0.35)' }}
        >
          ← SIMULATOR
        </button>
        <button
          type="button"
          onClick={() => navigate('/platform-trader')}
          style={{ ...controlBtn, color: '#c084fc', borderColor: 'rgba(192,132,252,0.35)' }}
          title="Kembali ke Platform Trader"
        >
          ← PLATFORM TRADER
        </button>

        <div style={{ minWidth: 170 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', color: '#67e8f9' }}>
            BROKER WORKSPACE
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
            Platform trading asli broker + JINI analyst
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: '#64748b', fontWeight: 800 }}>BROKER</span>
          <select
            value={brokerId}
            onChange={(event) => handleBrokerChange(event.target.value)}
            style={{
              background: '#06101f',
              border: '1px solid rgba(0,229,255,0.3)',
              borderRadius: 5,
              color: '#e2e8f0',
              fontSize: 10.5,
              fontWeight: 700,
              padding: '5px 7px',
            }}
          >
            {brokers.map((broker) => (
              <option key={broker.id} value={broker.id} disabled={!broker.enabled}>
                {broker.name}{broker.enabled ? '' : ' (belum aktif)'}
              </option>
            ))}
          </select>
        </div>

        {selectedBroker?.platforms?.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#64748b', fontWeight: 800 }}>PLATFORM</span>
            <select
              value={platformId}
              onChange={(event) => handlePlatformChange(event.target.value)}
              style={{
                background: '#06101f',
                border: '1px solid rgba(0,229,255,0.3)',
                borderRadius: 5,
                color: '#e2e8f0',
                fontSize: 10.5,
                fontWeight: 700,
                padding: '5px 7px',
              }}
            >
              {selectedBroker.platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.label}</option>
              ))}
            </select>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 9px',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 999,
            background: 'rgba(2,6,23,0.6)',
            maxWidth: 330,
          }}
          title={connectionLabel}
        >
          <StatusDot status={status} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: status?.error ? '#fda4af' : '#cbd5e1',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {connectionLabel}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 9px',
            border: `1px solid ${monitorState.monitoring ? 'rgba(52,211,153,0.5)' : 'rgba(148,163,184,0.2)'}`,
            borderRadius: 999,
            background: monitorState.monitoring ? 'rgba(16,185,129,0.12)' : 'rgba(2,6,23,0.6)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: monitorState.monitoring ? '#34d399' : '#64748b',
              boxShadow: monitorState.monitoring ? '0 0 8px #34d399' : 'none',
            }}
          />
          <span style={{ fontSize: 9, fontWeight: 800, color: monitorState.monitoring ? '#6ee7b7' : '#94a3b8' }}>
            JINI {monitorState.monitoring ? (monitorState.busy ? 'ANALYZING' : 'MONITORING') : 'STANDBY'}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { brokerGoBack().catch(() => {}); }}
            disabled={!canUseNativeControls || !status?.canGoBack}
            style={{ ...controlBtn, opacity: canUseNativeControls && status?.canGoBack ? 1 : 0.4 }}
            title="Kembali di dalam halaman broker"
          >
            ← BACK
          </button>
          <button
            type="button"
            onClick={() => { brokerGoForward().catch(() => {}); }}
            disabled={!canUseNativeControls || !status?.canGoForward}
            style={{ ...controlBtn, opacity: canUseNativeControls && status?.canGoForward ? 1 : 0.4 }}
            title="Maju di dalam halaman broker"
          >
            FORWARD →
          </button>
          <button
            type="button"
            onClick={handleReload}
            disabled={!canUseNativeControls}
            style={{ ...controlBtn, opacity: canUseNativeControls ? 1 : 0.4 }}
          >
            RELOAD
          </button>
          <button
            type="button"
            onClick={handleLogin}
            disabled={!nativeAvailable}
            style={{ ...controlBtn, color: '#67e8f9', borderColor: 'rgba(0,229,255,0.35)', opacity: nativeAvailable ? 1 : 0.4 }}
            title="Muat halaman login resmi XM"
          >
            LOGIN XM
          </button>
          <button
            type="button"
            onClick={handleClearSession}
            disabled={!canUseNativeControls}
            style={{ ...controlBtn, color: '#fda4af', borderColor: 'rgba(251,113,133,0.4)', opacity: canUseNativeControls ? 1 : 0.4 }}
            title="Hapus cookies/sesi login broker di workspace ini"
          >
            LOGOUT
          </button>
          <button
            type="button"
            onClick={() => handleOpenExternal(selectedBroker, selectedPlatform)}
            style={{ ...controlBtn, color: '#67e8f9', borderColor: 'rgba(0,229,255,0.35)' }}
            title="Buka terminal resmi di browser Anda"
          >
            OPEN BROWSER
          </button>
          {!electronConnected && (
            <button
              type="button"
              onClick={() => handleRequestDesktopApp(selectedBroker, selectedPlatform)}
              style={{
                ...controlBtn,
                background: 'linear-gradient(90deg, rgba(0,229,255,0.22), rgba(16,185,129,0.18))',
                color: '#38bdf8',
                borderColor: 'rgba(0,229,255,0.5)',
                boxShadow: '0 0 10px rgba(0,229,255,0.15)',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Luncurkan aplikasi UltimateAI Desktop untuk operasi terminal asli broker via ultimateai://"
            >
              <span>🖥️</span>
              <span>OPERASI KE DESKTOP</span>
            </button>
          )}
        </div>
      </header>

      {status?.fatalError && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 10.5,
            color: '#fda4af',
            background: 'rgba(80,7,20,0.4)',
            borderBottom: '1px solid rgba(251,113,133,0.35)',
            lineHeight: 1.55,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ color: '#fb7185', letterSpacing: '0.04em' }}>KONEKSI XM GAGAL</strong>
            <span style={{ color: '#fecdd3' }}>{status.error}</span>
            {status.errorCode != null && (
              <span style={{ color: '#94a3b8' }}>kode {status.errorCode}</span>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" onClick={handleLogin} style={{ ...controlBtn, color: '#67e8f9' }}>
              COBA LOGIN ULANG
            </button>
            <button type="button" onClick={handleReload} style={{ ...controlBtn }}>
              RETRY
            </button>
            <button
              type="button"
              onClick={() => handleOpenExternal(selectedBroker, selectedPlatform)}
              style={{ ...controlBtn }}
            >
              BROWSER RESMI
            </button>
          </div>
          <div style={{ marginTop: 3, color: '#fecdd3' }}>{brokerErrorHint(status)}</div>
        </div>
      )}

      {!status?.fatalError && status?.chartNoData && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 10,
            color: '#fbbf24',
            background: 'rgba(120,53,15,0.28)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
            lineHeight: 1.55,
          }}
        >
          <strong>CHART XM: NO DATA HERE.</strong> {brokerErrorHint(status)}
        </div>
      )}

      {selectedBroker && !selectedBroker.enabled && (
        <div
          style={{
            padding: '7px 12px',
            fontSize: 10.5,
            color: '#fbbf24',
            background: 'rgba(120,53,15,0.25)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          {selectedBroker.name}: {selectedBroker.note}
        </div>
      )}

      {!electronConnected && (
        <div
          style={{
            padding: '7px 14px',
            fontSize: 11,
            color: '#38bdf8',
            background: 'linear-gradient(90deg, rgba(2, 28, 54, 0.88) 0%, rgba(6, 18, 38, 0.92) 100%)',
            borderBottom: '1px solid rgba(0, 229, 255, 0.35)',
            lineHeight: 1.55,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: 260 }}>
            <strong style={{ color: '#00e5ff', letterSpacing: '0.04em' }}>MODE LIVE WEB AKTIF:</strong>{' '}
            <span style={{ color: '#cbd5e1' }}>
              Analitik pasar & JINI AI aktif di web. <strong>Operasi kerja terminal broker resmi, login akun, dan eksekusi MT5 tetap lari ke Desktop</strong> (Electron WebContentsView) demi keamanan akun riil & latensi instan.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRequestDesktopApp(selectedBroker, selectedPlatform)}
            style={{
              padding: '4px 12px',
              borderRadius: 5,
              border: '1px solid #00e5ff',
              background: 'linear-gradient(90deg, rgba(0,229,255,0.25), rgba(16,185,129,0.2))',
              color: '#f8fafc',
              fontSize: 10,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 0 10px rgba(0,229,255,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🖥️</span>
            <span>BUKA DI APLIKASI DESKTOP (HANDOFF)</span>
          </button>
        </div>
      )}

      <div className="broker-workspace-body" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        <div
          ref={chartColumnRef}
          className="broker-chart-column"
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              flex: '0 0 auto',
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <BrokerViewport
              broker={selectedBroker}
              platform={selectedPlatform}
              status={status}
              suspended={resizing || Boolean(status?.fatalError)}
              onNativeAvailability={setNativeAvailable}
              onOpenExternal={handleOpenExternal}
              onRequestDesktopApp={handleRequestDesktopApp}
              onViewportError={handleViewportError}
            />
          </div>
          <M1LevelPreviewPanel data={m1Preview} />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startResize}
          style={{
            width: 6,
            flexShrink: 0,
            cursor: 'col-resize',
            background: resizing ? 'rgba(0,229,255,0.5)' : 'rgba(0,229,255,0.14)',
            borderLeft: '1px solid rgba(0,229,255,0.2)',
            borderRight: '1px solid rgba(0,229,255,0.2)',
            transition: resizing ? 'none' : 'background 0.15s ease',
          }}
          title="Tarik untuk mengatur lebar panel JINI"
        />

        <aside
          className="broker-jini-panel"
          style={{
            width: `min(${panelWidth}px, 55vw)`,
            flexShrink: 0,
            minWidth: 300,
            height: '100%',
            background: '#050b16',
            borderLeft: '1px solid rgba(0,229,255,0.2)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', gap: 4, padding: '8px 10px 0', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setPanelTab('monitor')}
              style={{
                ...controlBtn,
                flex: 1,
                textAlign: 'center',
                color: panelTab === 'monitor' ? '#67e8f9' : '#94a3b8',
                borderColor: panelTab === 'monitor' ? 'rgba(0,229,255,0.5)' : 'rgba(148,163,184,0.2)',
                background: panelTab === 'monitor' ? 'rgba(0,229,255,0.12)' : 'rgba(15,23,42,0.75)',
              }}
            >
              JINI MONITOR
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('supplyDemand')}
              style={{
                ...controlBtn,
                flex: 1,
                textAlign: 'center',
                color: panelTab === 'supplyDemand' ? '#67e8f9' : '#94a3b8',
                borderColor: panelTab === 'supplyDemand' ? 'rgba(0,229,255,0.5)' : 'rgba(148,163,184,0.2)',
                background: panelTab === 'supplyDemand' ? 'rgba(0,229,255,0.12)' : 'rgba(15,23,42,0.75)',
              }}
            >
              S&amp;D ENGINE
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('scalping')}
              style={{
                ...controlBtn,
                flex: 1,
                textAlign: 'center',
                color: panelTab === 'scalping' ? '#67e8f9' : '#94a3b8',
                borderColor: panelTab === 'scalping' ? 'rgba(0,229,255,0.5)' : 'rgba(148,163,184,0.2)',
                background: panelTab === 'scalping' ? 'rgba(0,229,255,0.12)' : 'rgba(15,23,42,0.75)',
              }}
            >
              SCALPING M1
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('goldFactors')}
              style={{
                ...controlBtn,
                flex: '1 1 100%',
                textAlign: 'center',
                color: panelTab === 'goldFactors' ? '#67e8f9' : '#94a3b8',
                borderColor: panelTab === 'goldFactors' ? 'rgba(0,229,255,0.5)' : 'rgba(148,163,184,0.2)',
                background: panelTab === 'goldFactors' ? 'rgba(0,229,255,0.12)' : 'rgba(15,23,42,0.75)',
              }}
            >
              FAKTOR UP/DOWN GOLD
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('orderFlow')}
              style={{
                ...controlBtn,
                flex: '1 1 100%',
                textAlign: 'center',
                color: panelTab === 'orderFlow' ? '#67e8f9' : '#94a3b8',
                borderColor: panelTab === 'orderFlow' ? 'rgba(0,229,255,0.5)' : 'rgba(148,163,184,0.2)',
                background: panelTab === 'orderFlow' ? 'rgba(0,229,255,0.12)' : 'rgba(15,23,42,0.75)',
              }}
            >
              GOLD ORDER FLOW
            </button>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: panelTab === 'monitor' ? 'flex' : 'none',
              flexDirection: 'column',
            }}
          >
            <JiniMonitorPanel
              broker={selectedBroker}
              brokerStatus={status}
              nativeAvailable={nativeAvailable}
              onMonitoringChange={handleMonitoringChange}
            />
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: panelTab === 'supplyDemand' ? 'flex' : 'none',
              flexDirection: 'column',
            }}
          >
            <SupplyDemandEnginePanel symbol="XAUUSD" />
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: panelTab === 'scalping' ? 'flex' : 'none',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <ScalpingM1Panel
              symbol="XAUUSD"
              showPreview={false}
              onPreviewChange={handleM1PreviewChange}
            />
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: panelTab === 'goldFactors' ? 'flex' : 'none',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <FaktorUpDownGoldPanel enabled={panelTab === 'goldFactors'} />
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: panelTab === 'orderFlow' ? 'flex' : 'none',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <JinGoldOrderFlowPanel enabled={panelTab === 'orderFlow'} />
          </div>

          <M1LevelLegend data={m1Preview} />
        </aside>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .broker-workspace-body {
            flex-direction: column !important;
          }
          .broker-jini-panel {
            width: 100% !important;
            max-width: none !important;
            height: 42vh !important;
            border-left: none !important;
            border-top: 1px solid rgba(0,229,255,0.2) !important;
          }
          div[role="separator"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
