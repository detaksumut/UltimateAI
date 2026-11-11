import React, { useState, useEffect } from 'react';
import { RouterConfig } from '../../services/router/RouterConfig.js';

/**
 * EconomicCalendarPanel
 * Displays verified macroeconomic releases and scheduled events fetched directly
 * from official macroeconomic readers (/api/trading/fundamental-read).
 * Strictly avoids synthetic or fabricated mock events.
 */
export default function EconomicCalendarPanel({ instrument = 'XAUUSD' }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState(null);

  const fetchOfficialReleases = async () => {
    setLoading(true);
    setError('');
    try {
      const base = String(RouterConfig.getEndpoint() || 'http://127.0.0.1:20200').replace(/\/+$/, '');
      const primaryRoute = base.endsWith('/api') ? '/trading/fundamental-read' : '/api/trading/fundamental-read';
      const fallbackRoute = base.endsWith('/api') ? '/api/trading/fundamental-read' : '/trading/fundamental-read';

      let response = null;
      try {
        response = await fetch(`${base}${primaryRoute}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sources: ['fed', 'bls', 'bea', 'treasury'] }),
          signal: AbortSignal.timeout(15000)
        });
      } catch (_) {}

      // If primary failed or returned 404, try fallbackRoute
      if (!response || !response.ok) {
        try {
          response = await fetch(`${base}${fallbackRoute}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources: ['fed', 'bls', 'bea', 'treasury'] }),
            signal: AbortSignal.timeout(15000)
          });
        } catch (_) {}
      }

      // If still not ok, try relative same-origin /api/trading/fundamental-read
      if (!response || !response.ok) {
        try {
          response = await fetch('/api/trading/fundamental-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources: ['fed', 'bls', 'bea', 'treasury'] }),
            signal: AbortSignal.timeout(15000)
          });
        } catch (_) {}
      }

      if (!response || !response.ok) {
        throw new Error(`HTTP ${response?.status || '503'} dari endpoint fundamental reader.`);
      }

      const payload = await response.json();
      if (!payload || !payload.success) {
        throw new Error(payload?.error || 'Gagal membaca jadwal dari sumber resmi.');
      }

      setSources(payload.sources || []);
      setLastFetched(payload.fetchedAt || new Date().toISOString());
    } catch (err) {
      setError(err?.message || 'Sumber jadwal resmi belum dapat dihubungi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficialReleases();
  }, []);

  return (
    <div
      style={{
        background: '#071224',
        border: '1px solid rgba(0, 229, 255, 0.15)',
        borderRadius: 10,
        padding: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>
            📅 JADWAL RILIS MAKROEKONOMI RESMI (FED / BLS / BEA / TREASURY)
          </h3>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
            Isi jadwal rilis diambil dari bagian utama halaman resmi (navigasi/footer dibuang) untuk instrumen {instrument}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastFetched && (
            <span style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: 'monospace' }}>
              Update: {new Date(lastFetched).toLocaleTimeString('id-ID')}
            </span>
          )}
          <button
            onClick={fetchOfficialReleases}
            disabled={loading}
            style={{
              padding: '5px 10px',
              borderRadius: 5,
              background: 'rgba(0, 229, 255, 0.12)',
              border: '1px solid rgba(0, 229, 255, 0.35)',
              color: '#00e5ff',
              fontSize: 10,
              fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer'
            }}
          >
            {loading ? 'Memuat...' : '↻ Segarkan Jadwal'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#38bdf8', fontSize: 11, fontFamily: 'monospace' }}>
          ⏳ Membaca halaman jadwal resmi Federal Reserve, BLS, dan BEA...
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            padding: '12px 14px',
            color: '#f87171',
            fontSize: 11,
            lineHeight: 1.5
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Pemberitahuan Sumber:</div>
          <div>{error}</div>
          <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 6 }}>
            Pastikan Local Router aktif (:20200) atau koneksi internet tersedia untuk membaca web resmi. Data mock fiktif tidak akan ditampilkan.
          </div>
        </div>
      )}

      {!loading && !error && sources.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: 11 }}>
          Belum ada jadwal yang berhasil dimuat. Klik tombol "Segarkan Jadwal" di atas.
        </div>
      )}

      {!loading && sources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sources.map(src => {
            const isRead = src.status === 'READ';
            return (
              <div
                key={src.key}
                style={{
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  padding: '10px 12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9' }}>{src.label}</span>
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 900,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: isRead ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: isRead ? '#34d399' : '#f87171',
                        border: `1px solid ${isRead ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                      }}
                    >
                      {src.status}
                    </span>
                  </div>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 9.5, color: '#38bdf8', textDecoration: 'none' }}
                  >
                    Buka Sumber ↗
                  </a>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: '#cbd5e1',
                    lineHeight: 1.55,
                    maxHeight: 240,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '8px 10px',
                    borderRadius: 4
                  }}
                >
                  {isRead ? (src.content || 'Konten jadwal tidak ditemukan pada halaman sumber.') : `Sumber tidak dapat diakses (${src.error || 'Network error'})`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
