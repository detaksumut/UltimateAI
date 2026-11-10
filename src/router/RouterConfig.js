// src/router/RouterConfig.js
// Konfigurasi endpoint router untuk data OHLC XM (MT5_LOCAL_BRIDGE).
export const RouterConfig = {
  getEndpoint: () => {
    return process.env.OHLC_ENDPOINT || 'http://127.0.0.1:20200';
  },
};
