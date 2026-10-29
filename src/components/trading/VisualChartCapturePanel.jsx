import React, { useEffect, useRef, useState } from 'react';
import { visualChartCapture } from '../../services/trading/VisualChartCapture.js';
import { localRouterClient } from '../../services/router/LocalRouterClient.js';

const buttonStyle = {
  border: '1px solid #155e75', borderRadius: 5, padding: '6px 9px',
  background: '#071827', color: '#a5f3fc', fontSize: 10, fontWeight: 700,
  cursor: 'pointer',
};
const panelText = { color: '#cbd5e1', fontSize: 10, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };

export default function VisualChartCapturePanel({ instrument, timeframe }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('BELUM AKTIF');
  const [preview, setPreview] = useState('');
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState('');
  const streamCheck = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => () => {
    if (streamCheck.current) clearInterval(streamCheck.current);
    abortRef.current?.abort();
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

  const analyzeFrame = async (captureMeta) => {
    setBusy(true);
    setError('');
    setAnalysis('');
    setStatus('MENGIRIM KE JIN AI…');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // OpenAI-compatible multimodal message. The selected local model/router must
      // support image_url input; a text-only model will return a visible error.
      const messages = [
        {
          role: 'system',
          content: 'Anda adalah JIN Visual Technical Analyst. Analisis hanya informasi yang benar-benar terlihat pada screenshot. Jangan mengarang OHLC, indikator, harga, volume, atau jumlah candle. Bedakan angka yang terbaca dari estimasi visual. Jika screenshot tidak cukup jelas, nyatakan keterbatasannya. Ini analisis visual, bukan sinyal transaksi terjamin.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Baca screenshot chart ini. Instrumen yang dipilih UI: ${captureMeta.instrument}; timeframe UI: ${captureMeta.timeframe}. Identifikasi apakah simbol/timeframe pada chart benar-benar cocok. Berikan: (1) instrumen/timeframe yang terlihat, (2) jumlah candle yang bisa diidentifikasi secara visual dan apakah minimal 50 benar-benar terlihat, (3) tren/struktur, (4) momentum visual, (5) support/resistance hanya jika sumbu harga memungkinkan, (6) angka OHLC hanya jika benar-benar terbaca, (7) confidence dan keterbatasan. Jika gambar adalah dialog screen-share, layar berulang, atau chart tidak terbaca, jangan menganalisis pasar.` },
            { type: 'image_url', image_url: { url: captureMeta.dataUrl, detail: 'high' } }
          ]
        }
      ];
      const textResult = await localRouterClient.streamChat(
        { messages, temperature: 0.1, signal: controller.signal },
        {
          onDelta: (_delta, fullText) => setAnalysis(fullText),
          onError: (err) => setError(err?.message || 'Model vision tidak dapat memproses gambar.')
        }
      );
      if (!textResult?.trim()) throw new Error('Model tidak mengembalikan hasil analisis visual.');
      setAnalysis(textResult);
      setStatus('ANALISIS VISUAL SELESAI');
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setStatus('ANALISIS GAGAL');
        setError(e?.message || 'Gagal menghubungkan screenshot ke model vision JIN.');
      }
    } finally {
      setBusy(false);
    }
  };

  const captureFrame = async () => {
    setError('');
    try {
      const result = visualChartCapture.capture();
      const captureMeta = {
        ...result,
        instrument,
        timeframe,
        source: 'user-authorized-screen-capture',
      };
      setPreview(result.dataUrl);
      setMeta(captureMeta);
      window.dispatchEvent(new CustomEvent('jin:visual-chart-captured', { detail: captureMeta }));
      await analyzeFrame(captureMeta);
    } catch (e) {
      setStatus('CAPTURE GAGAL');
      setError(e?.message || 'Gagal mengambil frame layar.');
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
        <strong style={{ color: '#67e8f9', fontSize: 10, letterSpacing: '.04em' }}>VISUAL CHART CAPTURE → JIN AI</strong>
        <span role="status" style={{ color: status.includes('SELESAI') || status === 'CAPTURE AKTIF' ? '#34d399' : '#fbbf24', fontSize: 9, fontWeight: 800 }}>{status}</span>
      </header>
      <p style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.5, margin: '6px 0 8px' }}>
        Izinkan screen capture. Pilih jendela/tab chart, lalu ambil frame. Gambar akan dikirim ke model melalui Local Router; model harus mendukung input gambar.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!active
          ? <button type="button" style={buttonStyle} onClick={startCapture} disabled={busy}>{busy ? 'MEMULAI…' : 'IZINKAN TANGKAP LAYAR'}</button>
          : <>
              <button type="button" style={buttonStyle} onClick={captureFrame} disabled={busy}>{busy ? 'JIN AI MEMBACA…' : 'AMBIL FRAME & ANALISIS'}</button>
              <button type="button" style={buttonStyle} onClick={stopCapture} disabled={busy}>HENTIKAN</button>
            </>}
      </div>
      {error && <p role="alert" style={{ ...panelText, color: '#fca5a5', margin: '7px 0 0' }}>{error}</p>}
      {meta && <div style={{ color: '#94a3b8', fontSize: 9, marginTop: 8 }}>
        Frame {meta.width}×{meta.height} · {meta.instrument} · {meta.timeframe} · {new Date(meta.capturedAt).toLocaleTimeString()}
      </div>}
      {preview && <details style={{ marginTop: 8 }}><summary style={{ color: '#67e8f9', cursor: 'pointer', fontSize: 10 }}>Pratinjau frame yang dikirim</summary><img src={preview} alt="Frame layar yang ditangkap untuk analisis visual" style={{ display: 'block', width: '100%', maxHeight: 150, objectFit: 'contain', marginTop: 8, background: '#020617', borderRadius: 4 }} /></details>}
      {analysis && <div aria-live="polite" style={{ marginTop: 9, padding: 9, border: '1px solid rgba(34,211,238,.25)', borderRadius: 5, background: '#030b16' }}>
        <strong style={{ display: 'block', color: '#67e8f9', fontSize: 10, marginBottom: 6 }}>HASIL PEMBACAAN VISUAL JIN AI</strong>
        <div style={panelText}>{analysis}</div>
      </div>}
    </section>
  );
}
