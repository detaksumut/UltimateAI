import React, { useEffect, useRef, useState } from 'react';
import { visualChartCapture } from '../../services/trading/VisualChartCapture.js';

const buttonStyle = {
  border: '1px solid #155e75', borderRadius: 5, padding: '6px 9px',
  background: '#071827', color: '#a5f3fc', fontSize: 10, fontWeight: 700,
  cursor: 'pointer',
};

export default function VisualChartCapturePanel({ instrument, timeframe }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('BELUM AKTIF');
  const [preview, setPreview] = useState('');
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const streamCheck = useRef(null);

  useEffect(() => () => {
    if (streamCheck.current) clearInterval(streamCheck.current);
    visualChartCapture.stop();
  }, []);

  const startCapture = async () => {
    setError('');
    setBusy(true);
    try {
      await visualChartCapture.start();
      setActive(true);
      setStatus('CAPTURE AKTIF');
      streamCheck.current = setInterval(() => {
        if (!visualChartCapture.active) {
          setActive(false);
          setStatus('CAPTURE TERPUTUS');
          if (streamCheck.current) clearInterval(streamCheck.current);
        }
      }, 1000);
    } catch (e) {
      setStatus('CAPTURE GAGAL');
      setError(e?.message || 'Izin tangkap layar gagal.');
    } finally {
      setBusy(false);
    }
  };

  const captureFrame = () => {
    setError('');
    setBusy(true);
    try {
      const result = visualChartCapture.capture();
      setPreview(result.dataUrl);
      const captureMeta = {
        ...result,
        instrument,
        timeframe,
        source: 'user-authorized-screen-capture',
      };
      setMeta(captureMeta);
      setStatus('FRAME TERTANGKAP');
      // Integration event for the visual-analysis pipeline; carries a real image,
      // not fabricated OHLC values. Consumers may subscribe to this event.
      window.dispatchEvent(new CustomEvent('jin:visual-chart-captured', {
        detail: captureMeta,
      }));
    } catch (e) {
      setStatus('CAPTURE GAGAL');
      setError(e?.message || 'Gagal mengambil frame layar.');
    } finally {
      setBusy(false);
    }
  };

  const stopCapture = () => {
    visualChartCapture.stop();
    setActive(false);
    setStatus('CAPTURE DIHENTIKAN');
    if (streamCheck.current) clearInterval(streamCheck.current);
  };

  return (
    <section style={{ border: '1px solid rgba(34,211,238,.25)', borderRadius: 6, padding: 9, marginBottom: 10, background: 'rgba(8,20,35,.8)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ color: '#67e8f9', fontSize: 10, letterSpacing: '.04em' }}>VISUAL CHART CAPTURE</strong>
        <span role="status" style={{ color: active ? '#34d399' : '#fbbf24', fontSize: 9, fontWeight: 800 }}>{status}</span>
      </header>
      <p style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.5, margin: '6px 0 8px' }}>
        Izinkan browser menangkap tab/window yang berisi chart. Pilih tab Trading Studio atau jendela chart, lalu ambil frame untuk dikirim ke pipeline visual JINI.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!active
          ? <button type="button" style={buttonStyle} onClick={startCapture} disabled={busy}>{busy ? 'MEMULAI…' : 'IZINKAN TANGKAP LAYAR'}</button>
          : <>
              <button type="button" style={buttonStyle} onClick={captureFrame} disabled={busy}>{busy ? 'MENGAMBIL…' : 'AMBIL FRAME'}</button>
              <button type="button" style={buttonStyle} onClick={stopCapture}>HENTIKAN</button>
            </>}
      </div>
      {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 10, margin: '7px 0 0' }}>{error}</p>}
      {meta && <div style={{ color: '#94a3b8', fontSize: 9, marginTop: 8 }}>
        {meta.width}×{meta.height} · {meta.instrument} · {meta.timeframe} · {new Date(meta.capturedAt).toLocaleTimeString()}
      </div>}
      {preview && <img src={preview} alt="Frame layar yang ditangkap untuk analisis visual" style={{ display: 'block', width: '100%', maxHeight: 150, objectFit: 'contain', marginTop: 8, background: '#020617', borderRadius: 4 }} />}
    </section>
  );
}
