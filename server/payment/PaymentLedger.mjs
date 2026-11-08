/**
 * PaymentLedger.mjs
 * Persistent Ledger & Wallet Manager for UltimateAI Trading Account Center.
 * 
 * Manages:
 * - Deposit Balance in Indonesian Rupiah (IDR) strictly separate from Demo $5,000 and XM MT5.
 * - Transactions record with idempotency, duplicate notification protection, and audit trail.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEDGER_FILE = path.resolve(__dirname, '../../data/payment_ledger.json');

class PaymentLedger {
  constructor() {
    this.ensureStorage();
    this.data = this.load();
  }

  ensureStorage() {
    const dir = path.dirname(LEDGER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LEDGER_FILE)) {
      const initial = {
        wallets: {
          'user-default': {
            userId: 'user-default',
            depositBalanceIdr: 0,
            currency: 'IDR',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        },
        transactions: [],
        processedWebhookIds: []
      };
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  load() {
    try {
      const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[PaymentLedger] Failed to read ledger file, using in-memory fallback:', err.message);
      return {
        wallets: {
          'user-default': {
            userId: 'user-default',
            depositBalanceIdr: 0,
            currency: 'IDR',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        },
        transactions: [],
        processedWebhookIds: []
      };
    }
  }

  save() {
    try {
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[PaymentLedger] Failed to save ledger file:', err.message);
    }
  }

  getWallet(userId = 'user-default') {
    if (!this.data.wallets[userId]) {
      this.data.wallets[userId] = {
        userId,
        depositBalanceIdr: 0,
        currency: 'IDR',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.save();
    }
    return this.data.wallets[userId];
  }

  createTransaction({
    orderId,
    userId = 'user-default',
    nominal,
    fee = 0,
    amountCredited,
    paymentMethod,
    gatewayReference = null,
    paymentUrl = null,
    qrCodeUrl = null,
    deepLinkUrl = null,
    expiryMinutes = 15
  }) {
    // Check if orderId already exists
    const existing = this.data.transactions.find(t => t.id === orderId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + expiryMinutes * 60000);

    const transaction = {
      id: orderId,
      userId,
      nominal: Math.round(Number(nominal)),
      fee: Math.round(Number(fee)),
      amountCredited: Math.round(Number(amountCredited)),
      paymentMethod, // 'DANA' | 'OVO' | 'GOPAY'
      gatewayReference,
      paymentUrl,
      qrCodeUrl,
      deepLinkUrl,
      status: 'PENDING', // PENDING, PAID, EXPIRED, FAILED, CANCELLED, REFUNDED
      createdTimestamp: now.toISOString(),
      expiryTimestamp: expiryDate.toISOString(),
      paidTimestamp: null,
      auditTrail: [
        {
          timestamp: now.toISOString(),
          fromStatus: null,
          toStatus: 'PENDING',
          reason: `Deposit transaction initialized via ${paymentMethod}`
        }
      ]
    };

    this.data.transactions.unshift(transaction);
    this.save();
    return transaction;
  }

  getTransaction(orderId) {
    return this.data.transactions.find(t => t.id === orderId) || null;
  }

  getUserTransactions(userId = 'user-default') {
    return this.data.transactions.filter(t => t.userId === userId);
  }

  isWebhookProcessed(notificationId) {
    return this.data.processedWebhookIds.includes(notificationId);
  }

  markWebhookProcessed(notificationId) {
    if (!this.data.processedWebhookIds.includes(notificationId)) {
      this.data.processedWebhookIds.push(notificationId);
      // Keep last 500 ids
      if (this.data.processedWebhookIds.length > 500) {
        this.data.processedWebhookIds = this.data.processedWebhookIds.slice(-500);
      }
      this.save();
    }
  }

  updateTransactionStatus(orderId, newStatus, { reason = '', gatewayReference = null, rawPayload = null } = {}) {
    const tx = this.getTransaction(orderId);
    if (!tx) {
      throw new Error(`Transaksi dengan ID ${orderId} tidak ditemukan`);
    }

    const previousStatus = tx.status;

    // Idempotency check: if already in target terminal status, return without re-crediting
    if (previousStatus === newStatus) {
      return { transaction: tx, balanceUpdated: false };
    }

    // Do not allow transitioning out of terminal status PAID or REFUNDED without explicit refund flow
    if (previousStatus === 'PAID' && newStatus !== 'REFUNDED') {
      console.warn(`[PaymentLedger] Transaction ${orderId} already PAID. Ignoring transition to ${newStatus}.`);
      return { transaction: tx, balanceUpdated: false };
    }

    const now = new Date().toISOString();
    tx.status = newStatus;
    if (gatewayReference) tx.gatewayReference = gatewayReference;
    if (newStatus === 'PAID') {
      tx.paidTimestamp = now;
    }

    tx.auditTrail.push({
      timestamp: now,
      fromStatus: previousStatus,
      toStatus: newStatus,
      reason: reason || `Status updated to ${newStatus}`,
      rawPayloadSummary: rawPayload ? { transaction_status: rawPayload.transaction_status, status_code: rawPayload.status_code } : null
    });

    let balanceUpdated = false;

    // Credit wallet balance strictly when changing to PAID
    if (newStatus === 'PAID' && previousStatus !== 'PAID') {
      const wallet = this.getWallet(tx.userId);
      wallet.depositBalanceIdr += tx.amountCredited;
      wallet.updatedAt = now;
      balanceUpdated = true;
      console.log(`[PaymentLedger] Wallet ${tx.userId} successfully credited +Rp ${tx.amountCredited.toLocaleString('id-ID')}. New Balance: Rp ${wallet.depositBalanceIdr.toLocaleString('id-ID')}`);
    }

    // Handle REFUNDED
    if (newStatus === 'REFUNDED' && previousStatus === 'PAID') {
      const wallet = this.getWallet(tx.userId);
      wallet.depositBalanceIdr = Math.max(0, wallet.depositBalanceIdr - tx.amountCredited);
      wallet.updatedAt = now;
      balanceUpdated = true;
      console.log(`[PaymentLedger] Wallet ${tx.userId} refunded -Rp ${tx.amountCredited.toLocaleString('id-ID')}. New Balance: Rp ${wallet.depositBalanceIdr.toLocaleString('id-ID')}`);
    }

    this.save();
    return { transaction: tx, balanceUpdated };
  }

  resetAllForTesting() {
    this.data = {
      wallets: {
        'user-default': {
          userId: 'user-default',
          depositBalanceIdr: 0,
          currency: 'IDR',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      },
      transactions: [],
      processedWebhookIds: []
    };
    this.save();
  }
}

export const paymentLedgerInstance = new PaymentLedger();

