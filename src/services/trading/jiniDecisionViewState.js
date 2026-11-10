/**
 * jiniDecisionViewState.js
 * Pure view-state resolver for the JINI Decision panel.
 *
 * A failed refresh must never present the previous payload as the current
 * decision. When a payload exists it is marked STALE; when none exists the
 * panel reports UNAVAILABLE. No defaults or simulated values are injected.
 */

export const JINI_VIEW_STATE = Object.freeze({
  LIVE: 'LIVE',
  STALE: 'STALE',
  UNAVAILABLE: 'UNAVAILABLE',
});

function toIsoOrNull(value) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function hasUsableDecision(data) {
  return Boolean(data && data.ok === true && data.decision && data.decision.preliminaryDecision);
}

export function deriveJiniViewState({
  data = null,
  error = '',
  loading = false,
  lastSuccessAt = null,
  lastAttemptAt = null,
} = {}) {
  const payload = hasUsableDecision(data);
  const reason = typeof error === 'string' ? error.trim() : '';
  const successIso = toIsoOrNull(lastSuccessAt);
  const attemptIso = toIsoOrNull(lastAttemptAt);

  if (payload && reason) {
    return {
      state: JINI_VIEW_STATE.STALE,
      hasPayload: true,
      stale: true,
      live: false,
      loading,
      refreshError: reason,
      lastSuccessAt: successIso,
      lastAttemptAt: attemptIso,
      message: 'Refresh gagal. Keputusan di bawah adalah snapshot terakhir yang berhasil, bukan kondisi pasar terkini.',
    };
  }

  if (payload) {
    return {
      state: JINI_VIEW_STATE.LIVE,
      hasPayload: true,
      stale: false,
      live: true,
      loading,
      refreshError: '',
      lastSuccessAt: successIso,
      lastAttemptAt: attemptIso,
      message: '',
    };
  }

  return {
    state: JINI_VIEW_STATE.UNAVAILABLE,
    hasPayload: false,
    stale: false,
    live: false,
    loading,
    refreshError: reason,
    lastSuccessAt: successIso,
    lastAttemptAt: attemptIso,
    message: successIso
      ? 'Snapshot terakhir tidak lagi dapat diverifikasi; tidak ada data pengganti.'
      : 'Belum pernah berhasil mengambil keputusan JINI. Tidak ada data simulasi yang ditampilkan.',
  };
}
