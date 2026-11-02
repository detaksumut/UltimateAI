#!/usr/bin/env python3
"""
Read-only XM MT5 -> UltimateAI JIN OHLC bridge.
Requires the XM MT5 terminal to be installed, logged in, and open.
Does not place, modify, or close trades.
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

try:
    import MetaTrader5 as mt5
except ImportError:
    print("MetaTrader5 Python package missing. Run: py -m pip install MetaTrader5", file=sys.stderr)
    raise

MT5_PATH = os.environ.get("XM_MT5_PATH", r"C:\Program Files\XM Global MT5\terminal64.exe")
MT5_SYMBOL = os.environ.get("XM_MT5_SYMBOL", "GOLD")
ROUTER_URL = os.environ.get("ULTIMATEAI_ROUTER_URL", "http://127.0.0.1:20200")
POLL_SECONDS = max(1.0, float(os.environ.get("XM_MT5_POLL_SECONDS", "3")))
HISTORY_BARS = min(500, max(50, int(os.environ.get("XM_MT5_HISTORY_BARS", "300"))))
TIMEFRAMES = {
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}

def post_payload(payload):
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        ROUTER_URL.rstrip("/") + "/api/trading/ohlc/ingest",
        data=data,
        headers={"Content-Type": "application/json", "Cache-Control": "no-cache"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))

def iso_utc(epoch_seconds):
    return datetime.fromtimestamp(int(epoch_seconds), tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

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
        if not mt5.symbol_select(MT5_SYMBOL, True):
            print(f"[MT5] symbol {MT5_SYMBOL!r} unavailable: {mt5.last_error()}", file=sys.stderr)
            return 4
        print(f"[MT5] connected={terminal.connected}; server={account.server}; account login hidden; symbol={MT5_SYMBOL}")
        print(f"[JIN] ingest endpoint: {ROUTER_URL.rstrip('/')}/api/trading/ohlc/ingest")
        print("[SAFETY] read-only connector; no order functions are called. Ctrl+C to stop.")
        while True:
            candles = []
            for tf_name, tf_code in TIMEFRAMES.items():
                rates = mt5.copy_rates_from_pos(MT5_SYMBOL, tf_code, 0, HISTORY_BARS)
                if rates is None:
                    print(f"[MT5] {tf_name} rates failed: {mt5.last_error()}", file=sys.stderr)
                    continue
                for row in rates:
                    candles.append({
                        "symbol": "XAUUSD",
                        "timeframe": tf_name,
                        "timestamp": iso_utc(row["time"]),
                        "open": float(row["open"]),
                        "high": float(row["high"]),
                        "low": float(row["low"]),
                        "close": float(row["close"]),
                        "volume": float(row["tick_volume"]),
                    })
            tick = mt5.symbol_info_tick(MT5_SYMBOL)
            ticks = []
            if tick is not None and float(tick.bid) > 0 and float(tick.ask) >= float(tick.bid):
                ticks.append({
                    "symbol": "XAUUSD",
                    "bid": float(tick.bid),
                    "ask": float(tick.ask),
                    "timestamp": iso_utc(tick.time),
                })
            try:
                result = post_payload({"candles": candles, "ticks": ticks})
                print(f"[JIN] {datetime.now().strftime('%H:%M:%S')} accepted={result.get('accepted',0)} rejected={result.get('rejected',0)} sets={','.join(result.get('candleSets',[]))} tick={'OK' if ticks else 'NO_TICK'}")
            except Exception as exc:
                print(f"[JIN] ingest failed: {exc}", file=sys.stderr)
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("\n[MT5] connector stopped.")
        return 0
    finally:
        mt5.shutdown()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
