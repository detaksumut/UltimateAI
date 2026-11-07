/**
 * BrokerWorkspaceManager
 * ----------------------
 * Owns the native browser workspace used to display a broker's REAL web
 * trading terminal inside UltimateAI.
 *
 * Design notes:
 * - Uses Electron WebContentsView (not an iframe) so broker sites are not
 *   constrained by CSP / X-Frame-Options.
 * - Each broker uses a dedicated persistent session partition, so cookies and
 *   login sessions survive restarts while staying isolated between brokers.
 * - UltimateAI never reads or stores broker passwords. Authentication happens
 *   entirely on the broker's own official page.
 * - The remote page cannot access Node.js and no preload is injected into it.
 * - JINI monitoring is opt-in: the renderer must explicitly request capture.
 * - No order automation exists in this layer.
 */

const { WebContentsView, session, shell } = require('electron');
const {
  getBroker,
  getPlatform,
  isAllowedHost,
  publicBrokerList,
} = require('./broker-adapters.cjs');

const MAX_CAPTURE_WIDTH = 3840;
const MIN_CAPTURE_WIDTH = 640;
const MAX_DIAGNOSTIC_HTTP = 24;
const MAX_DIAGNOSTIC_CONSOLE = 12;
const DATA_PATH_PATTERN = /(chart|candle|history|quote|price|tick|market|symbol|instrument|stream|socket|trade|position|account|auth|login|token)/i;

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function describeLoadError(code, description) {
  switch (Number(code)) {
    case -337:
      return 'HTTP/2 protocol ditolak oleh server/jaringan XM (ERR_HTTP2_PROTOCOL_ERROR). Coba koneksi lain atau buka di browser resmi.';
    case -200:
      return 'Sertifikat TLS tidak cocok dengan hostname XM (ERR_CERT_COMMON_NAME_INVALID).';
    case -202:
      return 'Sertifikat TLS XM tidak tepercaya (ERR_CERT_AUTHORITY_INVALID).';
    case -201:
      return 'Sertifikat TLS XM sudah kedaluwarsa (ERR_CERT_DATE_INVALID).';
    case -105:
      return 'Nama domain XM tidak dapat ditemukan (ERR_NAME_NOT_RESOLVED).';
    case -106:
      return 'Koneksi internet tidak tersedia (ERR_INTERNET_DISCONNECTED).';
    case -118:
      return 'Koneksi ke server XM timeout (ERR_CONNECTION_TIMED_OUT).';
    case -324:
      return 'Server XM menutup koneksi tanpa respons (ERR_EMPTY_RESPONSE).';
    case -21:
      return 'Operasi jaringan dibatalkan (ERR_NETWORK_CHANGED).';
    default:
      return `${description || 'Gagal memuat'} (${code})`;
  }
}

function sanitizeUrlForDiagnostics(raw) {
  try {
    const parsed = new URL(String(raw || ''));
    if (parsed.protocol === 'about:') return { host: parsed.protocol, path: parsed.pathname || '' };
    const path = String(parsed.pathname || '/')
      .replace(/\/\d{4,}/g, '/:id')
      .slice(0, 160);
    return {
      host: String(parsed.hostname || '').toLowerCase().slice(0, 120),
      path,
    };
  } catch (_) {
    return null;
  }
}

function redactConsoleMessage(message) {
  return String(message || '')
    .replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
      const safe = sanitizeUrlForDiagnostics(match);
      return safe ? `${safe.host}${safe.path}` : '[url]';
    })
    .replace(/\b\d{5,}\b/g, ':id')
    .slice(0, 240);
}

function cleanChromeUserAgent() {
  const chrome = process.versions.chrome || '120.0.0.0';
  const platform = process.platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'linux'
      ? 'X11; Linux x86_64'
      : 'Windows NT 10.0; Win64; x64';
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;
}

class BrokerWorkspaceManager {
  constructor({ getWindow, appVersion }) {
    this.getWindow = getWindow;
    this.appVersion = appVersion || '1.0.0';
    this.view = null;
    this.broker = null;
    this.platform = null;
    this._probeTimer = null;
    this._diagnosticsTimer = null;
    this._networkSession = null;
    this._debuggerAttached = false;
    this._debuggerMessageHandler = null;
    this._diag = this._emptyDiagnostics();
    this._status = this._emptyStatus();
  }

  _emptyDiagnostics() {
    return {
      lastFailure: null,
      lastBlockedNavigation: null,
      http: [],
      console: [],
      navigations: [],
      websocket: {
        state: 'none',
        host: null,
        path: null,
        handshakeStatus: null,
        openedAt: null,
        closedAt: null,
        frames: 0,
        lastFrameAt: null,
        lastError: null,
      },
      chart: {
        canvasCount: 0,
        noDataVisible: false,
        marketWatchVisible: false,
        orderPanelVisible: false,
        positionsVisible: false,
        loginFormVisible: false,
        tradingPath: false,
        loginPath: false,
        probedAt: null,
      },
      debuggerAttached: false,
      proxy: null,
      lastProbeAt: null,
    };
  }

  _snapshotDiagnostics() {
    return {
      ...this._diag,
      http: this._diag.http.slice(),
      console: this._diag.console.slice(),
      navigations: this._diag.navigations.slice(),
      websocket: { ...this._diag.websocket },
      chart: { ...this._diag.chart },
    };
  }

  _emitDiagnostics() {
    this._emit({ diagnostics: this._snapshotDiagnostics() });
  }

  _scheduleDiagnosticsEmit() {
    if (this._diagnosticsTimer) return;
    this._diagnosticsTimer = setTimeout(() => {
      this._diagnosticsTimer = null;
      this._emitDiagnostics();
    }, 1500);
  }

  _pushHttpDiagnostic(entry) {
    this._diag.http.push({ at: new Date().toISOString(), ...entry });
    if (this._diag.http.length > MAX_DIAGNOSTIC_HTTP) {
      this._diag.http.splice(0, this._diag.http.length - MAX_DIAGNOSTIC_HTTP);
    }
    this._scheduleDiagnosticsEmit();
  }

  _pushConsoleDiagnostic(entry) {
    this._diag.console.push({ at: new Date().toISOString(), ...entry });
    if (this._diag.console.length > MAX_DIAGNOSTIC_CONSOLE) {
      this._diag.console.splice(0, this._diag.console.length - MAX_DIAGNOSTIC_CONSOLE);
    }
    this._scheduleDiagnosticsEmit();
  }

  _emptyStatus() {
    return {
      brokerId: null,
      platformId: null,
      platformLabel: null,
      url: null,
      title: null,
      loading: false,
      connected: false,
      loginRequired: false,
      platformReady: false,
      chartNoData: false,
      fatalError: false,
      errorCode: null,
      errorDescription: null,
      error: null,
      canGoBack: false,
      canGoForward: false,
      sessionPersistent: true,
      capabilities: {},
      diagnostics: this._emptyDiagnostics ? this._snapshotDiagnostics() : {},
      updatedAt: new Date().toISOString(),
    };
  }

  listBrokers() {
    return publicBrokerList();
  }

  getStatus() {
    return { ...this._status };
  }

  _window() {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return null;
    return win;
  }

  _emit(patch) {
    this._status = {
      ...this._status,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const win = this._window();
    if (win) {
      try {
        win.webContents.send('broker:status', this.getStatus());
      } catch (_) {
        /* window may be navigating */
      }
    }
    return this.getStatus();
  }

  _recordFailure(phase, errorCode, errorDescription, validatedURL) {
    const safeUrl = sanitizeUrlForDiagnostics(validatedURL || this._status.url);
    this._diag.lastFailure = {
      at: new Date().toISOString(),
      phase,
      code: Number(errorCode) || null,
      description: String(errorDescription || ''),
      url: safeUrl,
      friendly: describeLoadError(errorCode, errorDescription),
    };
    this._emit({
      loading: false,
      connected: false,
      platformReady: false,
      fatalError: true,
      errorCode: Number(errorCode) || null,
      errorDescription: String(errorDescription || ''),
      error: this._diag.lastFailure.friendly,
      url: validatedURL || this._status.url,
      diagnostics: this._snapshotDiagnostics(),
    });
  }

  _attachWebContentsEvents() {
    const wc = this.view.webContents;

    wc.on('did-start-loading', () => {
      this._emit({ loading: true });
    });

    wc.on('did-stop-loading', () => {
      this._emit({
        loading: false,
        canGoBack: wc.canGoBack(),
        canGoForward: wc.canGoForward(),
        url: wc.getURL(),
      });
      this._scheduleCapabilityProbe();
    });

    wc.on('did-navigate', (_event, url) => {
      const safe = sanitizeUrlForDiagnostics(url);
      this._diag.navigations.push({ at: new Date().toISOString(), url: safe });
      if (this._diag.navigations.length > 12) this._diag.navigations.shift();
      this._emit({
        url,
        error: null,
        fatalError: false,
        errorCode: null,
        errorDescription: null,
        canGoBack: wc.canGoBack(),
        canGoForward: wc.canGoForward(),
        loginRequired: false,
        platformReady: false,
        chartNoData: false,
        diagnostics: this._snapshotDiagnostics(),
      });
      this._scheduleCapabilityProbe();
    });

    wc.on('did-navigate-in-page', (_event, url) => {
      this._emit({
        url,
        canGoBack: wc.canGoBack(),
        canGoForward: wc.canGoForward(),
      });
      this._scheduleCapabilityProbe();
    });

    wc.on('page-title-updated', (_event, title) => {
      this._emit({ title });
    });

    wc.on('did-fail-provisional-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      this._recordFailure('provisional', errorCode, errorDescription, validatedURL);
    });

    wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // -3 = ERR_ABORTED, common during redirects. Not a real failure.
      if (!isMainFrame || errorCode === -3) return;
      this._recordFailure('load', errorCode, errorDescription, validatedURL);
    });

    wc.on('console-message', (_event, level, message, line, sourceId) => {
      if (Number(level) < 2) return;
      const text = redactConsoleMessage(message);
      if (!/chart|data|candle|quote|websocket|socket|market|history|error|fail|unauthor|session|login|xm/i.test(text)) return;
      const source = sanitizeUrlForDiagnostics(sourceId);
      this._pushConsoleDiagnostic({
        level: Number(level),
        message: text,
        line: Number(line) || null,
        sourceHost: source?.host || null,
      });
    });

    wc.on('render-process-gone', (_event, details) => {
      this._emit({
        loading: false,
        connected: false,
        platformReady: false,
        fatalError: true,
        error: `Renderer broker berhenti: ${details?.reason || 'unknown'}`,
      });
    });

    wc.on('unresponsive', () => {
      this._emit({ error: 'Halaman broker tidak merespons. Coba reload.' });
    });

    wc.setWindowOpenHandler(({ url }) => {
      // Login, SSO, and account-center redirects stay inside the SAME
      // WebContentsView. No external browser tab or unmanaged window is
      // created. Non-XM targets are denied.
      if (isAllowedHost(this.broker, url)) {
        try {
          wc.loadURL(url).catch(() => {});
        } catch (_) {}
      } else {
        this._diag.lastBlockedNavigation = { at: new Date().toISOString(), url: sanitizeUrlForDiagnostics(url) };
        this._scheduleDiagnosticsEmit();
      }
      return { action: 'deny' };
    });

    const guardTopLevelNavigation = (event, url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'about:') return;
        if (parsed.protocol !== 'https:' || !isAllowedHost(this.broker, url)) {
          event.preventDefault();
          this._diag.lastBlockedNavigation = { at: new Date().toISOString(), url: sanitizeUrlForDiagnostics(url) };
          this._scheduleDiagnosticsEmit();
        }
      } catch {
        event.preventDefault();
      }
    };

    wc.on('will-navigate', guardTopLevelNavigation);
    wc.on('will-redirect', guardTopLevelNavigation);
  }

  _attachNetworkDiagnostics(brokerSession) {
    this._networkSession = brokerSession;
    const record = (details, outcome) => {
      try {
        if (!details || !details.url) return;
        const type = String(details.resourceType || '');
        if (['image', 'stylesheet', 'script', 'font', 'media', 'cspReport'].includes(type)) return;
        const safe = sanitizeUrlForDiagnostics(details.url);
        if (!safe) return;
        const isMainFrame = type === 'mainFrame';
        const isDataHost = /x8m8|xmidtrade|xmidbroker|xm\.com/i.test(safe.host);
        if (!isMainFrame && !isDataHost && !DATA_PATH_PATTERN.test(safe.path)) return;
        this._pushHttpDiagnostic({
          host: safe.host,
          path: safe.path,
          resourceType: type || null,
          status: outcome.status ?? null,
          error: outcome.error || null,
        });
      } catch (_) {}
    };
    brokerSession.webRequest.onCompleted((details) => {
      record(details, { status: details.statusCode });
    });
    brokerSession.webRequest.onErrorOccurred((details) => {
      record(details, { error: details.error });
    });
  }

  _detachNetworkDiagnostics() {
    if (!this._networkSession) return;
    try {
      this._networkSession.webRequest.onCompleted(null);
      this._networkSession.webRequest.onErrorOccurred(null);
    } catch (_) {}
    this._networkSession = null;
  }

  _attachDebuggerDiagnostics() {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    const wc = this.view.webContents;
    try {
      wc.debugger.attach('1.3');
    } catch (_) {
      return;
    }
    this._debuggerAttached = true;
    this._diag.debuggerAttached = true;
    try {
      wc.debugger.sendCommand('Network.enable').catch(() => {});
    } catch (_) {}

    this._debuggerMessageHandler = (_event, method, params) => {
      try {
        if (method === 'Network.webSocketCreated') {
          const safe = sanitizeUrlForDiagnostics(params?.url);
          this._diag.websocket = {
            ...this._diag.websocket,
            state: 'connecting',
            host: safe?.host || null,
            path: safe?.path || null,
            openedAt: new Date().toISOString(),
            closedAt: null,
            lastError: null,
          };
          this._scheduleDiagnosticsEmit();
        } else if (method === 'Network.webSocketHandshakeResponseReceived') {
          this._diag.websocket = {
            ...this._diag.websocket,
            state: 'open',
            handshakeStatus: Number(params?.response?.status) || null,
          };
          this._scheduleDiagnosticsEmit();
        } else if (method === 'Network.webSocketFrameReceived') {
          this._diag.websocket = {
            ...this._diag.websocket,
            frames: (this._diag.websocket.frames || 0) + 1,
            lastFrameAt: new Date().toISOString(),
          };
          this._scheduleDiagnosticsEmit();
        } else if (method === 'Network.webSocketFrameError') {
          this._diag.websocket = {
            ...this._diag.websocket,
            lastError: redactConsoleMessage(params?.errorMessage || 'websocket error'),
          };
          this._scheduleDiagnosticsEmit();
        } else if (method === 'Network.webSocketClosed') {
          this._diag.websocket = {
            ...this._diag.websocket,
            state: 'closed',
            closedAt: new Date().toISOString(),
          };
          this._scheduleDiagnosticsEmit();
        }
      } catch (_) {}
    };
    wc.debugger.on('message', this._debuggerMessageHandler);
  }

  _detachDebuggerDiagnostics() {
    const wc = this.view?.webContents;
    if (!this._debuggerAttached || !wc || wc.isDestroyed()) return;
    try {
      if (this._debuggerMessageHandler) wc.debugger.removeListener('message', this._debuggerMessageHandler);
    } catch (_) {}
    try {
      if (wc.debugger.isAttached()) wc.debugger.detach();
    } catch (_) {}
    this._debuggerMessageHandler = null;
    this._debuggerAttached = false;
  }

  _scheduleCapabilityProbe() {
    if (this._probeTimer) clearTimeout(this._probeTimer);
    this._probeTimer = setTimeout(() => {
      this._probeTimer = null;
      this._probeCapabilities();
    }, 1800);
  }

  async _probeCapabilities() {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    try {
      const probe = await this.view.webContents.executeJavaScript(
        `(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const hasPassword = inputs.some((input) => {
            const type = String(input.type || '').toLowerCase();
            const visible = input.getClientRects().length > 0;
            return type === 'password' && visible;
          });
          const canvasCount = document.querySelectorAll('canvas').length;
          const bodyText = document.body ? String(document.body.innerText || '').slice(0, 12000) : '';
          const lower = bodyText.toLowerCase();
          const hasTradingWords = /(chart|market watch|terminal|trade|order|positions)/i.test(bodyText);
          const noDataVisible = /no data here/i.test(bodyText);
          const marketWatchVisible = /(market watch|marketwatch|watchlist|symbols)/i.test(lower);
          const orderPanelVisible = /(new order|order ticket|volume|buy limit|sell limit|one.click)/i.test(lower);
          const positionsVisible = /(positions|open positions|trade history|pending orders)/i.test(lower);
          const path = String(location.pathname || '');
          return {
            hasPassword,
            canvasCount,
            hasTradingWords,
            noDataVisible,
            marketWatchVisible,
            orderPanelVisible,
            positionsVisible,
            loginPath: /\\/(member\\/)?(login|signin|sign-in)(\\/|$)/i.test(path),
            tradingPath: /\\/trades?\\//i.test(path),
            title: document.title || '',
          };
        })()`,
        false,
      );
      const loginRequired = Boolean(probe?.hasPassword || probe?.loginPath);
      const platformReady = !loginRequired
        && Boolean((Number(probe?.canvasCount || 0) > 0 || probe?.hasTradingWords || probe?.tradingPath));
      const chartNoData = Boolean(!loginRequired && probe?.noDataVisible);
      const probedAt = new Date().toISOString();
      this._diag.chart = {
        canvasCount: Number(probe?.canvasCount || 0),
        noDataVisible: Boolean(probe?.noDataVisible),
        marketWatchVisible: Boolean(probe?.marketWatchVisible),
        orderPanelVisible: Boolean(probe?.orderPanelVisible),
        positionsVisible: Boolean(probe?.positionsVisible),
        loginFormVisible: Boolean(probe?.hasPassword),
        tradingPath: Boolean(probe?.tradingPath),
        loginPath: Boolean(probe?.loginPath),
        probedAt,
      };
      this._diag.lastProbeAt = probedAt;
      this._emit({
        connected: !this._status.fatalError && !this._status.error,
        loginRequired,
        platformReady,
        chartNoData,
        capabilities: {
          ...(this._status.capabilities || {}),
          chartCanvas: Number(probe?.canvasCount || 0) > 0,
          loginFormVisible: Boolean(probe?.hasPassword),
          domProbeAt: probedAt,
        },
        title: probe?.title || this._status.title,
        diagnostics: this._snapshotDiagnostics(),
      });
    } catch (_) {
      // DOM probing is best-effort. Broker pages can block scripting at any
      // time; that must never prevent the user from trading manually.
    }
  }

  async probeNow() {
    await this._probeCapabilities();
    return this.getStatus();
  }

  async loadLogin(brokerId, platformId) {
    if (!this.view || this.view.webContents.isDestroyed()) {
      const targetBrokerId = brokerId || this.broker?.id || 'xm';
      const targetPlatformId = platformId || this.platform?.id || undefined;
      await this.open(targetBrokerId, targetPlatformId);
      return { ok: true, created: true, url: this.platform?.url || null };
    }
    if (!this.platform) return { ok: false, reason: 'no_platform' };
    if (typeof this.view.setVisible === 'function') this.view.setVisible(true);
    this._emit({
      loading: true,
      error: null,
      fatalError: false,
      errorCode: null,
      errorDescription: null,
      loginRequired: true,
      platformReady: false,
      chartNoData: false,
    });
    this.view.webContents.loadURL(this.platform.url).catch((err) => {
      if (this._status.fatalError) return;
      this._emit({
        loading: false,
        connected: false,
        fatalError: true,
        error: err?.message || 'Gagal membuka halaman login XM.',
      });
    });
    return { ok: true, url: this.platform.url };
  }

  async open(brokerId, platformId) {
    const broker = getBroker(brokerId);
    if (!broker) throw new Error(`Broker tidak dikenal: ${brokerId}`);
    if (!broker.enabled) throw new Error(`${broker.name} belum diaktifkan pada build ini.`);
    const platform = getPlatform(broker, platformId);
    if (!platform) throw new Error(`Platform ${broker.name} belum memiliki endpoint resmi.`);

    const win = this._window();
    if (!win) throw new Error('Jendela utama UltimateAI tidak tersedia.');

    if (this.view && this.broker?.id === broker.id && this.platform?.id === platform.id) {
      if (typeof this.view.setVisible === 'function') this.view.setVisible(true);
      return this.getStatus();
    }

    this.close();

    const brokerSession = session.fromPartition(broker.partition);
    const view = new WebContentsView({
      webPreferences: {
        partition: broker.partition,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: false,
        backgroundThrottling: true,
      },
    });

    view.setBackgroundColor('#050b16');
    if (typeof view.setVisible === 'function') view.setVisible(false);

    this._diag = this._emptyDiagnostics();
    this.view = view;
    this.broker = broker;
    this.platform = platform;
    this._status = {
      ...this._emptyStatus(),
      brokerId: broker.id,
      platformId: platform.id,
      platformLabel: platform.label,
      url: platform.url,
      title: broker.name,
      loading: true,
      connected: false,
      sessionPersistent: true,
      capabilities: { ...broker.capabilities },
      diagnostics: this._snapshotDiagnostics(),
    };

    try {
      view.webContents.setUserAgent(cleanChromeUserAgent());
    } catch (_) {}

    this._attachWebContentsEvents();
    this._attachNetworkDiagnostics(brokerSession);
    win.contentView.addChildView(view);
    this._attachDebuggerDiagnostics();

    // Pre-warm the persistent partition so cookie reads/writes stay isolated.
    try {
      await brokerSession.cookies.get({});
    } catch (_) {}

    // Record the effective proxy so network failures can be diagnosed without
    // exposing request contents or credentials.
    try {
      brokerSession.resolveProxy(platform.url).then((proxy) => {
        this._diag.proxy = String(proxy || 'DIRECT').slice(0, 160);
        this._scheduleDiagnosticsEmit();
      }).catch(() => {});
    } catch (_) {}

    this._emit({ loading: true });
    view.webContents.loadURL(platform.url).catch((err) => {
      if (this._status.fatalError) return;
      this._emit({
        loading: false,
        connected: false,
        fatalError: true,
        error: err?.message || 'Gagal membuka terminal broker.',
      });
    });

    return this.getStatus();
  }

  setBounds(rect) {
    if (!this.view || this.view.webContents.isDestroyed()) return { ok: false, reason: 'no_view' };
    const win = this._window();
    if (!win) return { ok: false, reason: 'no_window' };

    const x = clampNumber(rect?.x, -10000, 10000, 0);
    const y = clampNumber(rect?.y, -10000, 10000, 0);
    const width = clampNumber(rect?.width, 0, 10000, 0);
    const height = clampNumber(rect?.height, 0, 10000, 0);

    const visible = width > 2 && height > 2;
    this.view.setBounds({ x, y, width, height });
    if (typeof this.view.setVisible === 'function') this.view.setVisible(visible);
    return { ok: true, visible };
  }

  hide() {
    if (this.view && typeof this.view.setVisible === 'function') {
      this.view.setVisible(false);
    }
    return { ok: true };
  }

  reload() {
    if (!this.view || this.view.webContents.isDestroyed()) return { ok: false };
    this.view.webContents.reload();
    return { ok: true };
  }

  goBack() {
    if (!this.view || this.view.webContents.isDestroyed()) return { ok: false };
    if (this.view.webContents.canGoBack()) {
      this.view.webContents.goBack();
      return { ok: true };
    }
    return { ok: false, reason: 'no_history' };
  }

  goForward() {
    if (!this.view || this.view.webContents.isDestroyed()) return { ok: false };
    if (this.view.webContents.canGoForward()) {
      this.view.webContents.goForward();
      return { ok: true };
    }
    return { ok: false, reason: 'no_history' };
  }

  async clearSession() {
    if (!this.broker) return { ok: false, reason: 'no_broker' };
    const partition = this.broker.partition;
    const brokerSession = session.fromPartition(partition);
    await brokerSession.clearStorageData({
      storages: [
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'websql',
        'serviceworkers',
        'cachestorage',
      ],
    });
    try {
      await brokerSession.clearCache();
    } catch (_) {}
    try {
      await brokerSession.clearAuthCache();
    } catch (_) {}
    const loginUrl = this.platform?.url || this.broker.platforms[0]?.url || 'about:blank';
    if (this.view && !this.view.webContents.isDestroyed()) {
      this.view.webContents.loadURL(loginUrl);
    }
    this._diag.lastFailure = null;
    this._emit({
      loading: true,
      error: null,
      fatalError: false,
      errorCode: null,
      errorDescription: null,
      loginRequired: true,
      platformReady: false,
      chartNoData: false,
      connected: false,
      title: this.broker.name,
      url: loginUrl,
      diagnostics: this._snapshotDiagnostics(),
    });
    return { ok: true };
  }

  async capture({ maxWidth = 2200, quality = 0.9 } = {}) {
    if (!this.view || this.view.webContents.isDestroyed()) {
      throw new Error('Workspace broker belum dibuka.');
    }
    const image = await this.view.webContents.capturePage();
    if (!image || image.isEmpty()) {
      throw new Error('Frame broker belum tersedia. Pastikan platform terlihat lalu coba lagi.');
    }
    const size = image.getSize();
    const targetWidth = clampNumber(maxWidth, MIN_CAPTURE_WIDTH, MAX_CAPTURE_WIDTH, 2200);
    const output = size.width > targetWidth ? image.resize({ width: targetWidth }) : image;
    const jpegQuality = clampNumber(Math.round(Number(quality) * 100), 30, 100, 90);
    const buffer = output.toJPEG(jpegQuality);
    const outputSize = output.getSize();
    return {
      dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      capturedAt: new Date().toISOString(),
      width: outputSize.width,
      height: outputSize.height,
      mimeType: 'image/jpeg',
      source: 'electron-webcontents-view',
    };
  }

  async openExternal(brokerId, platformId) {
    const broker = getBroker(brokerId);
    if (!broker) throw new Error('Broker tidak dikenal.');
    const platform = getPlatform(broker, platformId);
    if (!platform) throw new Error('Platform resmi belum tersedia.');
    await shell.openExternal(platform.url);
    return { ok: true, url: platform.url };
  }

  close() {
    if (this._probeTimer) {
      clearTimeout(this._probeTimer);
      this._probeTimer = null;
    }
    if (this._diagnosticsTimer) {
      clearTimeout(this._diagnosticsTimer);
      this._diagnosticsTimer = null;
    }
    this._detachDebuggerDiagnostics();
    this._detachNetworkDiagnostics();
    const view = this.view;
    if (!view) {
      this._diag = this._emptyDiagnostics();
      return { ok: true };
    }
    const win = this._window();
    try {
      if (win) win.contentView.removeChildView(view);
    } catch (_) {}
    try {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.close();
      }
    } catch (_) {}
    this.view = null;
    this.broker = null;
    this.platform = null;
    this._diag = this._emptyDiagnostics();
    this._status = this._emptyStatus();
    this._emit({});
    return { ok: true };
  }

  destroy() {
    try {
      this.close();
    } catch (_) {}
  }
}

module.exports = { BrokerWorkspaceManager };
