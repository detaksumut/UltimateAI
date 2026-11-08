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

  broker: {
    list: () => ipcRenderer.invoke('broker:list'),
    open: (brokerId, platformId) => ipcRenderer.invoke('broker:open', brokerId, platformId),
    close: () => ipcRenderer.invoke('broker:close'),
    hide: () => ipcRenderer.invoke('broker:hide'),
    setBounds: (rect) => ipcRenderer.invoke('broker:setBounds', rect),
    reload: () => ipcRenderer.invoke('broker:reload'),
    loadLogin: (brokerId, platformId) => ipcRenderer.invoke('broker:loadLogin', brokerId, platformId),
    probe: () => ipcRenderer.invoke('broker:probe'),
    goBack: () => ipcRenderer.invoke('broker:goBack'),
    goForward: () => ipcRenderer.invoke('broker:goForward'),
    clearSession: () => ipcRenderer.invoke('broker:clearSession'),
    capture: (options) => ipcRenderer.invoke('broker:capture', options),
    openExternal: (brokerId, platformId) => ipcRenderer.invoke('broker:openExternal', brokerId, platformId),
    getStatus: () => ipcRenderer.invoke('broker:status'),
    onStatus: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('broker:status', listener);
      return () => ipcRenderer.removeListener('broker:status', listener);
    },
  },

  // ── App Info ─────────────────────────────────────────
  app: {
    isElectron: true,
    getPendingDeepLink: () => ipcRenderer.invoke('app:getPendingDeepLink'),
    onDeepLink: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, link) => callback(link);
      ipcRenderer.on('app:deep-link', listener);
      return () => ipcRenderer.removeListener('app:deep-link', listener);
    },
  },
});
