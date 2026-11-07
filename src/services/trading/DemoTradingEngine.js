/**
 * DemoTradingEngine.js
 * Virtual Demo Trading Ledger & Execution Engine for JIN AI Trading Analyst.
 * 
 * Initial Balance: $5,000.00 Virtual USD
 * Contract Size for GOLD (XAUUSD): 100 oz per 1.0 Lot ($1 move = $100 per 1 lot, or $1 per 0.01 lot)
 * Margin Calculation: (Lot * 100 * Price) / Leverage (default 100:1 leverage)
 * 
 * Rules:
 * - Pure virtual ledger. NEVER calls mt5.order_send().
 * - Uses real Bid/Ask quotes from live XM MT5 feed for entry and floating P/L.
 * - Handles Open, Partial Close (TP1), Full Close (TP2 or SL or Manual).
 * - Detects SL & TP hits automatically on every live price tick.
 * - Fully persistent in localStorage.
 */

const STORAGE_KEY = 'jin_demo_account_v1';
const INITIAL_BALANCE = 5000.00;
const LEVERAGE = 100;
const CONTRACT_SIZE_GOLD = 100; // 1 lot = 100 oz

export class DemoTradingEngine {
  constructor() {
    this.subscribers = new Set();
    this.state = this.loadState();
    this.lastTick = { bid: null, ask: null, timestamp: null };
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Number.isFinite(parsed.balance)) {
          return {
            balance: parsed.balance,
            equity: parsed.equity ?? parsed.balance,
            freeMargin: parsed.freeMargin ?? parsed.balance,
            usedMargin: parsed.usedMargin ?? 0,
            floatingPl: parsed.floatingPl ?? 0,
            realizedPl: parsed.realizedPl ?? 0,
            openPositions: Array.isArray(parsed.openPositions) ? parsed.openPositions : [],
            history: Array.isArray(parsed.history) ? parsed.history : [],
            updatedAt: parsed.updatedAt || new Date().toISOString()
          };
        }
      }
    } catch (_) {}

    return {
      balance: INITIAL_BALANCE,
      equity: INITIAL_BALANCE,
      freeMargin: INITIAL_BALANCE,
      usedMargin: 0,
      floatingPl: 0,
      realizedPl: 0,
      openPositions: [],
      history: [],
      updatedAt: new Date().toISOString()
    };
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.saveState();
    const snapshot = this.getSnapshot();
    this.subscribers.forEach(cb => {
      try { cb(snapshot); } catch (err) { console.error('[DemoEngine] sub error:', err); }
    });
  }

  getSnapshot() {
    return {
      ...this.state,
      lastTick: this.lastTick
    };
  }

  resetAccount() {
    this.state = {
      balance: INITIAL_BALANCE,
      equity: INITIAL_BALANCE,
      freeMargin: INITIAL_BALANCE,
      usedMargin: 0,
      floatingPl: 0,
      realizedPl: 0,
      openPositions: [],
      history: [],
      updatedAt: new Date().toISOString()
    };
    this.notify();
    return this.getSnapshot();
  }

  /**
   * Update live market tick and recalculate floating P/L, SL/TP hits, and equity.
   */
  updateTick(bid, ask) {
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) {
      return;
    }

    this.lastTick = { bid, ask, timestamp: new Date().toISOString() };
    if (this.state.openPositions.length === 0) {
      if (this.state.floatingPl !== 0 || this.state.usedMargin !== 0) {
        this.state.floatingPl = 0;
        this.state.usedMargin = 0;
        this.state.equity = this.state.balance;
        this.state.freeMargin = this.state.balance;
        this.notify();
      }
      return;
    }

    let totalFloatingPl = 0;
    let totalUsedMargin = 0;
    const positionsToClose = [];

    const updatedPositions = this.state.openPositions.map(pos => {
      const isBuy = pos.side === 'BUY';
      const curPrice = isBuy ? bid : ask;
      const pointDiff = isBuy ? (curPrice - pos.entryPrice) : (pos.entryPrice - curPrice);
      const posFloatingPl = pointDiff * pos.lotSize * CONTRACT_SIZE_GOLD;

      totalFloatingPl += posFloatingPl;
      totalUsedMargin += pos.margin;

      // Check Stop Loss hit
      if (Number.isFinite(pos.stopLoss) && pos.stopLoss > 0) {
        const slHit = isBuy ? (bid <= pos.stopLoss) : (ask >= pos.stopLoss);
        if (slHit) {
          positionsToClose.push({ posId: pos.id, price: pos.stopLoss, reason: 'STOP LOSS (SL HIT)', partialRatio: 1.0 });
        }
      }

      // Check Take Profit 1 hit (partial close if configured, or full close)
      if (Number.isFinite(pos.takeProfit1) && pos.takeProfit1 > 0 && !pos.tp1Hit) {
        const tp1Hit = isBuy ? (bid >= pos.takeProfit1) : (ask <= pos.takeProfit1);
        if (tp1Hit) {
          if (Number.isFinite(pos.takeProfit2) && pos.takeProfit2 > 0) {
            // Partial close 50% at TP1
            positionsToClose.push({ posId: pos.id, price: pos.takeProfit1, reason: 'TAKE PROFIT 1 (PARTIAL 50%)', partialRatio: 0.5 });
          } else {
            // Full close at TP1
            positionsToClose.push({ posId: pos.id, price: pos.takeProfit1, reason: 'TAKE PROFIT (TP HIT)', partialRatio: 1.0 });
          }
        }
      }

      // Check Take Profit 2 hit
      if (Number.isFinite(pos.takeProfit2) && pos.takeProfit2 > 0) {
        const tp2Hit = isBuy ? (bid >= pos.takeProfit2) : (ask <= pos.takeProfit2);
        if (tp2Hit) {
          positionsToClose.push({ posId: pos.id, price: pos.takeProfit2, reason: 'TAKE PROFIT 2 (TP2 HIT)', partialRatio: 1.0 });
        }
      }

      return {
        ...pos,
        currentPrice: curPrice,
        floatingPl: Math.round(posFloatingPl * 100) / 100
      };
    });

    this.state.openPositions = updatedPositions;
    this.state.floatingPl = Math.round(totalFloatingPl * 100) / 100;
    this.state.usedMargin = Math.round(totalUsedMargin * 100) / 100;
    this.state.equity = Math.round((this.state.balance + totalFloatingPl) * 100) / 100;
    this.state.freeMargin = Math.round((this.state.equity - this.state.usedMargin) * 100) / 100;

    // Process any SL/TP automatic executions
    if (positionsToClose.length > 0) {
      positionsToClose.forEach(item => {
        this.closePosition(item.posId, item.price, item.reason, item.partialRatio);
      });
    } else {
      this.notify();
    }
  }

  /**
   * Open a new Demo Position using verified live feed.
   */
  openPosition({
    side = 'BUY',
    instrument = 'XAUUSD',
    lotSize = 0.01,
    entryPrice = null,
    stopLoss = null,
    takeProfit1 = null,
    takeProfit2 = null,
    comment = 'JIN AI DEMO',
    signal = null
  }) {
    const isBuy = String(side).toUpperCase() === 'BUY';
    const volume = Math.max(0.01, parseFloat(lotSize) || 0.01);

    // Get live price if entryPrice not passed or null
    let price = Number.isFinite(entryPrice) ? entryPrice : null;
    if (price === null) {
      if (isBuy && Number.isFinite(this.lastTick.ask)) {
        price = this.lastTick.ask;
      } else if (!isBuy && Number.isFinite(this.lastTick.bid)) {
        price = this.lastTick.bid;
      }
    }

    if (!Number.isFinite(price) || price <= 0) {
      return {
        ok: false,
        error: 'Harga live XM MT5 tidak tersedia. Tidak dapat membuka posisi demo tanpa feed real.'
      };
    }

    // Required margin calculation: (lotSize * 100 * price) / LEVERAGE
    const requiredMargin = (volume * CONTRACT_SIZE_GOLD * price) / LEVERAGE;
    if (this.state.freeMargin < requiredMargin) {
      return {
        ok: false,
        error: `Free Margin tidak mencukupi. Butuh $${requiredMargin.toFixed(2)}, tersedia $${this.state.freeMargin.toFixed(2)}.`
      };
    }

    const positionId = 'DEMO-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
    const newPosition = {
      id: positionId,
      ticket: positionId,
      side: isBuy ? 'BUY' : 'SELL',
      instrument: String(instrument || 'XAUUSD').toUpperCase(),
      lotSize: volume,
      entryPrice: Math.round(price * 100) / 100,
      currentPrice: Math.round(price * 100) / 100,
      stopLoss: Number.isFinite(stopLoss) && stopLoss > 0 ? Math.round(stopLoss * 100) / 100 : null,
      takeProfit1: Number.isFinite(takeProfit1) && takeProfit1 > 0 ? Math.round(takeProfit1 * 100) / 100 : null,
      takeProfit2: Number.isFinite(takeProfit2) && takeProfit2 > 0 ? Math.round(takeProfit2 * 100) / 100 : null,
      margin: Math.round(requiredMargin * 100) / 100,
      floatingPl: 0.00,
      tp1Hit: false,
      comment: String(comment || `JIN AI ${isBuy ? 'BUY' : 'SELL'}`).slice(0, 31),
      signalSummary: signal?.reason || null,
      openedAt: new Date().toISOString()
    };

    this.state.openPositions.push(newPosition);
    this.state.usedMargin = Math.round((this.state.usedMargin + newPosition.margin) * 100) / 100;
    this.state.freeMargin = Math.round((this.state.equity - this.state.usedMargin) * 100) / 100;
    this.state.updatedAt = new Date().toISOString();

    this.notify();

    return {
      ok: true,
      position: newPosition,
      message: `Posisi Demo ${newPosition.side} ${newPosition.lotSize} lot ${newPosition.instrument} @ $${newPosition.entryPrice.toFixed(2)} berhasil dibuka.`
    };
  }

  /**
   * Close a position (Full or Partial).
   * @param {string} positionId
   * @param {number} closePrice
   * @param {string} reason - 'MANUAL' | 'STOP LOSS (SL HIT)' | 'TAKE PROFIT (TP HIT)' | 'TP1 PARTIAL'
   * @param {number} partialRatio - 1.0 = 100% close, 0.5 = 50% partial close
   */
  closePosition(positionId, closePrice = null, reason = 'MANUAL CLOSE', partialRatio = 1.0) {
    const posIndex = this.state.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) {
      return { ok: false, error: 'Posisi tidak ditemukan atau sudah ditutup.' };
    }

    const pos = this.state.openPositions[posIndex];
    const isBuy = pos.side === 'BUY';

    // Determine close price
    let execPrice = Number.isFinite(closePrice) ? closePrice : null;
    if (execPrice === null) {
      execPrice = isBuy ? this.lastTick.bid : this.lastTick.ask;
    }
    if (!Number.isFinite(execPrice) || execPrice <= 0) {
      execPrice = pos.currentPrice || pos.entryPrice;
    }

    const ratio = Math.max(0.1, Math.min(1.0, partialRatio));
    const closingLot = Math.round(pos.lotSize * ratio * 100) / 100;
    const remainingLot = Math.round((pos.lotSize - closingLot) * 100) / 100;

    const pointDiff = isBuy ? (execPrice - pos.entryPrice) : (pos.entryPrice - execPrice);
    const realizedGain = Math.round(pointDiff * closingLot * CONTRACT_SIZE_GOLD * 100) / 100;

    // Record trade history entry
    const historyEntry = {
      id: 'HIST-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000),
      positionId: pos.id,
      side: pos.side,
      instrument: pos.instrument,
      lotSize: closingLot,
      entryPrice: pos.entryPrice,
      closePrice: Math.round(execPrice * 100) / 100,
      realizedPl: realizedGain,
      reason: reason,
      openedAt: pos.openedAt,
      closedAt: new Date().toISOString()
    };

    this.state.balance = Math.round((this.state.balance + realizedGain) * 100) / 100;
    this.state.realizedPl = Math.round((this.state.realizedPl + realizedGain) * 100) / 100;
    this.state.history.unshift(historyEntry);

    if (remainingLot >= 0.01) {
      // Partial close: update position with remaining lot and mark TP1 hit
      const newMargin = (remainingLot * CONTRACT_SIZE_GOLD * pos.entryPrice) / LEVERAGE;
      this.state.openPositions[posIndex] = {
        ...pos,
        lotSize: remainingLot,
        margin: Math.round(newMargin * 100) / 100,
        tp1Hit: true
      };
    } else {
      // Full close: remove from openPositions
      this.state.openPositions.splice(posIndex, 1);
    }

    // Recalculate remaining margins and equity
    let totalFloating = 0;
    let totalUsedMargin = 0;
    this.state.openPositions.forEach(p => {
      totalFloating += p.floatingPl || 0;
      totalUsedMargin += p.margin || 0;
    });

    this.state.floatingPl = Math.round(totalFloating * 100) / 100;
    this.state.usedMargin = Math.round(totalUsedMargin * 100) / 100;
    this.state.equity = Math.round((this.state.balance + totalFloating) * 100) / 100;
    this.state.freeMargin = Math.round((this.state.equity - this.state.usedMargin) * 100) / 100;
    this.state.updatedAt = new Date().toISOString();

    this.notify();

    return {
      ok: true,
      historyEntry,
      message: `Posisi Demo ${pos.side} ${closingLot} lot ditutup pada $${execPrice.toFixed(2)}. P/L: ${realizedGain >= 0 ? '+' : ''}$${realizedGain.toFixed(2)} (${reason}).`
    };
  }
}

export const demoTradingEngineInstance = new DemoTradingEngine();

