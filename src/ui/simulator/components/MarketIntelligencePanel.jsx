/**
 * MarketIntelligencePanel.jsx — MIE v1 Tahap 1 (part 1/2: service + list)
 * SATU FUNGSI panel kiri: klik MARKET -> live + teknikal real + macro manual.
 * Voice: "Mama Jin, analisis IHSG" -> window.__jinMarketAnalyze('IHSG').
 */
import { useCallback, useEffect, useState } from 'react';
import { getMarketAnalysis, getMacroSnapshot, saveMacroSnapshot } from '../../../services/market/marketIntelligenceService.js';

export const MI_SYMBOLS = ['IHSG', 'USDIDR', 'BTC', 'GOLD', 'WTI'];

export function fmt(v, digits = 2) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits });
}

export function Badge({ status }) {
  const s = String(status || '').toUpperCase();
  const color = s === 'LIVE' || s === 'COMPUTED_FROM_LIVE_SERIES' ? '#34d399'
    : s === 'SNAPSHOT' || s === 'MANUAL_SNAPSHOT' ? '#fbbf24' : '#f87171';
  return <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 99, border: `1px solid ${color}`, color }}>{s || '—'}</span>;
}

export function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const inp = { fontSize: 10, padding: 4, borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)', background: '#0b1220', color: '#e2e8f0' };

export function useMarketIntelligence() {
  const [symbol, setSymbol] = useState('IHSG');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [macro, setMacro] = useState(null);
  const load = useCallback(async (sym) => {
    setLoading(true); setError('');
    const res = await getMarketAnalysis(sym || symbol);
    if (res && res.symbol) setData(res);
    else setError(res?.error || 'Gagal memuat analisis');
    setLoading(false);
  }, [symbol]);
  useEffect(() => {
    load('IHSG');
    getMacroSnapshot().then((m) => { if (m) setMacro(m); });
    window.__jinMarketAnalyze = (s) => {
      const sym = String(s || 'IHSG').toUpperCase();
      const pick = MI_SYMBOLS.includes(sym) ? sym : 'IHSG';
      setSymbol(pick); load(pick);
    };
    return () => { try { delete window.__jinMarketAnalyze; } catch {} };
  }, [load]);
  return { symbol, setSymbol, data, loading, error, macro, setMacro, load };
}
