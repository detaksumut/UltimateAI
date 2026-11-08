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
          <div style={{ fontSize: 42 }} aria-hidden="true">▣</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#e2e8f0', letterSpacing: '0.04em' }}>
            TERMINAL {broker?.name || 'BROKER'} HANYA TERSEDIA DI APLIKASI DESKTOP
          </div>
          <div style={{ maxWidth: 580, fontSize: 12.5, lineHeight: 1.7, color: '#94a3b8' }}>
            Terminal XM dibuka di dalam UltimateAI Desktop memakai Electron WebContentsView,
            bukan iframe dan bukan tab Edge baru. Halaman web ini tidak dapat menampilkan
            terminal XM dan tidak membuka jendela browser eksternal.
          </div>
          <button
            type="button"
            onClick={handleRequestDesktopApp}
            style={{
              marginTop: 4,
              padding: '10px 18px',
              borderRadius: 7,
              border: '1px solid rgba(0,229,255,0.5)',
              background: 'linear-gradient(90deg, rgba(0,229,255,0.18), rgba(16,185,129,0.14))',
              color: '#67e8f9',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            BUKA DI APLIKASI DESKTOP
          </button>
          {desktopNotice && (
            <div style={{ fontSize: 10.5, color: '#67e8f9', maxWidth: 560, lineHeight: 1.6 }}>
              {desktopNotice}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: '#64748b', maxWidth: 560, lineHeight: 1.6 }}>
            Halaman web tidak dapat mendeteksi apakah aplikasi desktop sudah terpasang atau
            terbuka. Jika tombol di atas tidak menghasilkan respons, jalankan UltimateAI Desktop
            lalu buka Broker Workspace dari aplikasi tersebut. Login tetap dilakukan langsung di
            halaman resmi broker; UltimateAI tidak meminta atau menyimpan password broker.
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
