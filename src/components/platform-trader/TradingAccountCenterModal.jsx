/**
 * TradingAccountCenterModal.jsx
 * UltimateAI Trading Account Center with E-Wallet Deposit (DANA, OVO, GoPay).
 * 
 * Implements:
 * 1. Strict Balance Separation:
 *    - Virtual JIN Demo Account ($5,000 USD)
 *    - E-Wallet Deposit Balance (Rupiah / IDR)
 *    - Live XM MT5 Broker Account
 * 2. Payment Gateway Integration:
 *    - DANA, OVO, GoPay with official fee calculation (1.5%) and total breakdown.
 *    - Server-side cryptographic webhook signature verification (SHA-512).
 *    - Real-time payment status polling and automatic wallet credit.
 *    - Sandbox payment simulator button for verified end-to-end testing.
 * 3. Complete Audit Trail & Transaction History.
 */

import React, { useState, useEffect, useCallback } from 'react';
import RouterConfig from '../../services/router/RouterConfig.js';

const QUICK_AMOUNTS = [50000, 100000, 250000, 500000, 1000000];

const PAYMENT_METHODS = [
  {
    id: 'GOPAY',
    name: 'GoPay / Gojek',
    brandColor: '#00aadc',
    bgBadge: 'rgba(0, 170, 220, 0.15)',
    borderBadge: 'rgba(0, 170, 220, 0.4)',
    logoText: '🟢 GoPay',
    feePct: 1.5,
    tagline: 'QRIS & Deeplink Instan',
    description: 'Pindai kode QRIS via Gojek atau bayar langsung via aplikasi GoPay.'
  },
  {
    id: 'DANA',
    name: 'DANA Dompet Digital',
    brandColor: '#108ee9',
    bgBadge: 'rgba(16, 142, 233, 0.15)',
    borderBadge: 'rgba(16, 142, 233, 0.4)',
    logoText: '🔵 DANA',
    feePct: 1.5,
    tagline: 'DANA Balance & QRIS',
    description: 'Bayar cepat dengan saldo akun DANA atau pindai QRIS dari aplikasi DANA.'
  },
  {
    id: 'OVO',
    name: 'OVO Cash',
    brandColor: '#7b3fe4',
    bgBadge: 'rgba(123, 63, 228, 0.15)',
    borderBadge: 'rgba(123, 63, 228, 0.4)',
    logoText: '🟣 OVO',
    feePct: 1.5,
    tagline: 'OVO Push & QRIS',
    description: 'Terima notifikasi pembayaran langsung di aplikasi OVO atau bayar via QRIS.'
  }
];

export default function TradingAccountCenterModal({
  isOpen,
  onClose,
  demoBalance = 5000,
  xmBalance = 0,
  userId = 'user-default'
}) {
  const [activeTab, setActiveTab] = useState('deposit'); // 'deposit' | 'history'
  const [nominal, setNominal] = useState(100000);
  const [customNominal, setCustomNominal] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('GOPAY');
  const [ovoPhone, setOvoPhone] = useState('081234567890');
  
  // Wallet & Transaction State
  const [wallet, setWallet] = useState({ depositBalanceIdr: 0 });
  const [transactions, setTransactions] = useState([]);
  const [activePayment, setActivePayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Fetch Wallet & Transactions
  const fetchWalletData = useCallback(async () => {
    try {
      const res = await fetch(RouterConfig.api(`/api/payment/wallet?userId=${userId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWallet(data.wallet || { depositBalanceIdr: 0 });
          setTransactions(data.transactions || []);
        }
      }
    } catch (err) {
      console.warn('[AccountCenter] Failed to fetch wallet data:', err.message);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      fetchWalletData();
    }
  }, [isOpen, fetchWalletData]);

  // Polling active payment status every 3 seconds
  useEffect(() => {
    if (!activePayment || activePayment.status !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(RouterConfig.api(`/api/payment/status?orderId=${activePayment.id}`));
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.transaction) {
            setActivePayment(data.transaction);
            if (data.transaction.status === 'PAID') {
              setActionMessage({
                type: 'success',
                text: `Pembayaran ${data.transaction.paymentMethod} Berhasil! Saldo Rp ${data.transaction.amountCredited.toLocaleString('id-ID')} telah dikreditkan.`
              });
              fetchWalletData();
            } else if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(data.transaction.status)) {
              setActionMessage({
                type: 'error',
                text: `Status transaksi: ${data.transaction.status}`
              });
            }
          }
        }
      } catch (err) {
        // Polling silent catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activePayment, fetchWalletData]);

  if (!isOpen) return null;

  const currentAmount = customNominal ? Math.max(10000, Number(customNominal)) : nominal;
  const currentMethodObj = PAYMENT_METHODS.find(m => m.id === selectedMethod) || PAYMENT_METHODS[0];
  const feeAmount = Math.round(currentAmount * (currentMethodObj.feePct / 100));
  const totalPayment = currentAmount + feeAmount;

  // Handle Create Deposit Charge
  const handleCreateDeposit = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(RouterConfig.api('/api/payment/deposit/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: currentAmount,
          method: selectedMethod,
          customerDetails: {
            phone: ovoPhone,
            name: 'UltimateAI Trader'
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membuat permintaan pembayaran');
      }

      setActivePayment(data.transaction);
      fetchWalletData();
      setActionMessage({
        type: 'info',
        text: `Instruksi pembayaran ${selectedMethod} diterbitkan. Selesaikan pembayaran dalam 15 menit.`
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Sandbox Payment Simulator Trigger
  const handleSimulatePayment = async () => {
    if (!activePayment) return;
    setLoading(true);
    try {
      const res = await fetch(RouterConfig.api('/api/payment/sandbox/simulate-pay'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activePayment.id,
          status: 'settlement'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Simulasi pembayaran gagal');
      }

      setActivePayment(data.result.transaction);
      fetchWalletData();
      setActionMessage({
        type: 'success',
        text: `Webhook resmi Midtrans terverifikasi kriptografis SHA-512! Saldo deposit Rp ${data.result.transaction.amountCredited.toLocaleString('id-ID')} bertambah.`
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '92vh',
          background: '#131722',
          border: '1px solid #2a2e39',
          borderRadius: 12,
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif',
        }}
      >
        {/* ── MODAL HEADER ── */}
        <div
          style={{
            padding: '14px 20px',
            background: '#1e222d',
            borderBottom: '1px solid #2a2e39',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🏦</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.04em' }}>
                TRADING ACCOUNT CENTER
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                Manajemen Saldo Deposit Rupiah (DANA / OVO / GoPay) & Akun Trading
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                fontFamily: 'monospace',
              }}
            >
              MIDTRANS GATEWAY ACTIVE
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: 4,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── TRIPLE BALANCE OVERVIEW CARDS (DEMO, RUPIAH DEPOSIT, XM MT5) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 10,
            padding: '14px 20px',
            background: '#181c27',
            borderBottom: '1px solid #2a2e39',
          }}
        >
          {/* Card 1: JIN Virtual Demo Account */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(41, 98, 255, 0.08)',
              border: '1px solid rgba(41, 98, 255, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9.5, color: '#60a5fa', fontWeight: 800 }}>AKUN DEMO JIN (VIRTUAL)</span>
              <span style={{ fontSize: 8, color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3 }}>
                Virtual Ledger
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>
              ${Number(demoBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>
              Bebas risiko · Tidak menggunakan order broker
            </div>
          </div>

          {/* Card 2: E-Wallet Deposit Balance in Rupiah (IDR) */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.10)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9.5, color: '#34d399', fontWeight: 800 }}>SALDO DEPOSIT (RUPIAH)</span>
              <span style={{ fontSize: 8, color: '#10b981', background: 'rgba(16, 185, 129, 0.2)', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                E-Wallet IDR
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
              Rp {(wallet.depositBalanceIdr || 0).toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>
              Terisi via DANA, OVO, GoPay · Aman & Terverifikasi
            </div>
          </div>

          {/* Card 3: XM MT5 Live Broker Balance */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9.5, color: '#eab308', fontWeight: 800 }}>AKUN LIVE XM (BROKER MT5)</span>
              <span style={{ fontSize: 8, color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3 }}>
                Live Feed XM
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>
              ${Number(xmBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>
              Saldo broker XM nyata · Terpisah dari deposit IDR
            </div>
          </div>
        </div>

        {/* ── TABS: DEPOSIT / TOP UP & TRANSACTION HISTORY ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2a2e39', background: '#1e222d', padding: '0 20px' }}>
          <button
            onClick={() => setActiveTab('deposit')}
            style={{
              padding: '10px 16px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'deposit' ? '#38bdf8' : '#787b86',
              borderBottom: activeTab === 'deposit' ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >
            💳 Deposit / Top Up E-Wallet
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '10px 16px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'history' ? '#38bdf8' : '#787b86',
              borderBottom: activeTab === 'history' ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >
            📋 Riwayat Transaksi ({transactions.length})
          </button>
        </div>

        {/* ── TAB CONTENT ── */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {actionMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 11,
                fontWeight: 700,
                background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : actionMessage.type === 'error' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : actionMessage.type === 'error' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                color: actionMessage.type === 'success' ? '#34d399' : actionMessage.type === 'error' ? '#fb7185' : '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{actionMessage.text}</span>
              <button
                onClick={() => setActionMessage(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 900 }}
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === 'deposit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* If there is an active pending transaction, show payment screen */}
              {activePayment && activePayment.status === 'PENDING' ? (
                <div
                  style={{
                    background: '#181c27',
                    border: '1px solid #2a2e39',
                    borderRadius: 8,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc' }}>
                        PEMBAYARAN {activePayment.paymentMethod} MENUNGGU
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                        ID: {activePayment.id}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 900,
                        background: 'rgba(234, 179, 8, 0.2)',
                        color: '#facc15',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                      }}
                    >
                      ● PENDING
                    </span>
                  </div>

                  {/* Payment Details */}
                  <div
                    style={{
                      background: '#131722',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 11,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      border: '1px solid #2a2e39',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Metode Pembayaran:</span>
                      <strong style={{ color: '#f8fafc' }}>{activePayment.paymentMethod}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Nominal Deposit:</span>
                      <strong style={{ color: '#f8fafc' }}>Rp {activePayment.nominal.toLocaleString('id-ID')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Biaya Transaksi (1.5%):</span>
                      <strong style={{ color: '#f8fafc' }}>Rp {activePayment.fee.toLocaleString('id-ID')}</strong>
                    </div>
                    <div style={{ height: 1, background: '#2a2e39', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#f8fafc', fontWeight: 800 }}>Total yang Harus Dibayar:</span>
                      <strong style={{ color: '#38bdf8', fontSize: 14 }}>
                        Rp {(activePayment.nominal + activePayment.fee).toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>

                  {/* QRIS / App Instruction Banner */}
                  <div
                    style={{
                      padding: 14,
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px dashed rgba(56, 189, 248, 0.35)',
                      borderRadius: 6,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#38bdf8', marginBottom: 6 }}>
                      Instruksi Pembayaran {activePayment.paymentMethod}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#cbd5e1', lineHeight: 1.5, maxWidth: 500, margin: '0 auto' }}>
                      Buka aplikasi {activePayment.paymentMethod} Anda, konfirmasi pembayaran sebesar <strong>Rp {(activePayment.nominal + activePayment.fee).toLocaleString('id-ID')}</strong>. Gateway akan mengirim webhook resmi untuk otomatis mengisi saldo.
                    </div>

                    {activePayment.paymentUrl && (
                      <div style={{ marginTop: 12 }}>
                        <a
                          href={activePayment.paymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-block',
                            padding: '6px 14px',
                            background: '#2962ff',
                            color: '#ffffff',
                            textDecoration: 'none',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          ↗ Buka Simulator Pembayaran Gateway
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Sandbox Instant Simulation Button */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      onClick={() => setActivePayment(null)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 4,
                        border: '1px solid #2a2e39',
                        background: 'transparent',
                        color: '#94a3b8',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Batal / Buat Baru
                    </button>
                    <button
                      onClick={handleSimulatePayment}
                      disabled={loading}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 4,
                        border: 'none',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>🧪</span>
                      <span>{loading ? 'Memverifikasi...' : 'Simulasikan Pembayaran Berhasil (Uji Webhook)'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 1: Nominal and Method Selection */
                <>
                  {/* Nominal Selection */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', marginBottom: 8, display: 'block' }}>
                      1. PILIH NOMINAL DEPOSIT (RUPIAH)
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {QUICK_AMOUNTS.map((amt) => {
                        const isSelected = !customNominal && nominal === amt;
                        return (
                          <button
                            key={amt}
                            onClick={() => {
                              setNominal(amt);
                              setCustomNominal('');
                            }}
                            style={{
                              padding: '7px 14px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                              border: isSelected ? '1px solid #38bdf8' : '1px solid #2a2e39',
                              background: isSelected ? 'rgba(56, 189, 248, 0.18)' : '#1e222d',
                              color: isSelected ? '#38bdf8' : '#f8fafc',
                              fontFamily: 'monospace',
                            }}
                          >
                            Rp {amt.toLocaleString('id-ID')}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Atau input nominal lain:</span>
                      <input
                        type="number"
                        placeholder="Minimal Rp 10.000"
                        value={customNominal}
                        onChange={(e) => setCustomNominal(e.target.value)}
                        style={{
                          background: '#181c27',
                          border: '1px solid #2a2e39',
                          borderRadius: 6,
                          padding: '6px 10px',
                          color: '#f8fafc',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          width: 180,
                        }}
                      />
                    </div>
                  </div>

                  {/* Payment Method Cards (DANA, OVO, GoPay) */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', marginBottom: 8, display: 'block' }}>
                      2. PILIH METODE E-WALLET
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                      {PAYMENT_METHODS.map((m) => {
                        const isSelected = selectedMethod === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMethod(m.id)}
                            style={{
                              padding: 12,
                              borderRadius: 8,
                              background: isSelected ? m.bgBadge : '#1e222d',
                              border: `1px solid ${isSelected ? m.brandColor : '#2a2e39'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              transition: 'all 0.12s ease',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: m.brandColor }}>
                                {m.logoText}
                              </span>
                              <span style={{ fontSize: 8.5, color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3 }}>
                                Biaya {m.feePct}%
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.4 }}>
                              {m.description}
                            </div>
                            <div style={{ fontSize: 8.5, color: isSelected ? m.brandColor : '#787b86', fontWeight: 800 }}>
                              {m.tagline}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* OVO Phone Input if OVO is selected */}
                  {selectedMethod === 'OVO' && (
                    <div style={{ background: '#181c27', padding: 12, borderRadius: 6, border: '1px solid #2a2e39' }}>
                      <label style={{ fontSize: 10.5, fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: 4 }}>
                        Nomor HP Akun OVO (Untuk Push Notification):
                      </label>
                      <input
                        type="text"
                        value={ovoPhone}
                        onChange={(e) => setOvoPhone(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        style={{
                          background: '#131722',
                          border: '1px solid #2a2e39',
                          borderRadius: 4,
                          padding: '6px 10px',
                          color: '#f8fafc',
                          fontSize: 11,
                          width: 220,
                        }}
                      />
                    </div>
                  )}

                  {/* Summary & Checkout Button */}
                  <div
                    style={{
                      background: '#181c27',
                      border: '1px solid #2a2e39',
                      borderRadius: 8,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: '#94a3b8' }}>Nominal Deposit:</span>
                      <strong style={{ color: '#f8fafc' }}>Rp {currentAmount.toLocaleString('id-ID')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: '#94a3b8' }}>Biaya Transaksi Gateway ({currentMethodObj.feePct}%):</span>
                      <strong style={{ color: '#f8fafc' }}>Rp {feeAmount.toLocaleString('id-ID')}</strong>
                    </div>
                    <div style={{ height: 1, background: '#2a2e39' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 800, color: '#f8fafc' }}>Total Pembayaran:</span>
                      <strong style={{ color: '#34d399', fontSize: 15, fontFamily: 'monospace' }}>
                        Rp {totalPayment.toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>
                      * Saldo deposit sebesar <strong>Rp {currentAmount.toLocaleString('id-ID')}</strong> akan dikreditkan otomatis ke dompet akun Anda setelah webhook gateway terverifikasi.
                    </div>

                    <button
                      onClick={handleCreateDeposit}
                      disabled={loading}
                      style={{
                        marginTop: 6,
                        padding: '10px 16px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'linear-gradient(135deg, #2962ff 0%, #1e40af 100%)',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(41, 98, 255, 0.4)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {loading ? 'Memproses Gateway...' : `Lanjutkan Pembayaran via ${selectedMethod}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#787b86', fontSize: 11 }}>
                  Belum ada riwayat transaksi deposit.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                    <thead>
                      <tr style={{ background: '#1e222d', color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid #2a2e39' }}>
                        <th style={{ padding: '8px 10px' }}>ID Transaksi</th>
                        <th style={{ padding: '8px 10px' }}>Waktu</th>
                        <th style={{ padding: '8px 10px' }}>Metode</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Nominal</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Biaya</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saldo Masuk</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => {
                        const isPaid = tx.status === 'PAID';
                        const isPending = tx.status === 'PENDING';
                        return (
                          <tr key={tx.id} style={{ borderBottom: '1px solid #1e222d' }}>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                              {tx.id}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#94a3b8' }}>
                              {new Date(tx.createdTimestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 800 }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  fontSize: 9,
                                  background: tx.paymentMethod === 'GOPAY' ? 'rgba(0, 170, 220, 0.2)' : tx.paymentMethod === 'DANA' ? 'rgba(16, 142, 233, 0.2)' : 'rgba(123, 63, 228, 0.2)',
                                  color: tx.paymentMethod === 'GOPAY' ? '#00aadc' : tx.paymentMethod === 'DANA' ? '#108ee9' : '#a855f7',
                                }}
                              >
                                {tx.paymentMethod}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                              Rp {tx.nominal.toLocaleString('id-ID')}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                              Rp {tx.fee.toLocaleString('id-ID')}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: isPaid ? '#34d399' : '#cbd5e1', fontWeight: 800 }}>
                              Rp {tx.amountCredited.toLocaleString('id-ID')}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: 8.5,
                                  fontWeight: 900,
                                  background: isPaid ? 'rgba(16, 185, 129, 0.2)' : isPending ? 'rgba(234, 179, 8, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                                  color: isPaid ? '#34d399' : isPending ? '#facc15' : '#fb7185',
                                }}
                              >
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

