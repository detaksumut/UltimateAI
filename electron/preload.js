// electron/preload.js — Context Bridge
// ───────────────────────────────────────────────────────
// Safely exposes IPC methods to the renderer process.
// The renderer (React app) never has direct Node.js access.
// ───────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ultimateAI', {
  // ── License ──────────────────────────────────────────
  license: {
    activate: (key) => ipcRenderer.invoke('license:activate', key),
    getHardwareId: () => ipcRenderer.invoke('license:getHardwareId'),
    getInfo: () => ipcRenderer.invoke('license:getInfo'),
  },

  // ── Runtime ──────────────────────────────────────────
  runtime: {
    getStatus: () => ipcRenderer.invoke('runtime:status'),
  },

  // ── App Info ─────────────────────────────────────────
  app: {
    isElectron: true,
  },

  // ── Startup Status Events ─────────────────────────────
  onStatus: (callback) => ipcRenderer.on('status', (_event, msg) => callback(msg)),
});
