#!/usr/bin/env python3
"""
XM MT5 -> UltimateAI JIN OHLC Bridge & Order Execution Engine.
Strict Broker Compliance & Audit Integrity:
1. mt5.order_check() strictly produces ORDER_CHECKED (never ORDER_FILLED).
2. retcode 10019 strictly produces ORDER_REJECTED with 'Insufficient funds'.
3. mt5.order_send() only executes after validation succeeds and if live mode is explicitly enabled.
4. History deal & order tickets verified through MT5 history_deals_get().
5. Execution price comes directly from MT5 deal/broker result, never UI estimate.
6. ORDER_FILLED only occurs after broker confirms transaction.
7. Orders older than 10s (e.g. from bridge downtime) expire automatically to prevent delayed execution.
8. Idempotency guard prevents duplicate order execution.
9. Comprehensive audit trail logged for all events.
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
POLL_SECONDS = max(0.5, float(os.environ.get("XM_MT5_POLL_SECONDS", "1.0")))
HISTORY_BARS = min(500, max(50, int(os.environ.get("XM_MT5_HISTORY_BARS", "300"))))
DRY_RUN = os.environ.get("XM_MT5_DRY_RUN", "1").strip().lower() not in ("0", "false", "no")

TIMEFRAMES = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}

# Idempotency cache: set of processed order IDs
PROCESSED_ORDERS = set()

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

def post_order_result(payload):
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        ROUTER_URL.rstrip("/") + "/api/trading/order/result",
        data=data,
        headers={"Content-Type": "application/json", "Cache-Control": "no-cache"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"[BRIDGE AUDIT] Result post failed: {e}", file=sys.stderr)
        return None

def iso_utc(epoch_seconds):
    return datetime.fromtimestamp(int(epoch_seconds), tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def process_order(order):
    order_id = order.get("orderId")
    if not order_id:
        return

    # 1. Idempotency check: Guard against duplicate order execution
    if order_id in PROCESSED_ORDERS:
        print(f"[BRIDGE AUDIT] Duplicate order {order_id} ignored (idempotency guard).")
        return
    PROCESSED_ORDERS.add(order_id)

    # 2. TTL Expiration check: Prevent delayed execution after bridge downtime (max 10s)
    submitted_epoch = float(order.get("submittedAtEpoch") or 0.0)
    now_epoch = time.time()
    if submitted_epoch > 0 and (now_epoch - submitted_epoch > 10.0):
        print(f"[BRIDGE AUDIT] Order {order_id} expired ({now_epoch - submitted_epoch:.1f}s > 10s limit). Dropped.")
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_EXPIRED",
            "retcode": -10,
            "comment": "Order kadaluarsa sebelum eksekusi (usia order > 10 detik). Dibatalkan otomatis.",
            "timestamp": iso_utc(now_epoch),
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": MT5_SYMBOL,
        })
        return

    side = str(order.get("side", "BUY")).upper()
    volume = max(0.01, float(order.get("lotSize") or order.get("volume") or 0.01))
    symbol = MT5_SYMBOL
    order_dry_run = DRY_RUN or order.get("dryRun", True)

    tick = mt5.symbol_info_tick(symbol)
    if tick is None or float(tick.bid) <= 0:
        print(f"[BRIDGE AUDIT] Tick unavailable for {symbol}")
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_REJECTED",
            "retcode": -1,
            "comment": f"Tick harga broker {symbol} tidak tersedia saat eksekusi.",
            "timestamp": iso_utc(now_epoch),
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
        })
        return

    price = float(tick.ask if side == "BUY" else tick.bid)
    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL

    sl_raw = order.get("stopLoss") or order.get("sl")
    tp_raw = order.get("takeProfit") or order.get("tp")
    try:
        sl = float(sl_raw) if sl_raw not in (None, "", "—") else 0.0
    except (ValueError, TypeError):
        sl = 0.0
    try:
        tp = float(tp_raw) if tp_raw not in (None, "", "—") else 0.0
    except (ValueError, TypeError):
        tp = 0.0

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,
        "price": price,
        "deviation": 20,
        "magic": 202611,
        "comment": str(order.get("comment") or f"JIN AI {side}")[:31],
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    if sl > 0:
        request["sl"] = sl
    if tp > 0:
        request["tp"] = tp

    print(f"[BRIDGE AUDIT] [Step 1: order_check] {side} {volume} {symbol} @ {price} (SL={sl}, TP={tp})")
    check_result = mt5.order_check(request)

    if check_result is None:
        err = mt5.last_error()
        print(f"[BRIDGE AUDIT] mt5.order_check failed: {err}")
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_REJECTED",
            "retcode": -2,
            "comment": f"Pemeriksaan broker gagal: {err}",
            "executionPrice": price,
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
            "dryRun": order_dry_run,
            "timestamp": iso_utc(time.time()),
        })
        return

    check_retcode = getattr(check_result, "retcode", 0)
    check_comment = getattr(check_result, "comment", "")
    margin = getattr(check_result, "margin", 0.0)
    balance = getattr(check_result, "balance", 0.0)

    print(f"[BRIDGE AUDIT] Broker Check Result: retcode={check_retcode}, comment='{check_comment}', margin={margin}, balance={balance}")

    # RULE 7: retcode 10019 (TRADE_RETCODE_NO_MONEY) MUST produce ORDER_REJECTED with insufficient funds
    if check_retcode == 10019:
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_REJECTED",
            "retcode": 10019,
            "comment": "Insufficient funds (retcode 10019: No money on broker account)",
            "executionPrice": price,
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "spread": float(tick.ask) - float(tick.bid),
            "margin": margin,
            "balance": balance,
            "dryRun": order_dry_run,
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
            "timestamp": iso_utc(time.time()),
        })
        return

    # If order_check produced any other error retcode (!= 0)
    if check_retcode != 0:
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_REJECTED",
            "retcode": check_retcode,
            "comment": f"Broker check validation rejected: {check_comment} (retcode {check_retcode})",
            "executionPrice": price,
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "spread": float(tick.ask) - float(tick.bid),
            "margin": margin,
            "balance": balance,
            "dryRun": order_dry_run,
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
            "timestamp": iso_utc(time.time()),
        })
        return

    # RULE 1: If dry_run, order_check strictly produces ORDER_CHECKED (NEVER ORDER_FILLED)
    if order_dry_run:
        print(f"[BRIDGE AUDIT] Dry-run validation SUCCESS (retcode 0) -> Status: ORDER_CHECKED")
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_CHECKED",
            "retcode": 0,
            "comment": "Broker validation successful (pre-trade check passed)",
            "executionPrice": price,
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "spread": float(tick.ask) - float(tick.bid),
            "margin": margin,
            "balance": balance,
            "dryRun": True,
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
            "timestamp": iso_utc(time.time()),
        })
        return

    # RULE 2, 3, 4, 5, 6: Live mode execution via mt5.order_send()
    print(f"[BRIDGE AUDIT] [Step 2: order_send] Sending order to XM broker...")
    send_res = mt5.order_send(request)
    if send_res is None:
        err = mt5.last_error()
        print(f"[BRIDGE AUDIT] mt5.order_send failed: {err}")
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_REJECTED",
            "retcode": -3,
            "comment": f"Eksekusi broker order_send gagal: {err}",
            "executionPrice": price,
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
            "dryRun": False,
            "timestamp": iso_utc(time.time()),
        })
        return

    send_retcode = getattr(send_res, "retcode", -1)
    send_comment = getattr(send_res, "comment", "")
    order_ticket = getattr(send_res, "order", 0)
    deal_ticket = getattr(send_res, "deal", 0)

    print(f"[BRIDGE AUDIT] order_send Response: retcode={send_retcode}, comment='{send_comment}', order={order_ticket}, deal={deal_ticket}")

    # RULE 6: ORDER_FILLED ONLY appears after broker confirms transaction (TRADE_RETCODE_DONE = 10009)
    if send_retcode == mt5.TRADE_RETCODE_DONE or send_retcode == 10009:
        # RULE 4 & 5: Verify deal and ticket via MT5 history to get TRUE broker execution price
        actual_price = price
        if deal_ticket > 0:
            deals = mt5.history_deals_get(ticket=deal_ticket)
            if deals and len(deals) > 0:
                actual_price = float(deals[0].price)
                print(f"[BRIDGE AUDIT] Verified deal in MT5 history: ticket={deals[0].ticket}, execPrice={actual_price}")
            else:
                actual_price = float(getattr(send_res, "price", price))

        post_order_result({
            "orderId": order_id,
            "status": "ORDER_FILLED",
            "retcode": send_retcode,
            "comment": f"Transaksi berhasil diisi: {send_comment}",
            "order": order_ticket,
            "deal": deal_ticket,
            "ticket": order_ticket,
            "executionPrice": actual_price,
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "margin": margin,
            "balance": balance,
            "dryRun": False,
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
            "timestamp": iso_utc(time.time()),
        })
    else:
        # Broker rejected order_send
        post_order_result({
            "orderId": order_id,
            "status": "ORDER_REJECTED",
            "retcode": send_retcode,
            "comment": f"Order ditolak broker saat pengiriman: {send_comment} (retcode {send_retcode})",
            "order": order_ticket,
            "deal": deal_ticket,
            "executionPrice": price,
            "provider": "XM_GLOBAL_MT5",
            "brokerSymbol": symbol,
            "dryRun": False,
            "timestamp": iso_utc(time.time()),
        })

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
        print(f"[MT5] connected={terminal.connected}; server={account.server}; login={account.login}; symbol={MT5_SYMBOL}; dry_run={DRY_RUN}")
        print(f"[JIN] ingest endpoint: {ROUTER_URL.rstrip('/')}/api/trading/ohlc/ingest")
        
        while True:
            # Check terminal connection health and reconnect if dropped
            if not mt5.terminal_info() or not mt5.terminal_info().connected:
                print("[MT5] Reconnecting to terminal...")
                mt5.initialize(path=MT5_PATH)
                time.sleep(1)
                continue

            candles = []
            for tf_name, tf_code in TIMEFRAMES.items():
                rates = mt5.copy_rates_from_pos(MT5_SYMBOL, tf_code, 0, HISTORY_BARS)
                if rates is None:
                    continue
                for row in rates:
                    candles.append({
                        "symbol": "XAUUSD",
                        "brokerSymbol": MT5_SYMBOL,
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
            tick = mt5.symbol_info_tick(MT5_SYMBOL)
            ticks = []
            if tick is not None and float(tick.bid) > 0 and float(tick.ask) >= float(tick.bid):
                ticks.append({
                    "symbol": "XAUUSD",
                    "brokerSymbol": MT5_SYMBOL,
                    "provider": "XM_GLOBAL_MT5",
                    "bid": float(tick.bid),
                    "ask": float(tick.ask),
                    "spread": round(float(tick.ask) - float(tick.bid), 3),
                    "timestamp": iso_utc(tick.time),
                    "source": "XM_GLOBAL_MT5",
                })

            try:
                result = post_payload({"candles": candles, "ticks": ticks})
                pending_orders = result.get("pendingOrders") if isinstance(result, dict) else None
                if pending_orders and isinstance(pending_orders, list):
                    for po in pending_orders:
                        process_order(po)
            except Exception as exc:
                print(f"[JIN] Ingest loop error: {exc}", file=sys.stderr)

            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("\n[MT5] connector stopped.")
        return 0
    finally:
        mt5.shutdown()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
