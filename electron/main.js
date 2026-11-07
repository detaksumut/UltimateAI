// electron/main.js — UltimateAI Electron Main Process
// ────────────────────────────────────────────────────
// Orchestrates: Runtime start → Window creation
// ────────────────────────────────────────────────────

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { RuntimeManager } = require('./runtime');
const { BrokerWorkspaceManager } = require('./broker/BrokerWorkspaceManager.cjs');
const {
  BROKER_DEEP_LINK_PROTOCOL,
  parseBrokerDeepLink,
} = require('./broker/broker-deep-link.cjs');

// ── Constants ──────────────────────────────────────────────────────────────
const IS_DEV = !app.isPackaged;
const APP_NAME = 'UltimateAI';
const DEV_SERVER_URL = process.env.ULTIMATEAI_DEV_URL
  || process.env.VITE_DEV_SERVER_URL
  || 'http://localhost:5177';
const ICON_PATH = IS_DEV
  ? path.join(__dirname, '..', 'logo-ultimateAI.png')
  : path.join(process.resourcesPath, 'logo-ultimateAI.png');

// ── State ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let runtimeManager = null;
let brokerWorkspace = null;
let isQuitting = false;
let pendingBrokerDeepLink = null;

if (process.env.ULTIMATEAI_USER_DATA_DIR) {
  try {
    app.setPath('userData', path.resolve(process.env.ULTIMATEAI_USER_DATA_DIR));
  } catch (_) {}
}

function findBrokerDeepLink(argv = []) {
  return argv.find((arg) => typeof arg === 'string'
    && arg.toLowerCase().startsWith(`${BROKER_DEEP_LINK_PROTOCOL}://`));
}

function rememberBrokerDeepLink(raw) {
  const parsed = parseBrokerDeepLink(raw);
  if (parsed.ok) pendingBrokerDeepLink = parsed;
  return parsed;
}

function dispatchBrokerDeepLink(raw) {
  const parsed = rememberBrokerDeepLink(raw);
  if (!parsed.ok) return parsed;

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    pendingBrokerDeepLink = null;
    try {
      mainWindow.webContents.send('app:deep-link', parsed);
    } catch (_) {}
  }
  return parsed;
}

function registerBrokerDeepLinkProtocol() {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(
        BROKER_DEEP_LINK_PROTOCOL,
        process.execPath,
        [path.resolve(process.argv[1])],
      );
    } else {
      app.setAsDefaultProtocolClient(BROKER_DEEP_LINK_PROTOCOL);
    }
  } catch (err) {
    console.warn('[DeepLink] Gagal mendaftarkan protokol:', err?.message || err);
  }
}

// ── Window State Management ────────────────────────────────────────────────
function getWindowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized()) return;
  const bounds = mainWindow.getBounds();
  fs.writeFileSync(getWindowStateFile(), JSON.stringify(bounds));
}

function restoreWindowState() {
  try {
    const bounds = JSON.parse(fs.readFileSync(getWindowStateFile(), 'utf8'));
    return bounds;
  } catch (e) {
    return { width: 1400, height: 900 }; // defaults
  }
}

// ── Main Window ────────────────────────────────────────────────────────────
function createMainWindow() {
  const bounds = restoreWindowState();

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: APP_NAME,
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const backendPort = runtimeManager ? runtimeManager.expressPort : 3001;

  if (IS_DEV) {
    // In dev mode, load from Vite dev server
    mainWindow.loadURL(DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load the built frontend served by Express
    mainWindow.loadURL(`http://localhost:${backendPort}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingBrokerDeepLink) {
      try {
        mainWindow.webContents.send('app:deep-link', pendingBrokerDeepLink);
      } catch (_) {}
    }
  });

  mainWindow.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame && brokerWorkspace) brokerWorkspace.hide();
  });
  mainWindow.webContents.on('render-process-gone', () => {
    if (brokerWorkspace) brokerWorkspace.hide();
  });

  // Save bounds before closing
  mainWindow.on('close', (e) => {
    saveWindowState();
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Application Menu ───────────────────────────────────────────────────────
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── System Tray ────────────────────────────────────────────────────────────
function createTray() {
  try {
    const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open UltimateAI',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'AI Status',
      sublabel: 'Checking...',
      enabled: false,
      id: 'ai-status'
    },
    { type: 'separator' },
    {
      label: 'Quit UltimateAI',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip(`${APP_NAME} — Ready`);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Startup Sequence ───────────────────────────────────────────────────────
async function startApp() {
  createAppMenu();

  // Step 2: Start runtime (Express)
  runtimeManager = new RuntimeManager({
    appPath: IS_DEV ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app.asar.unpacked'),
    userDataPath: app.getPath('userData'),
    isDev: IS_DEV,
  });

  try {
    await runtimeManager.start();
  } catch (err) {
    dialog.showErrorBox('Startup Error', `UltimateAI failed to start:\n${err.message}\n\nPlease restart the application.`);
    app.quit();
    return;
  }

  // Step 3: Create main window + tray
  createMainWindow();
  createTray();

  brokerWorkspace = new BrokerWorkspaceManager({
    getWindow: () => mainWindow,
    appVersion: app.getVersion(),
  });

  // Step 4: Start health monitoring
  runtimeManager.startHealthCheck((healthy) => {
    if (tray) {
      tray.setToolTip(healthy ? `${APP_NAME} — Ready` : `${APP_NAME} — AI Reconnecting...`);
    }
  });
}

// ── IPC Handlers ───────────────────────────────────────────────────────────
ipcMain.handle('runtime:status', () => {
  if (!runtimeManager) return { status: 'not_started' };
  return runtimeManager.getStatus();
});

ipcMain.handle('app:getPendingDeepLink', () => {
  const link = pendingBrokerDeepLink;
  pendingBrokerDeepLink = null;
  return link;
});

function requireBrokerWorkspace() {
  if (!brokerWorkspace) throw new Error('Broker Workspace belum siap.');
  return brokerWorkspace;
}

ipcMain.handle('broker:list', () => requireBrokerWorkspace().listBrokers());
ipcMain.handle('broker:open', (_event, brokerId, platformId) => requireBrokerWorkspace().open(brokerId, platformId));
ipcMain.handle('broker:close', () => requireBrokerWorkspace().close());
ipcMain.handle('broker:hide', () => requireBrokerWorkspace().hide());
ipcMain.handle('broker:setBounds', (_event, rect) => requireBrokerWorkspace().setBounds(rect));
ipcMain.handle('broker:reload', () => requireBrokerWorkspace().reload());
ipcMain.handle('broker:loadLogin', (_event, brokerId, platformId) => requireBrokerWorkspace().loadLogin(brokerId, platformId));
ipcMain.handle('broker:probe', () => requireBrokerWorkspace().probeNow());
ipcMain.handle('broker:goBack', () => requireBrokerWorkspace().goBack());
ipcMain.handle('broker:goForward', () => requireBrokerWorkspace().goForward());
ipcMain.handle('broker:clearSession', () => requireBrokerWorkspace().clearSession());
ipcMain.handle('broker:capture', (_event, options) => requireBrokerWorkspace().capture(options));
ipcMain.handle('broker:openExternal', (_event, brokerId, platformId) => requireBrokerWorkspace().openExternal(brokerId, platformId));
ipcMain.handle('broker:status', () => requireBrokerWorkspace().getStatus());

// ── App Lifecycle ──────────────────────────────────────────────────────────
registerBrokerDeepLinkProtocol();
const initialBrokerDeepLink = findBrokerDeepLink(process.argv);
if (initialBrokerDeepLink) rememberBrokerDeepLink(initialBrokerDeepLink);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const deepLink = findBrokerDeepLink(commandLine);
    if (deepLink) dispatchBrokerDeepLink(deepLink);

    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    dispatchBrokerDeepLink(url);
  });

  app.whenReady().then(startApp);

  app.on('before-quit', async () => {
    isQuitting = true;
    if (brokerWorkspace) {
      brokerWorkspace.destroy();
    }
    if (runtimeManager) {
      await runtimeManager.stop();
    }
  });

  app.on('window-all-closed', () => {
    // On Windows, don't quit when all windows close (tray keeps running)
    // Only quit if isQuitting is true
    if (isQuitting || process.platform !== 'win32') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}
