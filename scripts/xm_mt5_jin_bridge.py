#!/usr/bin/env python3
"""Read-only XM MT5 -> UltimateAI JIN OHLC bridge.

Requirements:
  py -3 -m pip install MetaTrader5
  XM MT5 terminal installed, logged in, and open.

This connector only reads quotes/candles. It never submits trading orders.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

try:
    import MetaTrader5 as mt5
except ImportError:
    print("MetaTrader5 package missing. Run: py -3 -m pip install MetaTrader5", file=sys.stderr)
    raise

MT5_PATH = os.environ.get("XM_MT5_PATH", r"C:\Program Files\XM Global MT5\terminal64.exe")
MT5_SYMBOL = os.environ.get("XM_MT5_SYMBOL", "GOLD")
ROUTER_URL = os.environ.get("ULTIMATEAI_ROUTER_URL", "http://127.0.0.1:20200").rstrip("/")
POLL_SECONDS = max(2.0, float(os.environ.get("XM_MT5_POLL_SECONDS", "5")))
HISTORY_BARS = min(500, max(50, int(os.environ.get("XM_MT5_HISTORY_BARS", "300"))))
TIMEFRAMES = {
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}


def iso_utc(epoch_seconds):
    return datetime.fromtimestamp(int(epoch_seconds), tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def post_payload(payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        ROUTER_URL + "/api/trading/ohlc/ingest",
        data=body,
        headers={"Content-Type": "application/json", "Cache-Control": "no-cache"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def resolve_symbol(requested):
    info = mt5.symbol_info(requested)
    if info is not None and mt5.symbol_select(requested, True):
        return requested
    # Broker suffixes vary. Resolve only a symbol whose name clearly starts with
    # the requested gold ticker, rather than silently selecting another asset.
    candidates = mt5.symbols_get()
    matches = [s.name for s in (candidates or []) if s.name.upper() in {"GOLD", "XAUUSD", "GOLD."}
               or s.name.upper().startswith("XAUUSD") or s.name.upper().startswith("GOLD")]
    for name in matches:
        if mt5.symbol_select(name, True):
            print(f"[MT5] requested symbol {requested!r} unavailable; using broker symbol {name!r}")
            return name
    return None


def main():
    if not mt5.initialize(path=MT5_PATH):
        print(f"[MT5] initialize failed: {mt5.last_error()} | path={MT5_PATH}", file=sys.stderr)
        return 2
    try:
        terminal = mt5.terminal_info()
        account = mt5.account_info()
        if terminal is None or account is None:
            print(f"[MT5] terminal/account unavailable: {mt5.last_error()}", file=sys.stderr)
            return 3
        if not terminal.connected:
            print("[MT5] terminal is not connected to the broker. Log in to XM MT5 first.", file=sys.stderr)
            return 4
        symbol = resolve_symbol(MT5_SYMBOL)
        if not symbol:
            print(f"[MT5] gold symbol {MT5_SYMBOL!r} not found in this terminal.", file=sys.stderr)
            return 5

        print(f"[MT5] connected={terminal.connected}; server={account.server}; symbol={symbol}")
        print(f"[JIN] ingest={ROUTER_URL}/api/trading/ohlc/ingest")
        print(f"[JIN] status={ROUTER_URL}/api/trading/ohlc/status?symbol=XAUUSD")
        print("[SAFETY] read-only connector; no order functions are called. Ctrl+C to stop.")

        while True:
            candles = []
            for tf_name, tf_code in TIMEFRAMES.items():
                rates = mt5.copy_rates_from_pos(symbol, tf_code, 0, HISTORY_BARS)
                if rates is None:
                    print(f"[MT5] {tf_name} read failed: {mt5.last_error()}", file=sys.stderr)
                    continue
                for row in rates:
                    candles.append({
                        "symbol": "XAUUSD",
                        "brokerSymbol": symbol,
                        "provider": "XM_GLOBAL_MT5",
                        "timeframe": tf_name,
                        "timestamp": iso_utc(row["time"]),
                        "open": float(row["open"]),
                        "high": float(row["high"]),
                        "low": float(row["low"]),
                        "close": float(row["close"]),
                        "volume": float(row["tick_volume"]),
                        "source": "XM_GLOBAL_MT5",
                        "isSimulated": False,
                    })

            tick = mt5.symbol_info_tick(symbol)
            ticks = []
            if tick is not None and tick.bid > 0 and tick.ask >= tick.bid:
                ticks.append({
                    "symbol": "XAUUSD",
                    "brokerSymbol": symbol,
                    "provider": "XM_GLOBAL_MT5",
                    "bid": float(tick.bid),
                    "ask": float(tick.ask),
                    "spread": float(tick.ask - tick.bid),
                    "timestamp": iso_utc(tick.time),
                    "source": "XM_GLOBAL_MT5",
                })

            try:
                result = post_payload({"candles": candles, "ticks": ticks})
                print(
                    f"[JIN] ok={result.get('ok')} accepted={result.get('accepted', 0)} "
                    f"rejected={result.get('rejected', 0)} "
                    f"timeframes={','.join(result.get('candleSets', [])) or 'NONE'} "
                    f"tick={'LIVE' if ticks else 'NO_TICK'}"
                )
            except (urllib.error.URLError, TimeoutError, ValueError) as exc:
                print(f"[JIN] ingest failed: {exc}", file=sys.stderr)
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("\n[MT5] connector stopped.")
        return 0
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
