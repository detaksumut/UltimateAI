/**
 * UIStateResolver.js (v2 - Real-Time Freshness Heartbeat & Grounding)
 *
 * Provides verifiable evidence of what UI views, modals, and sandbox apps are actually active.
 * Incorporates Freshness TTL to prevent relying on stale UI state.
 */

class UIStateResolver {
  constructor() {
    this.FRESHNESS_TTL_MS = 10000; // 10 seconds validity window
    this.currentState = {
      activeTab: 'CHAT', // 'CHAT' | 'MEDIA' | 'WEB' | 'APP_PREVIEW'
      activeModal: null, // 'MEMORY_VAULT' | 'ACTIVITY_FEED' | 'CONTROL_CENTER' | 'CONNECTIONS' | 'RESEARCH_LAB' | 'NON_RESEARCH_LAB' | null
      activeApp: null, // { id, title, type } or null
      isSandboxRunning: false,
      isAudioInputAvailable: true,
      isImageAttachmentPresent: false,
      lastUpdated: Date.now()
    };
  }

  updateState(partialState = {}) {
    this.currentState = {
      ...this.currentState,
      ...partialState,
      lastUpdated: Date.now()
    };
  }

  isStateFresh() {
    return (Date.now() - (this.currentState.lastUpdated || 0)) < this.FRESHNESS_TTL_MS;
  }

  getState() {
    return { ...this.currentState, isFresh: this.isStateFresh() };
  }

  isAppActive() {
    if (!this.isStateFresh()) return false;
    return Boolean(this.currentState.activeApp && this.currentState.isSandboxRunning);
  }

  getUIPromptContext() {
    const isFresh = this.isStateFresh();
    const s = this.currentState;

    if (!isFresh) {
      return `=== UI REALITY STATE (STATUS TIDAK DIKETAHUI / TIDAK ADA APLIKASI AKTIF) ===
Status UI saat ini: Netral.
DILARANG merujuk lokasi spesifik atau mengatakan "aplikasi di atas". Gunakan arahan umum seperti "melalui antarmuka Anda".`;
    }

    const appInfo = (s.activeApp && s.isSandboxRunning)
      ? `Aplikasi Aktif di Layar: "${s.activeApp.title || s.activeApp.id}" (Sandbox: RUNNING)`
      : `Aplikasi Aktif di Layar: TIDAK ADA (Sandbox Kosong)`;

    return `=== UI REALITY STATE (VERIFIED RUNTIME & FRESH) ===
Tab Layar Utama: ${s.activeTab}
Modal Aktif: ${s.activeModal || 'TIDAK ADA'}
${appInfo}

ATURAN UI GROUNDING:
- Jika "Aplikasi Aktif di Layar" adalah TIDAK ADA: DILARANG KERAS merujuk "aplikasi di atas", "modul di atas", atau "SpeechSense Pro".
- Jika pengguna ingin mengunggah audio/dokumen, cukup katakan untuk mengunggah berkas tersebut tanpa mengarang nama tombol atau modul yang tidak ada.`;
  }
}

export const uiStateResolverInstance = new UIStateResolver();
export default uiStateResolverInstance;
