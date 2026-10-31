import React, { useState } from 'react';

const PRIME_XBT_MARKETS_URL = 'https://primexbt.com/my/discover/markets/cfd';

export default function PrimeXBTMarketsPanel() {
  const [expanded, setExpanded] = useState(true);
  const [loadError, setLoadError] = useState(false);

  return (
    <section
      aria-label="PrimeXBT CFD Markets"
      style={{
        marginTop: 12,
        border: '1px solid #164e63',
        borderRadius: 7,
        overflow: 'hidden',
        background: '#06101d',
        minWidth: 0,
      }}
    >
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
        padding: '11px 13px',
        borderBottom: expanded ? '1px solid #164e63' : 0,
        background: '#071827',
      }}>
        <div>
          <div style={{ color: '#67e8f9', fontSize: 12, fontWeight: 900, letterSpacing: .6 }}>
            PRIME XBT · CFD MARKETS
          </div>
          <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>
            Panel pasar eksternal · ketersediaan embed bergantung pada kebijakan keamanan PrimeXBT
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <a
            href={PRIME_XBT_MARKETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '7px 10px',
              border: '1px solid #155e75',
              borderRadius: 5,
              background: '#082333',
              color: '#bae6fd',
              fontSize: 10,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            ↗ BUKA PRIME XBT
          </a>
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            aria-expanded={expanded}
            style={{
              padding: '7px 10px',
              border: '1px solid #164e63',
              borderRadius: 5,
              background: '#030812',
              color: '#cbd5e1',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {expanded ? '− Sembunyikan' : '+ Tampilkan'}
          </button>
        </div>
      </header>

      {expanded && (
        <div style={{ position: 'relative', background: '#030812' }}>
          <iframe
            title="PrimeXBT CFD Markets"
            src={PRIME_XBT_MARKETS_URL}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setLoadError(true)}
            style={{
              display: 'block',
              width: '100%',
              height: 'min(72vh, 680px)',
              minHeight: 420,
              border: 0,
              background: '#030812',
            }}
          />
          <div style={{
            padding: '9px 12px',
            borderTop: '1px solid #164e63',
            color: '#94a3b8',
            fontSize: 10,
            lineHeight: 1.6,
          }}>
            {loadError
              ? 'Halaman PrimeXBT tidak berhasil dimuat di panel ini. Buka situsnya melalui tombol di atas.'
              : 'Jika panel kosong atau menampilkan penolakan koneksi, PrimeXBT kemungkinan membatasi iframe. Gunakan tombol “BUKA PRIME XBT”; pembatasan tersebut tidak dapat diatasi dari sisi JIN.'}
          </div>
        </div>
      )}
    </section>
  );
}
