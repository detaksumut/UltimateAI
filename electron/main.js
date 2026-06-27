// electron/main.js — UltimateAI Electron Main Process
// ────────────────────────────────────────────────────
// Orchestrates: Runtime start → Window creation
// ────────────────────────────────────────────────────

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { RuntimeManager } = require('./runtime');

// ── Constants ──────────────────────────────────────────────────────────────
const IS_DEV = !app.isPackaged;
const APP_NAME = 'UltimateAI';
const ICON_PATH = IS_DEV
  ? path.join(__dirname, '..', 'logo-ultimateAI.png')
  : path.join(process.resourcesPath, 'logo-ultimateAI.png');

// ── State ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let splashWindow = null;
let tray = null;
let runtimeManager = null;
let isQuitting = false;

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

// ── Splash Screen ──────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
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
    mainWindow.loadURL('http://localhost:5180');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load the built frontend served by Express
    mainWindow.loadURL(`http://localhost:${backendPort}`);
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
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
  createSplashWindow();

  // Phase 5.1: Do not implement licensing yet. Skip license check.

  // Step 2: Start runtime (9Router + Express)
  runtimeManager = new RuntimeManager({
    appPath: IS_DEV ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app.asar.unpacked'),
    userDataPath: app.getPath('userData'),
    isDev: IS_DEV,
  });

  try {
    await runtimeManager.start((status) => {
      // Update splash screen with status messages
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('status', status);
      }
    });
  } catch (err) {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    dialog.showErrorBox('Startup Error', `UltimateAI failed to start:\n${err.message}\n\nPlease restart the application.`);
    app.quit();
    return;
  }

  // Step 3: Create main window + tray
  createMainWindow();
  createTray();

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

// ── App Lifecycle ──────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(startApp);

  app.on('before-quit', async () => {
    isQuitting = true;
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
