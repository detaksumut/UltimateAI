import React, { useEffect, useRef, useState } from 'react';
import {
  isNativeBrokerAvailable,
  openBroker,
  setBrokerBounds,
  hideBroker,
} from '../../services/broker/brokerClient.js';

const panelStyle = {
  position: 'relative',
  flex: '1 1 auto',
  minWidth: 0,
  minHeight: 0,
  background: '#050b16',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
};

const placeholderStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  padding: 28,
  textAlign: 'center',
  background:
    'radial-gradient(circle at 50% 20%, rgba(0,229,255,0.08), transparent 45%), #050b16',
};

function rectFromElement(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
  };
}

export default function BrokerViewport({
  broker,
  platform,
  status,
  suspended = false,
  loginRequestId = 0,
  onNativeAvailability,
  onRequestDesktopApp,
  onViewportError,
}) {
  const containerRef = useRef(null);
  const suspendedRef = useRef(suspended);
  const [native, setNative] = useState(false);
  const [openError, setOpenError] = useState('');
  const [openAttempt, setOpenAttempt] = useState(0);
  const [desktopNotice, setDesktopNotice] = useState('');

  useEffect(() => {
    const available = isNativeBrokerAvailable();
    setNative(available);
    if (typeof onNativeAvailability === 'function') onNativeAvailability(available);
  }, [onNativeAvailability]);

  useEffect(() => {
    if (!native || !loginRequestId) return;
    setOpenAttempt((value) => value + 1);
  }, [native, loginRequestId]);

  const handleRequestDesktopApp = () => {
    if (typeof onRequestDesktopApp !== 'function') {
      setDesktopNotice('Terminal XM hanya tersedia di aplikasi desktop UltimateAI.');
      return;
    }
    const result = onRequestDesktopApp(broker, platform);
    if (result?.ok) {
      setDesktopNotice(
        result.message
          || 'Permintaan handoff ke aplikasi desktop dikirim. Browser tidak dapat memastikan aplikasi sudah terbuka; jika tidak ada respons, jalankan UltimateAI Desktop lalu buka Broker Workspace.',
      );
      return;
    }
    setDesktopNotice(
      result?.message
        || 'Deep link desktop tidak dapat dimulai. Jalankan aplikasi UltimateAI Desktop lalu buka Broker Workspace.',
    );
  };

  useEffect(() => {
    if (!native || !broker?.id || !platform?.id) return undefined;
    let cancelled = false;
    let intervalId = null;
    let observer = null;

    const syncBounds = () => {
      const el = containerRef.current;
      if (!el) return;
      if (suspendedRef.current) {
        hideBroker().catch(() => {});
        return;
      }
      if (el.getBoundingClientRect().width <= 2) return;
      setBrokerBounds(rectFromElement(el)).catch(() => {});
    };

    const start = async () => {
      try {
        await openBroker(broker.id, platform.id);
        if (cancelled) return;
        setOpenError('');
        requestAnimationFrame(syncBounds);
        intervalId = setInterval(syncBounds, 400);
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          observer = new ResizeObserver(syncBounds);
          observer.observe(containerRef.current);
        }
        window.addEventListener('resize', syncBounds);
        window.addEventListener('scroll', syncBounds, true);
      } catch (err) {
        const message = err?.message || 'Gagal membuka terminal broker.';
        if (!cancelled) {
          setOpenError(message);
          if (typeof onViewportError === 'function') onViewportError(message);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('scroll', syncBounds, true);
      hideBroker().catch(() => {});
    };
  }, [native, broker?.id, platform?.id, onViewportError, openAttempt]);

  useEffect(() => {
    suspendedRef.current = suspended;
    if (!native) return undefined;
    if (suspended) {
      hideBroker().catch(() => {});
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().width <= 2) return;
      setBrokerBounds(rectFromElement(el)).catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [suspended, native]);

  return (
    <section ref={containerRef} style={panelStyle} aria-label="Terminal trading asli broker">
      {!native && (
        <div style={placeholderStyle}>
          <div style={{ fontSize: 44, color: '#38bdf8' }} aria-hidden="true">🏛️</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#e2e8f0', letterSpacing: '0.04em' }}>
            TERMINAL {broker?.name || 'BROKER'} (MODE LIVE WEB) — OPERASI KERJA LARI KE DESKTOP
          </div>
          <div style={{ maxWidth: 620, fontSize: 12.5, lineHeight: 1.7, color: '#94a3b8' }}>
            Anda sedang membuka Broker Workspace di live web. Analisis JINI, Multi-Timeframe,
            Supply Demand, dan Gold Order Flow aktif memantau pasar.
            Namun untuk <strong>keamanan sesi broker, kredensial login, dan eksekusi MT5 berlatensi rendah</strong>,
            seluruh operasi kerja terminal asli broker tetap dilimpahkan langsung ke <strong>UltimateAI Desktop</strong>{' '}
            (Electron WebContentsView terisolasi).
          </div>
          <button
            type="button"
            onClick={handleRequestDesktopApp}
            style={{
              marginTop: 4,
              padding: '11px 22px',
              borderRadius: 8,
              border: '1px solid rgba(0,229,255,0.6)',
              background: 'linear-gradient(90deg, rgba(0,229,255,0.25), rgba(16,185,129,0.2))',
              color: '#38bdf8',
              fontSize: 12.5,
              fontWeight: 900,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(0,229,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>🖥️</span>
            <span>BUKA DI APLIKASI DESKTOP (HANDOFF)</span>
          </button>
          {desktopNotice && (
            <div style={{ fontSize: 11, color: '#67e8f9', maxWidth: 580, lineHeight: 1.6, background: 'rgba(0,229,255,0.1)', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,229,255,0.2)' }}>
              {desktopNotice}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: '#64748b', maxWidth: 580, lineHeight: 1.6 }}>
            Protokol <code style={{ color: '#fde68a' }}>ultimateai://broker/open</code> akan membuka atau memfokuskan
            aplikasi Desktop. Jika aplikasi desktop belum berjalan, buka UltimateAI Desktop atau jalankan{' '}
            <code style={{ color: '#93c5fd' }}>npm run dev:desktop</code> di komputer Anda.
          </div>
        </div>
      )}

      {native && (
        <div style={{ ...placeholderStyle, pointerEvents: 'none' }}>
          {openError || status?.fatalError ? (
            <>
              <div style={{ fontSize: 30 }} aria-hidden="true">{'\u26A0'}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fca5a5' }}>KONEKSI TERMINAL XM GAGAL</div>
              <div style={{ fontSize: 12, color: '#fda4af', maxWidth: 560, lineHeight: 1.6 }}>
                {openError || status?.error || 'Terminal broker tidak dapat dimuat.'}
              </div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', maxWidth: 560, lineHeight: 1.6 }}>
                Gunakan tombol COBA LOGIN ULANG / RETRY di header. UltimateAI tidak mematikan verifikasi
                TLS dan tidak mengubah halaman XM.
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '2px solid rgba(0,229,255,0.25)',
                  borderTopColor: '#00e5ff',
                  animation: 'broker-spin 0.9s linear infinite',
                }}
                aria-hidden="true"
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#67e8f9', letterSpacing: '0.06em' }}>
                MEMUAT {platform?.label || broker?.name || 'TERMINAL BROKER'}...
              </div>
              <div style={{ fontSize: 11, color: '#64748b', maxWidth: 520, lineHeight: 1.6 }}>
                {status?.loginRequired
                  ? 'Silakan login langsung di halaman resmi broker yang tampil.'
                  : 'Platform asli broker sedang dimuat di sesi terisolasi.'}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes broker-spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
