import React, { useEffect, useRef, useState } from 'react';
import { visualChartCapture } from '../../services/trading/VisualChartCapture.js';
import { localRouterClient } from '../../services/router/LocalRouterClient.js';

const btn = { border: '1px solid #155e75', borderRadius: 4, padding: '5px 7px', background: '#071827', color: '#a5f3fc', fontSize: 9, fontWeight: 700, cursor: 'pointer' };

export default function VisualChartCapturePanel({ instrument, timeframe, onTimeframeChange }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('CAPTURE NONAKTIF');
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    visualChartCapture.stop();
  }, []);

  const start = async () => {
    setError(''); setBusy(true);
    try {
      await visualChartCapture.start();
      setActive(true); setStatus('SIAP AMBIL DATA VISUAL');
      timer.current = setInterval(() => {
        if (!visualChartCapture.active) {
          setActive(false); setStatus('CAPTURE TERPUTUS');
          clearInterval(timer.current);
        }
      }, 1000);
    } catch (e) {
      setStatus('CAPTURE GAGAL'); setError(e?.message || 'Izin tangkap layar gagal.');
    } finally { setBusy(false); }
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const captureAndAnalyze = async (targetTimeframe = timeframe, manageBusy = true) => {
    window.dispatchEvent(new CustomEvent('jin:signal-clear'));
    setBusy(true); setError(''); setStatus('MEMBACA GRAFIK…');
    try {
      const frame = visualChartCapture.capture({ maxWidth: 2200, quality: 0.95 });
      const messages = [
        { role: 'system', content: 'You are a chart-vision data extractor. Return ONLY valid JSON, no markdown. Never invent unreadable numeric values. Output schema: {"instrument":"string","timeframe":"string","symbol_match":true,"timeframe_match":true,"visible_candles":0,"ohlc_readable":false,"last_price":null,"open":null,"high":null,"low":null,"close":null,"trend":"BULLISH|BEARISH|SIDEWAYS|UNKNOWN","momentum":"BULLISH|BEARISH|NEUTRAL|UNKNOWN","support":null,"resistance":null,"volatility":"LOW|NORMAL|HIGH|UNKNOWN","scenario":"BUY_BIAS|SELL_BIAS|WAIT","confidence":0,"data_quality":"GOOD|PARTIAL|POOR","note":"short reason"}. Numeric prices must be numbers or null. If screenshot shows a recursive screen-share dialog, mark data_quality POOR and scenario WAIT.' },
        { role: 'user', content: [
          { type: 'text', text: `Extract chart data from screenshot. UI instrument=${instrument}, requested timeframe=${targetTimeframe}. The visible chart must itself confirm this timeframe; do not assume it. Count visible candles conservatively. Return only specified JSON. Do not invent OHLC from pixels if price axis does not support exact values.` },
          { type: 'image_url', image_url: { url: frame.dataUrl, detail: 'high' } }
        ]}
      ];
      const raw = await localRouterClient.streamChat({ messages, temperature: 0.0 }, { onError: e => setError(e?.message || 'Vision request failed.') });
      const match = String(raw || '').match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Model tidak mengembalikan JSON data visual. Router/model harus mendukung input gambar.');
      let data;
      try { data = JSON.parse(match[0]); } catch { throw new Error('Respons vision bukan JSON valid.'); }
      ['last_price','open','high','low','close','support','resistance'].forEach(k => { if (!Number.isFinite(data[k])) data[k] = null; });
      data.confidence = Number.isFinite(Number(data.confidence)) ? Math.max(0, Math.min(100, Number(data.confidence))) : 0;
      data.visible_candles = Number.isFinite(Number(data.visible_candles)) ? Math.max(0, Number(data.visible_candles)) : 0;
      const observedInstrument = String(data.instrument || '').trim().toUpperCase();
      const observedTimeframe = String(data.timeframe || '').trim().toUpperCase();
      const normalizeTf = value => ({ '1':'M1','1M':'M1','5':'M5','5M':'M5','15':'M15','15M':'M15','30':'M30','30M':'M30','60':'H1','1H':'H1','H1':'H1','240':'H4','4H':'H4','H4':'H4','D':'D1','1D':'D1','D1':'D1' })[value] || value;
      data.observedInstrument = observedInstrument || null;
      data.observedTimeframe = observedTimeframe || null;
      data.requestedInstrument = instrument;
      data.requestedTimeframe = targetTimeframe;
      data.symbol_match = Boolean(observedInstrument && (observedInstrument === instrument.toUpperCase() || observedInstrument.includes(instrument.toUpperCase())));
      data.timeframe_match = Boolean(observedTimeframe && normalizeTf(observedTimeframe) === normalizeTf(targetTimeframe));
      // Keep requested context separate from what vision actually read; never overwrite evidence.
      data.instrument = observedInstrument || instrument;
      data.timeframe = observedTimeframe || targetTimeframe;
      data.capturedAt = frame.capturedAt;
      data.dataStatus = data.data_quality === 'POOR' ? 'VISUAL_POOR' : !data.symbol_match || !data.timeframe_match ? 'VISUAL_MISMATCH' : data.visible_candles < 50 ? 'VISUAL_INSUFFICIENT' : 'VISUAL_READY';
      window.dispatchEvent(new CustomEvent('jin:visual-analysis-ready', { detail: data }));
      setStatus(data.dataStatus === 'VISUAL_READY' ? 'DATA MASUK KE AI ANALYST' : data.dataStatus === 'VISUAL_POOR' ? 'GAMBAR TIDAK JELAS' : data.dataStatus === 'VISUAL_MISMATCH' ? 'INSTRUMEN/TIMEFRAME TIDAK COCOK' : 'CANDLE VISUAL < 50');
      return data;
    } catch (e) {
      setStatus('ANALISIS GAGAL'); setError(e?.message || 'Gagal membaca chart.');
      throw e;
    } finally { if (manageBusy) setBusy(false); }
  };

  const captureAllTimeframes = async () => {
    window.dispatchEvent(new CustomEvent('jin:signal-clear'));
    if (!active) {
      setError('Klik IZINKAN CAPTURE terlebih dahulu dan pilih jendela/tab chart yang akan dibaca.');
      return;
    }
    if (typeof onTimeframeChange !== 'function') {
      setError('Kontrol pergantian timeframe belum tersedia.');
      return;
    }
    const plan = [
      { label: 'H4', interval: '240' },
      { label: 'H1', interval: '60' },
      { label: 'M15', interval: '15' },
      { label: 'M5', interval: '5' },
    ];
    setBusy(true);
    setError('');
    const batch = [];
    try {
      for (const item of plan) {
        setStatus('BERPINDAH KE ' + item.label + '…');
        onTimeframeChange(item.interval);
        // Give React/TradingView time to rebuild the widget and render the requested timeframe.
        await sleep(10000);
        setStatus('MEMBACA ' + item.label + '…');
        const result = await captureAndAnalyze(item.label, false);
        if (result) batch.push(result);
      }
      window.dispatchEvent(new CustomEvent('jin:visual-analysis-batch-ready', {
        detail: { instrument, requestedAt: new Date().toISOString(), results: batch }
      }));
      const required = ['H4', 'H1', 'M15', 'M5'];
      const byTf = Object.fromEntries(batch.map(item => [String(item.requestedTimeframe || item.timeframe || '').toUpperCase(), item]));
      const complete = required.every(tf => {
        const item = byTf[tf];
        return item && item.dataStatus === 'VISUAL_READY' && item.symbol_match !== false &&
          item.timeframe_match !== false && Number.isFinite(item.last_price) &&
          ['BULLISH','BEARISH','SIDEWAYS'].includes(item.trend);
      });
      let signal = { side: 'WAIT', entry: null, stopLoss: null, takeProfit: null,
        reason: 'Empat TF belum lengkap, tidak cocok, atau kualitas datanya belum memadai.' };
      if (complete) {
        const h4 = byTf.H4, h1 = byTf.H1, m15 = byTf.M15, m5 = byTf.M5;
        const alignedBull = [h4,h1,m15].every(x => x.trend === 'BULLISH');
        const alignedBear = [h4,h1,m15].every(x => x.trend === 'BEARISH');
        const entry = Number.isFinite(m5.close) ? m5.close : m5.last_price;
        const range = Number.isFinite(m5.high) && Number.isFinite(m5.low) ? Math.abs(m5.high - m5.low) : null;
        const risk = Number.isFinite(range) && range > 0 ? range : null;
        const bullTrigger = m5.trend === 'BULLISH' && m5.momentum === 'BULLISH' && Number.isFinite(entry);
        const bearTrigger = m5.trend === 'BEARISH' && m5.momentum === 'BEARISH' && Number.isFinite(entry);
        if (alignedBull && bullTrigger && risk) {
          signal = { side: 'BUY', entry, stopLoss: entry - risk * 1.5, takeProfit: entry + risk * 3,
            reason: 'H4, H1, M15 bullish; tren dan momentum M5 mengonfirmasi.' };
        } else if (alignedBear && bearTrigger && risk) {
          signal = { side: 'SELL', entry, stopLoss: entry + risk * 1.5, takeProfit: entry - risk * 3,
            reason: 'H4, H1, M15 bearish; tren dan momentum M5 mengonfirmasi.' };
        } else {
          signal.reason = 'Pembacaan 4 TF selesai, tetapi konfirmasi arah/entry belum sejalan. Tidak ada entry aktif.';
        }
      }
      signal.instrument = instrument;
      signal.source = 'SCREEN_VISION_4TF';
      signal.createdAt = new Date().toISOString();
      signal.timeframes = byTf;
      window.dispatchEvent(new CustomEvent('jin:signal-ready', { detail: signal }));
      setStatus('SELESAI ' + batch.length + '/4 TIMEFRAME · SINYAL ' + signal.side);
    } catch (e) {
      setError(e?.message || 'Perekaman multi-timeframe gagal.');
      setStatus('BATCH TERHENTI');
    } finally { setBusy(false); }
  };

  return <section style={{ border: '1px solid rgba(34,211,238,.2)', borderRadius: 5, padding: 6, marginBottom: 7, background: 'rgba(8,20,35,.65)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
      <span style={{ color: '#67e8f9', fontSize: 9, fontWeight: 800 }}>SCREEN → DATA → AI ANALYST</span>
      <span role="status" style={{ color: status.includes('MASUK') ? '#34d399' : '#fbbf24', fontSize: 8 }}>{status}</span>
    </div>
    <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
      {!active ? <button style={btn} onClick={start} disabled={busy}>{busy ? 'MEMULAI…' : 'IZINKAN CAPTURE'}</button> : <>
        <button style={btn} onClick={captureAndAnalyze} disabled={busy}>{busy ? 'MEMBACA…' : 'AMBIL DATA & ANALISIS'}</button>
        <button style={btn} onClick={captureAllTimeframes} disabled={busy}>{busy ? 'REKAM 4 TF…' : 'REKAM 4 TF (H4→H1→M15→M5)'}</button>
        <button style={btn} onClick={() => { visualChartCapture.stop(); setActive(false); setStatus('CAPTURE DIHENTIKAN'); if (timer.current) clearInterval(timer.current); }} disabled={busy}>STOP</button>
      </>}
    </div>
    {error && <div role="alert" style={{ color: '#fca5a5', fontSize: 9, marginTop: 5 }}>{error}</div>}
  </section>;
}
