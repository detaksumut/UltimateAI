# JIN MT5 OHLC Bridge

This bridge is the numeric candle source for JIN Trading Studio. The TradingView embed is cross-origin and is not treated as a structured OHLC API.

## Install
1. Start UltimateAI LocalRouterServer on the same Windows PC: `npm run serve` from the repository.
2. Open MetaTrader 5 > Tools > Options > Expert Advisors. Enable WebRequest for the listed URL and add exactly: `http://127.0.0.1:20200`.
3. Open MetaEditor, copy `integrations/mt5/JIN_OHLC_Bridge.mq5` into `MQL5/Experts/`, compile it, then attach the EA to the broker's XAUUSD chart. If the broker symbol has a suffix, set `InpBrokerSymbol` to the exact Market Watch symbol; otherwise leave it empty.
4. Enable Algo Trading and ensure MT5 has loaded chart history for H4, H1, M15, M5 and D1. The EA publishes up to 300 bars per timeframe every 5 seconds.
5. Keep MT5 and LocalRouterServer running. Open JIN Trading Studio. The analyst polls the local API and loads real, non-simulated broker candles into MarketDataService.

## Verify
- Open `http://127.0.0.1:20200/api/trading/ohlc/status?symbol=XAUUSD` in the same PC's browser.
- Each timeframe should show a nonzero `count`, a `lastUpdate`, and eventually `freshness: FRESH`.
- Open `http://127.0.0.1:20200/api/trading/ohlc?symbol=XAUUSD&timeframe=M5&limit=5` to inspect candle rows.
- If count remains zero, check MT5's Experts/Journal tab for `WebRequest failed`, symbol spelling, and whether LocalRouterServer is running.

## Data integrity
The LocalRouter endpoint only accepts loopback requests, validates OHLC ranges and allowed symbols/timeframes, and keeps the last 500 bars per symbol/timeframe in memory. Data is cleared when LocalRouterServer restarts; the EA republishes history automatically. Never use simulated candles for live trade confirmation.
