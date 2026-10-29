import React, { useState } from 'react';
import { localRouterClient } from '../../services/router/LocalRouterClient.js';
import { RouterConfig } from '../../services/router/RouterConfig.js';

const SOURCES = [
  { key: 'fed', label: 'Federal Reserve / FOMC' },
  { key: 'bls', label: 'BLS / CPI & Employment' },
  { key: 'bea', label: 'BEA / PCE & GDP' },
  { key: 'treasury', label: 'US Treasury / Yields' },
  { key: 'cftc', label: 'CFTC / COT' },
];
const card = { background: '#071321', border: '1px solid #164e63', borderRadius: 7, padding: 10, minWidth: 0 };
const muted = { color: '#94a3b8', fontSize: 11, lineHeight: 1.6 };
const button = { border: '1px solid #0891b2', borderRadius: 5, background: '#082334', color: '#a5f3fc', padding: '8px 11px', fontSize: 10, fontWeight: 800, cursor: 'pointer' };

function safeJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI tidak mengembalikan struktur analisis yang dapat dibaca.');
  return JSON.parse(match[0]);
}

export default function FundamentalResearchPanel({ instrument = 'XAUUSD' }) {
  const [selected, setSelected] = useState(['fed', 'bls', 'bea', 'treasury']);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('BELUM DIBACA');
  const [sources, setSources] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const readAndAnalyze = async () => {
    setBusy(true); setError(''); setReport(null); setStatus('MEMBACA WEBSITE RESMI…');
    try {
      const endpoint = String(RouterConfig.getEndpoint()).replace(/\/+$/, '');
      const response = await fetch(endpoint + '/api/trading/fundamental-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: selected }),
        signal: AbortSignal.timeout(45000),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Endpoint pembaca website tidak tersedia.');
      const readSources = Array.isArray(payload.sources) ? payload.sources : [];
      setSources(readSources);
      const readable = readSources.filter(s => s.status === 'READ' && s.content);
      if (!readable.length) throw new Error('Tidak ada isi website yang berhasil dibaca. Pastikan Local Router terbaru berjalan dan sumber dapat diakses.');
      setStatus('AI MENGANALISIS BUKTI WEBSITE…');
      const evidence = readable.map(s => ({
        source: s.label, url: s.url, fetchedAt: s.fetchedAt,
        content: String(s.content).slice(0, 12000),
      }));
      const prompt = [
        'Analisis fundamental XAUUSD hanya dari bukti halaman web yang disediakan.',
        'Jangan gunakan pengetahuan ingatan untuk menyatakan kondisi terkini. Jangan mengarang angka actual/consensus/previous, tanggal rilis, headline, atau dampak.',
        'Pisahkan fakta yang benar-benar ditemukan, interpretasi, dan hal yang belum tersedia. Website jadwal bukan bukti bahwa rilis sudah terjadi.',
        'Balas JSON valid saja dengan schema: {"overallBias":"BULLISH_GOLD|BEARISH_GOLD|MIXED|INSUFFICIENT_EVIDENCE","confidence":0,"summary":"...","fedImpact":"...","inflationJobs":"...","yieldsUsd":"...","goldDrivers":"...","risks":["..."],"facts":[{"topic":"...","fact":"...","publishedAt":"...","impact":"BULLISH_GOLD|BEARISH_GOLD|MIXED|UNKNOWN","sourceLabel":"...","sourceUrl":"..."}],"missing":["..."],"asOf":"ISO timestamp"}.',
        'Confidence 0-100 harus mencerminkan bukti, bukan kepastian prediksi. Jika bukti tidak mendukung arah, overallBias=INSUFFICIENT_EVIDENCE.',
        'Instrumen: ' + instrument + '. Waktu pengambilan: ' + new Date().toISOString(),
        'BUKTI WEBSITE:\n' + JSON.stringify(evidence),
      ].join('\n\n');
      const raw = await localRouterClient.streamChat({
        messages: [
          { role: 'system', content: 'Anda adalah analis fundamental makro yang disiplin terhadap sumber. Hanya gunakan bukti yang diberikan, jangan pernah mengarang fakta terkini. Output JSON valid tanpa markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      });
      const parsed = safeJson(raw);
      setReport({ ...parsed, analyzedAt: new Date().toISOString(), sourceCount: readable.length });
      setStatus('ANALISIS SELESAI · ' + readable.length + ' SUMBER DIBACA');
    } catch (e) {
      setError(e?.message || 'Pembacaan sumber fundamental gagal.');
      setStatus('GAGAL / BELUM TERVERIFIKASI');
    } finally { setBusy(false); }
  };

  const biasColor = report?.overallBias === 'BULLISH_GOLD' ? '#34d399' : report?.overallBias === 'BEARISH_GOLD' ? '#fb7185' : '#fbbf24';
  return <section style={{ color: '#dbeafe', display: 'grid', gap: 10 }}>
    <header style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div><div style={{ color: '#67e8f9', fontSize: 13, fontWeight: 900 }}>JIN GOLD FUNDAMENTAL INTELLIGENCE</div><div style={muted}>AI wajib membaca isi halaman sumber sebelum menyimpulkan. Instrumen: {instrument}.</div></div>
      <button type="button" style={button} onClick={readAndAnalyze} disabled={busy}>{busy ? 'MEMPROSES…' : '↻ BACA WEBSITE & ANALISIS'}</button>
    </header>
    <div style={{ ...card }}>
      <div style={{ color: '#7dd3fc', fontWeight: 900, fontSize: 10, marginBottom: 8 }}>PILIH SUMBER YANG AKAN DIBACA</div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{SOURCES.map(s => <label key={s.key} style={{ ...muted, display: 'flex', gap: 5, alignItems: 'center', border: '1px solid #20394c', borderRadius: 5, padding: '6px 8px' }}><input type="checkbox" checked={selected.includes(s.key)} onChange={e => setSelected(old => e.target.checked ? [...old, s.key] : old.filter(k => k !== s.key))} />{s.label}</label>)}</div>
      <div style={{ ...muted, marginTop: 7 }}>Website dibaca melalui Local Router; browser tidak sekadar mengirim URL kepada model. Jika isi halaman gagal diambil, sumber ditandai tidak tersedia.</div>
    </div>
    <div style={{ ...card, borderColor: report ? '#047857' : '#92400e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><strong style={{ color: report ? '#34d399' : '#fbbf24', fontSize: 10 }}>{status}</strong><span style={muted}>{report?.analyzedAt ? new Date(report.analyzedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'Belum ada hasil terverifikasi'}</span></div>
      {error && <div role="alert" style={{ color: '#fca5a5', marginTop: 8, fontSize: 11 }}>{error}</div>}
      {report && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 9 }}>
          {[
            ['BIAS FUNDAMENTAL', report.overallBias || 'INSUFFICIENT_EVIDENCE', biasColor],
            ['CONFIDENCE', Number.isFinite(Number(report.confidence)) ? Math.max(0, Math.min(100, Number(report.confidence))) + '%' : '—', '#7dd3fc'],
            ['SUMBER DIBACA', String(report.sourceCount), '#7dd3fc'],
          ].map(([label, value, color]) => <div key={label} style={card}><div style={{ ...muted, fontSize: 9 }}>{label}</div><div style={{ color, fontSize: 15, fontWeight: 900, marginTop: 5, overflowWrap: 'anywhere' }}>{value}</div></div>)}
        </div>
        <div style={{ ...card, marginTop: 9 }}><div style={{ color: '#67e8f9', fontWeight: 900, fontSize: 10 }}>KESIMPULAN AI</div><p style={{ ...muted, color: '#dbeafe' }}>{report.summary || 'Kesimpulan belum tersedia.'}</p><div style={muted}>Fed: {report.fedImpact || 'Belum ditemukan.'}</div><div style={muted}>Inflasi & pekerjaan: {report.inflationJobs || 'Belum ditemukan.'}</div><div style={muted}>USD & yield: {report.yieldsUsd || 'Belum ditemukan.'}</div><div style={muted}>Faktor emas: {report.goldDrivers || 'Belum ditemukan.'}</div></div>
        <div style={{ ...card, marginTop: 9 }}><div style={{ color: '#7dd3fc', fontWeight: 900, fontSize: 10 }}>FAKTA DAN SUMBER YANG DITEMUKAN</div>{(report.facts || []).length ? report.facts.map((f, i) => <div key={i} style={{ borderTop: '1px solid #19364b', paddingTop: 8, marginTop: 8 }}><div style={{ fontWeight: 800, fontSize: 11 }}>{f.topic || 'Fakta'}</div><div style={muted}>{f.fact || 'Isi tidak tersedia'}</div><div style={muted}>Publikasi: {f.publishedAt || 'Tidak ditemukan'} · Dampak: {f.impact || 'UNKNOWN'}</div>{f.sourceUrl && <a href={f.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#67e8f9', fontSize: 10 }}>Buka sumber ↗</a>}</div>) : <p style={muted}>AI tidak menemukan fakta spesifik yang cukup kuat untuk dilaporkan.</p>}</div>
        {!!(report.risks || []).length && <div style={{ ...card, marginTop: 9 }}><div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 10 }}>RISIKO / KETERBATASAN</div><ul style={muted}>{report.risks.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
        {!!(report.missing || []).length && <div style={{ ...card, marginTop: 9 }}><div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 10 }}>DATA BELUM DITEMUKAN</div><ul style={muted}>{report.missing.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
      </>}
    </div>
    {!!sources.length && <div style={{ ...card }}><div style={{ color: '#7dd3fc', fontSize: 10, fontWeight: 900, marginBottom: 7 }}>STATUS PEMBACAAN WEBSITE</div>{sources.map(s => <div key={s.key} style={{ borderTop: '1px solid #19364b', padding: '7px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 10 }}>{s.label}</strong><span style={{ color: s.status === 'READ' ? '#34d399' : '#fbbf24', fontSize: 9 }}>{s.status}</span></div><a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#67e8f9', fontSize: 10 }}>{s.url}</a>{s.error && <div style={{ ...muted, color: '#fca5a5' }}>{s.error}</div>}</div>)}</div>}
    <div style={{ ...muted, fontSize: 10 }}>Catatan: halaman jadwal tidak membuktikan suatu rilis telah terjadi. Actual, consensus, previous, dan dampak hanya ditampilkan bila didukung isi sumber. Ini analisis informasi, bukan instruksi entry otomatis.</div>
  </section>;
}
