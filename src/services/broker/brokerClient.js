/**
 * brokerClient
 * ------------
 * Renderer-side facade for the Broker Workspace.
 *
 * In the Electron shell it talks to the native WebContentsView manager through
 * a narrow preload bridge. In a plain browser it degrades gracefully to opening
 * the broker's official terminal in a real browser tab (never an iframe).
 */

export const BROKER_OFFICIAL_URLS = {
  xm: {
    'xm-web': 'https://my.xmidtrade.com/member/login',
  },
};

export const BROKER_DESKTOP_PROTOCOL = 'ultimateai';

const FALLBACK_BROKERS = [
  {
    id: 'xm',
    name: 'XM',
    vendor: 'XM Global',
    enabled: true,
    platforms: [
      { id: 'xm-web', label: 'XM WebTrader' },
    ],
    defaultPlatformId: 'xm-web',
    capabilities: {
      webTerminal: true,
      mt4: true,
      mt5: true,
      loginFlow: 'broker-owned',
      loginPersistence: 'persistent-partition',
      orderExecution: 'manual-on-broker-ui',
      visualMonitoring: true,
      automatedOrders: false,
    },
    note: 'Login memakai akun XM Anda langsung di halaman resmi XM (my.xmidtrade.com). UltimateAI tidak menyimpan nomor akun, password, atau server. Sesi login disimpan di partisi broker yang terisolasi.',
  },
  {
    id: 'exness',
    name: 'Exness',
    vendor: 'Exness',
    enabled: false,
    platforms: [],
    defaultPlatformId: null,
    capabilities: { webTerminal: false, visualMonitoring: true, automatedOrders: false },
    note: 'Adapter tersedia. Endpoint terminal resmi belum dikonfigurasi pada build ini.',
  },
  {
    id: 'icmarkets',
    name: 'IC Markets',
    vendor: 'IC Markets',
    enabled: false,
    platforms: [],
    defaultPlatformId: null,
    capabilities: { webTerminal: false, visualMonitoring: true, automatedOrders: false },
    note: 'Adapter tersedia. Endpoint terminal resmi belum dikonfigurasi pada build ini.',
  },
];

export function isElectronRuntime() {
  return typeof window !== 'undefined' && window.ultimateAI?.app?.isElectron === true;
}

export function getNativeBrokerBridge() {
  if (!isElectronRuntime()) return null;
  const bridge = window.ultimateAI?.broker;
  if (!bridge || typeof bridge.open !== 'function') return null;
  return bridge;
}

export function isNativeBrokerAvailable() {
  return Boolean(getNativeBrokerBridge());
}

export function buildBrokerDeepLink(brokerId = 'xm', platformId = 'xm-web') {
  const params = new URLSearchParams();
  if (brokerId) params.set('broker', brokerId);
  if (platformId) params.set('platform', platformId);
  return `${BROKER_DESKTOP_PROTOCOL}://broker/open?${params.toString()}`;
}

export function requestDesktopBroker(brokerId, platformId) {
  const deepLink = buildBrokerDeepLink(
    brokerId || 'xm',
    platformId || 'xm-web',
  );
  if (typeof window === 'undefined') {
    return { ok: false, attempted: false, reason: 'no_window', deepLink };
  }
  if (isElectronRuntime()) {
    return { ok: false, attempted: false, reason: 'already_electron', deepLink };
  }
  try {
    const link = document.createElement('a');
    link.href = deepLink;
    link.rel = 'noopener noreferrer';
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    link.style.top = '0';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true, attempted: true, deepLink };
  } catch (err) {
    return {
      ok: false,
      attempted: false,
      reason: 'deep_link_failed',
      message: err?.message || String(err),
      deepLink,
    };
  }
}

export async function listBrokers() {
  const bridge = getNativeBrokerBridge();
  if (bridge) {
    try {
      const brokers = await bridge.list();
      if (Array.isArray(brokers) && brokers.length) return brokers;
    } catch (_) {}
  }
  return FALLBACK_BROKERS;
}

export function resolveBrokerUrl(brokerId, platformId, brokers = FALLBACK_BROKERS) {
  const broker = brokers.find((item) => item.id === brokerId);
  const platform = broker?.platforms?.find((item) => item.id === platformId) || broker?.platforms?.[0];
  if (brokerId && platform?.id && BROKER_OFFICIAL_URLS[brokerId]?.[platform.id]) {
    return BROKER_OFFICIAL_URLS[brokerId][platform.id];
  }
  return BROKER_OFFICIAL_URLS[brokerId]?.['xm-web']
    || BROKER_OFFICIAL_URLS[brokerId]?.[Object.keys(BROKER_OFFICIAL_URLS[brokerId] || {})[0]]
    || null;
}

export async function openBroker(brokerId, platformId) {
  const bridge = getNativeBrokerBridge();
  if (bridge) return bridge.open(brokerId, platformId);
  return {
    ok: false,
    reason: 'electron_required',
    message: 'Terminal XM di dalam workspace hanya tersedia di aplikasi desktop UltimateAI.',
    deepLink: buildBrokerDeepLink(brokerId, platformId),
  };
}

export function openOfficialBrowser(url) {
  if (!url) throw new Error('URL terminal resmi tidak tersedia.');
  if (typeof window !== 'undefined') {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: Boolean(opened), external: true, url };
  }
  return { ok: false, external: true, url };
}

export async function openBrokerExternal(brokerId, platformId, brokers) {
  const bridge = getNativeBrokerBridge();
  if (bridge) return bridge.openExternal(brokerId, platformId);
  return openOfficialBrowser(resolveBrokerUrl(brokerId, platformId, brokers));
}

export async function closeBroker() {
  const bridge = getNativeBrokerBridge();
  if (!bridge) return { ok: true };
  return bridge.close();
}

export async function hideBroker() {
  const bridge = getNativeBrokerBridge();
  if (!bridge) return { ok: true };
  return bridge.hide();
}

export async function setBrokerBounds(rect) {
  const bridge = getNativeBrokerBridge();
  if (!bridge) return { ok: false, reason: 'no_bridge' };
  return bridge.setBounds(rect);
}

export async function reloadBroker() {
  const bridge = getNativeBrokerBridge();
  return bridge ? bridge.reload() : { ok: false };
}

export async function loadBrokerLogin(brokerId, platformId) {
  const bridge = getNativeBrokerBridge();
  return bridge ? bridge.loadLogin(brokerId, platformId) : { ok: false, reason: 'electron_required' };
}

export async function probeBroker() {
  const bridge = getNativeBrokerBridge();
  if (!bridge || typeof bridge.probe !== 'function') return null;
  try {
    return await bridge.probe();
  } catch (_) {
    return null;
  }
}

export async function brokerGoBack() {
  const bridge = getNativeBrokerBridge();
  return bridge ? bridge.goBack() : { ok: false };
}

export async function brokerGoForward() {
  const bridge = getNativeBrokerBridge();
  return bridge ? bridge.goForward() : { ok: false };
}

export async function clearBrokerSession() {
  const bridge = getNativeBrokerBridge();
  if (!bridge) return { ok: false, reason: 'no_bridge' };
  return bridge.clearSession();
}

export async function captureBroker(options) {
  const bridge = getNativeBrokerBridge();
  if (!bridge) throw new Error('Native broker capture hanya tersedia di aplikasi desktop Electron.');
  return bridge.capture(options);
}

export async function getBrokerStatus() {
  const bridge = getNativeBrokerBridge();
  if (!bridge) return null;
  try {
    return await bridge.getStatus();
  } catch (_) {
    return null;
  }
}

export function subscribeBrokerStatus(callback) {
  const bridge = getNativeBrokerBridge();
  if (!bridge || typeof bridge.onStatus !== 'function') return () => {};
  return bridge.onStatus(callback);
}

export function brokerConnectionLabel(status) {
  if (!status) return 'SIAP';
  if (status.fatalError || status.error) return `GANGGUAN: ${status.error}`;
  if (status.loading) return 'MENGHUBUNGKAN...';
  if (status.loginRequired) return 'PERLU LOGIN DI HALAMAN BROKER';
  if (status.chartNoData) return 'TERHUBUNG - CHART NO DATA';
  if (status.platformReady) return 'TERHUBUNG - PLATFORM SIAP';
  if (status.connected) return 'TERHUBUNG';
  return 'SIAP';
}

export function brokerErrorHint(status) {
  if (!status) return '';
  if (status.chartNoData) {
    return 'Chart XM menampilkan "No data here". Saat pasar tutup chart tetap harus memuat candle historis; area kosong biasanya berarti feed candle/quote belum diterima, simbol belum dipilih, atau sesi data belum siap. Coba pilih simbol/timeframe, cek Market Watch, lalu reload.';
  }
  if (Number(status.errorCode) === -337) {
    return 'Server atau jaringan menolak negosiasi HTTP/2 Chromium. UltimateAI tidak mematikan verifikasi TLS. Coba jaringan lain, nonaktifkan proxy/firewall yang memblokir HTTP/2, atau buka terminal resmi XM di browser.';
  }
  if (Number(status.errorCode) === -200 || Number(status.errorCode) === -202) {
    return 'Sertifikat TLS XM tidak lolos verifikasi. Periksa jam sistem dan intercept proxy; verifikasi sertifikat tidak boleh dimatikan.';
  }
  if (status.error) return status.error;
  return '';
}
