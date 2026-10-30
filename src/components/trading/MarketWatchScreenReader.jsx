import React, { useRef, useState } from 'react';
import { RouterConfig } from '../../services/router/RouterConfig.js';

const panel = { border: '1px solid #164e63', borderRadius: 7, background: '#06101d', padding: 10, color: '#cbd5e1', minWidth: 0 };
const button = { border: '1px solid #0891b2', borderRadius: 5, padding: '7px 9px', background: '#062333', color: '#67e8f9', fontSize: 10, fontWeight: 800, cursor: 'pointer' };
const numberText = value => value == null || value === '' ? '—' : String(value);

function extractJson(text) {
  const cleaned = String(text || '').replace(/^`{3}(?:json)?/i, '').replace(/`{3}$/,'').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model tidak mengembalikan JSON tabel pasar yang valid.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export default function MarketWatchScreenReader() {
  const inputRef = useRef(null);
  const [image, setImage] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('MENUNGGU SCREENSHOT');
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState('Belum ditentukan');
  const [capturedAt, setCapturedAt] = useState(null);

  const chooseImage = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Pilih file gambar seperti PNG, JPG, atau WEBP.'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('Ukuran screenshot maksimum 12 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(String(reader.result || '')); setFileName(file.name); setError(''); setStatus('SCREENSHOT SIAP DIBACA'); };
    reader.onerror = () => setError('File screenshot gagal dibaca.');
    reader.readAsDataURL(file);
  };

  const readScreenshot = async () => {
    if (!image) { inputRef.current?.click(); return; }
    setBusy(true); setError(''); setStatus('JINI MEMBACA TABEL…');
    try {
      const response = await fetch(RouterConfig.api('/v1/chat/completions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: RouterConfig.DEFAULT_MODEL,
          temperature: 0,
          max_tokens: 3000,
          messages: [
            { role: 'system', content: 'Anda adalah OCR/vision data extractor untuk tabel market watch. Baca hanya teks yang benar-benar terlihat pada screenshot. Balas HANYA JSON valid: {"source":"nama platform atau UNKNOWN","captured_at":null,"columns":["symbol","instrument","bid","ask","spread","change","change_percent"],"rows":[{"symbol":"string","instrument":"string","bid":"string|null","ask":"string|null","spread":"string|null","change":"string|null","change_percent":"string|null","confidence":"HIGH|MEDIUM|LOW"}],"notes":["..."]}. Pertahankan format angka persis seperti terlihat, jangan ubah pemisah desimal/ribuan, jangan menebak data yang tertutup atau tidak jelas; gunakan null. Jangan menambahkan data yang tidak terlihat.' },
            { role: 'user', content: [
              { type: 'text', text: 'Baca tabel harga pasar dalam screenshot ini. Fokus pada baris instrumen dan kolom Bid, Ask, Spread, Perubahan, Perubahan %. Abaikan menu akun, saldo, dan elemen navigasi. Kembalikan JSON sesuai skema.' },
              { type: 'image_url', image_url: { url: image, detail: 'high' } }
            ] }
          ]
        }),
        signal: AbortSignal.timeout(60000),
        cache: 'no-store'
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || body.error || 'Permintaan vision gagal HTTP ' + response.status + '.');
      const content = body.choices?.[0]?.message?.content;
      const textContent = Array.isArray(content) ? content.map(part => part.text || '').join('\n') : content;
      const data = extractJson(textContent);
      if (!Array.isArray(data.rows)) throw new Error('JSON berhasil diterima, tetapi daftar instrumen tidak tersedia.');
      const normalized = data.rows.filter(row => row && row.symbol).map((row, index) => ({
        id: index + '-' + row.symbol,
        symbol: String(row.symbol),
        instrument: row.instrument == null ? '' : String(row.instrument),
        bid: row.bid == null ? null : String(row.bid),
        ask: row.ask == null ? null : String(row.ask),
        spread: row.spread == null ? null : String(row.spread),
        change: row.change == null ? null : String(row.change),
        change_percent: row.change_percent == null ? null : String(row.change_percent),
        confidence: ['HIGH','MEDIUM','LOW'].includes(row.confidence) ? row.confidence : 'LOW'
      }));
      setRows(normalized); setSource(String(data.source || 'UNKNOWN')); setCapturedAt(new Date().toISOString());
      setStatus('TERBACA ' + normalized.length + ' INSTRUMEN');
      if (!normalized.length) setError('Tidak ada baris instrumen yang terverifikasi. Coba screenshot lebih tajam dan pastikan tabel terlihat penuh.');
    } catch (e) {
      setStatus('PEMBACAAN GAGAL');
      setError((e?.message || 'Gagal membaca screenshot.') + ' Pastikan model/router yang dipilih mendukung input gambar (vision).');
    } finally { setBusy(false); }
  };

  return <section style={panel} aria-label="JINI Market Watch Screen Reader">
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <strong style={{ color: '#67e8f9', fontSize: 11, letterSpacing: '.04em' }}>JINI · MARKET WATCH READER</strong>
      <span role="status" style={{ color: status.includes('TERBACA') ? '#34d399' : '#fbbf24', fontSize: 8, textAlign: 'right' }}>{status}</span>
    </header>
    <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 8 }}>Baca screenshot tabel harga dari PrimeXBT atau platform lain. Tidak menggunakan feed MT5.</div>
    <input ref={inputRef} type="file" accept="image/*" onChange={chooseImage} style={{ display: 'none' }} />
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
      <button type="button" style={button} onClick={() => inputRef.current?.click()} disabled={busy}>PILIH SCREENSHOT</button>
      <button type="button" style={{ ...button, opacity: busy ? .6 : 1 }} onClick={readScreenshot} disabled={busy}>{busy ? 'MEMBACA…' : 'BACA DATA PASAR'}</button>
    </div>
    {fileName && <div style={{ color: '#94a3b8', fontSize: 9, marginBottom: 7, overflowWrap: 'anywhere' }}>File: {fileName}</div>}
    {image && <img src={image} alt="Pratinjau screenshot market watch" style={{ display: 'block', width: '100%', maxHeight: 135, objectFit: 'contain', borderRadius: 4, background: '#030812', marginBottom: 8 }} />}
    {error && <div role="alert" style={{ color: '#fca5a5', fontSize: 9, marginBottom: 8, overflowWrap: 'anywhere' }}>{error}</div>}
    {rows.length > 0 && <><div style={{ display: 'flex', justifyContent: 'space-between', gap: 5, color: '#94a3b8', fontSize: 8, marginBottom: 5 }}><span>Sumber: {source}</span><span>{capturedAt ? new Date(capturedAt).toLocaleTimeString() : ''}</span></div>
      <div style={{ overflowX: 'auto', maxHeight: 390, overflowY: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, whiteSpace: 'nowrap' }}><thead><tr>{['Simbol','Bid','Ask','Spread','Perubahan %'].map(label => <th key={label} style={{ position: 'sticky', top: 0, background: '#0b1b2b', color: '#67e8f9', textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid #164e63' }}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><td style={{ padding: '6px 4px', borderBottom: '1px solid #14283a' }}><strong>{row.symbol}</strong><div style={{ color: '#64748b', fontSize: 8 }}>{row.instrument}</div><div style={{ color: row.confidence === 'HIGH' ? '#34d399' : '#fbbf24', fontSize: 7 }}>{row.confidence}</div></td>{[row.bid,row.ask,row.spread,row.change_percent].map((value,i)=><td key={i} style={{ padding: '6px 4px', borderBottom: '1px solid #14283a', color: i === 3 && String(value || '').trim().startsWith('-') ? '#fb7185' : '#e2e8f0' }}>{numberText(value)}</td>)}</tr>)}</tbody></table></div>
    </>}
  </section>;
}
