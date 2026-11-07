/**
 * Broker adapter registry (main process).
 *
 * This is the single source of truth for which broker platforms may be opened
 * inside the UltimateAI Electron shell. The renderer only ever receives an
 * identifier + display metadata; it cannot inject arbitrary URLs.
 *
 * Rules:
 * - Only official broker web terminals are listed.
 * - Credentials are NEVER handled here. Login happens on the broker's own page.
 * - Each broker gets its own persistent Chromium partition (cookies/session).
 */

const BROKERS = [
  {
    id: 'xm',
    name: 'XM',
    vendor: 'XM Global',
    enabled: true,
    platforms: [
      {
        id: 'xm-web',
        label: 'XM WebTrader',
        // Official XM web terminal login. After a successful manual login XM
        // redirects to the authenticated terminal (for example
        // https://my.xmidtrade.com/trades/positions).
        url: 'https://my.xmidtrade.com/member/login',
      },
    ],
    defaultPlatformId: 'xm-web',
    // Only these hosts may be opened as popups/new windows from this broker.
    // The xmidtrade / x8m8 / xmidbroker entries were verified against the
    // official XM TLS certificate (SANs) for my.xmidtrade.com.
    allowedHosts: [
      'xm.com',
      'www.xm.com',
      'my.xm.com',
      'secure.xm.com',
      'mt4.xm.com',
      'mt5.xm.com',
      'webtrader.xm.com',
      'xmidtrade.com',
      'x8m8.world',
      'xmidbroker.net',
    ],
    partition: 'persist:ultimateai-broker-xm',
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
    allowedHosts: ['exness.com', 'www.exness.com', 'my.exness.com'],
    partition: 'persist:ultimateai-broker-exness',
    capabilities: {
      webTerminal: false,
      orderExecution: 'manual-on-broker-ui',
      visualMonitoring: true,
      automatedOrders: false,
    },
    note: 'Adapter tersedia. Endpoint terminal resmi belum dikonfigurasi pada build ini.',
  },
  {
    id: 'icmarkets',
    name: 'IC Markets',
    vendor: 'IC Markets',
    enabled: false,
    platforms: [],
    defaultPlatformId: null,
    allowedHosts: ['icmarkets.com', 'www.icmarkets.com', 'secure.icmarkets.com'],
    partition: 'persist:ultimateai-broker-icmarkets',
    capabilities: {
      webTerminal: false,
      orderExecution: 'manual-on-broker-ui',
      visualMonitoring: true,
      automatedOrders: false,
    },
    note: 'Adapter tersedia. Endpoint terminal resmi belum dikonfigurasi pada build ini.',
  },
];

const BROKER_MAP = new Map(BROKERS.map((broker) => [broker.id, broker]));

function getBroker(brokerId) {
  return BROKER_MAP.get(String(brokerId || '').toLowerCase()) || null;
}

function getPlatform(broker, platformId) {
  if (!broker || !broker.platforms.length) return null;
  const wanted = String(platformId || broker.defaultPlatformId || '').toLowerCase();
  return broker.platforms.find((platform) => platform.id === wanted) || broker.platforms[0];
}

function isAllowedHost(broker, url) {
  if (!broker) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return broker.allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function publicBrokerList() {
  return BROKERS.map((broker) => ({
    id: broker.id,
    name: broker.name,
    vendor: broker.vendor,
    enabled: Boolean(broker.enabled),
    platforms: broker.platforms.map((platform) => ({ id: platform.id, label: platform.label })),
    defaultPlatformId: broker.defaultPlatformId,
    capabilities: { ...broker.capabilities },
    note: broker.note,
  }));
}

module.exports = {
  BROKERS,
  getBroker,
  getPlatform,
  isAllowedHost,
  publicBrokerList,
};
