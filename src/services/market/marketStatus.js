/**
 * marketStatus.js
 * Shared, honest DATA STATUS taxonomy for the market UI.
 *
 * The cardinal rule: VERIFIED !== LIVE. A panel that merely fetched successfully
 * is VERIFIED, but its data STATUS tells the real story about freshness:
 *
 *   🟢 LIVE            real-time / streaming from a source in a REGULAR session.
 *   🔵 DELAYED         real data but with known provider lag (PRE/POST session).
 *   🟡 SNAPSHOT        a captured reading, no live streaming — shows timestamp.
 *   🟣 MARKET CLOSED   the market/session is closed; shows last official close.
 *   🔴 STALE           past the freshness threshold.
 *   ⚪ UNAVAILABLE     no data obtained (no source / fetch failed).
 *
 * The backend derives these from the provider's own market-state metadata, so
 * JIN never labels data LIVE unless the source actually says it is live.
 */

export const DATA_STATUS = {
  LIVE: {
    label: 'LIVE',
    short: '● LIVE',
    color: '#34d399',
    dot: '#10b981',
    description: 'Data real-time dari sumber aktif.'
  },
  DELAYED: {
    label: 'DELAYED',
    short: '◉ DELAYED',
    color: '#38bdf8',
    dot: '#0ea5e9',
    description: 'Data pasar nyata dengan keterlambatan feed.'
  },
  SNAPSHOT: {
    label: 'SNAPSHOT',
    short: '◔ SNAPSHOT',
    color: '#fbbf24',
    dot: '#f59e0b',
    description: 'Hasil pengambilan terakhir dari sumber.'
  },
  MARKET_CLOSED: {
    label: 'MARKET CLOSED',
    short: '◌ MARKET CLOSED',
    color: '#a78bfa',
    dot: '#8b5cf6',
    description: 'Pasar tutup — menampilkan penutupan resmi terakhir.'
  },
  STALE: {
    label: 'STALE',
    short: '✕ STALE',
    color: '#f87171',
    dot: '#ef4444',
    description: 'Data melewati batas kesegaran.'
  },
  UNAVAILABLE: {
    label: 'UNAVAILABLE',
    short: '— UNAVAILABLE',
    color: '#94a3b8',
    dot: '#cbd5e1',
    description: 'Tidak ada data dari sumber.'
  }
};

/** Resolve a panel's data status definition (falls back to UNAVAILABLE). */
export function dataStatusDef(panel) {
  const key = panel?.dataStatus;
  return DATA_STATUS[key] || DATA_STATUS.UNAVAILABLE;
}

/** Whether a panel carries a real, usable value. */
export function hasValue(panel) {
  return panel && panel.value != null;
}

export default DATA_STATUS;