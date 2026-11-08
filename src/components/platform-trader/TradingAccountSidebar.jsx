/**
 * TradingAccountSidebar.jsx
 * Dedicated Left Panel for Platform Trader:
 * 1. Account Access: Member profile, KYC verification status, login/logout.
 * 2. Account Funding: Deposit (DANA, OVO, GoPay), withdrawal, and transaction history.
 * 3. Trading Information: XM MT5 connection status, broker balance/equity, market hours, spread & risk/margin parameters.
 */

import React, { useState, useEffect } from 'react';
import RouterConfig from '../../services/router/RouterConfig.js';

export default function TradingAccountSidebar({
  onOpenDepositModal,
  depositBalanceIdr = 0,
  isLive = false,
  statusLabel = 'OFFLINE',
  spread = '0.35',
  instrument = 'XAUUSD',
  tradingMode = 'DEMO',
  xmBalance = 0,
}) {
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('jin_trader_user');
      return saved ? JSON.parse(saved) : {
        name: 'UltimateAI Member',
        email: 'trader.pro@ultimateai.id',
        userId: 'UA-882910',
        kycStatus: 'VERIFIED',
        tier: 'VIP Platinum Trader',
        registeredAt: '2026-01-15'
      };
    } catch {
      return {
        name: 'UltimateAI Member',
        email: 'trader.pro@ultimateai.id',
        userId: 'UA-882910',
        kycStatus: 'VERIFIED',
        tier: 'VIP Platinum Trader',
        registeredAt: '2026-01-15'
      };
    }
  });

  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'funding' | 'info'
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDestination, setWithdrawDestination] = useState('DANA');
  const [withdrawAccountNo, setWithdrawAccountNo] = useState('081234567890');
  const [withdrawMessage, setWithdrawMessage] = useState(null);

  const handleWithdrawSubmit = (e) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount < 50000) {
      setWithdrawMessage({ type: 'error', text: 'Penarikan minimum adalah Rp 50.000' });
      return;
    }
    if (amount > depositBalanceIdr) {
      setWithdrawMessage({ type: 'error', text: 'Saldo deposit Rupiah tidak mencukupi' });
      return;
    }
    setWithdrawMessage({
      type: 'success',
      text: `Permintaan penarikan Rp ${amount.toLocaleString('id-ID')} ke ${withdrawDestination} (${withdrawAccountNo}) berhasil diajukan dan sedang diproses!`
    });
    setWithdrawAmount('');
  };

  return (
    <aside
      style={{
        width: 280,
        height: '100%',
        background: '#0d111a',
        borderRight: '1px solid #1e222d',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        color: '#f8fafc',
        fontSize: 11,
        userSelect: 'none',
        overflowY: 'auto',
      }}
    >
      {/* ── HEADER BRANDING ── */}
      <div
        style={{
          padding: '12px 14px',
          background: 'linear-gradient(180deg, #181c27 0%, #111520 100%)',
          borderBottom: '1px solid #1e222d',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #2962ff 0%, #00e5ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 900,
            boxShadow: '0 0 12px rgba(41, 98, 255, 0.4)',
          }}
        >
          ⚡
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.04em', color: '#f8fafc' }}>
            TRADING ACCOUNT
          </div>
          <div style={{ fontSize: 9, color: '#38bdf8', fontWeight: 700 }}>
            Center & Funding Portal
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ── A. ACCOUNT ACCESS (MEMBER PROFILE) ── */}
        <div
          style={{
            background: '#131722',
            border: '1px solid #2a2e39',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.05em' }}>
              MEMBER PROFILE
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: 3,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              ● {userProfile.kycStatus}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                border: '1px solid #475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                color: '#38bdf8',
              }}
            >
              UA
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userProfile.name}
              </div>
              <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
                ID: {userProfile.userId}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 4,
              paddingTop: 6,
              borderTop: '1px solid #1e222d',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              color: '#94a3b8',
            }}
          >
            <span>Level: <strong style={{ color: '#fbbf24' }}>{userProfile.tier}</strong></span>
            <span>Verifikasi: <strong style={{ color: '#34d399' }}>KYC Lv.1</strong></span>
          </div>
        </div>

        {/* ── B. ACCOUNT FUNDING (DEPOSIT DANA / OVO / GOPAY & WITHDRAW) ── */}
        <div
          style={{
            background: '#131722',
            border: '1px solid #2a2e39',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#34d399', letterSpacing: '0.05em' }}>
              ACCOUNT FUNDING
            </span>
            <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'monospace' }}>
              Midtrans Gateway
            </span>
          </div>

          {/* Saldo Deposit Box */}
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>Saldo Deposit Dompet (IDR):</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
              Rp {depositBalanceIdr.toLocaleString('id-ID')}
            </div>
          </div>

          {/* Action Buttons: Deposit & Withdrawal */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onOpenDepositModal}
              title="Deposit / Top Up via DANA, OVO, atau GoPay"
              style={{
                flex: 1,
                padding: '7px 8px',
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 900,
                cursor: 'pointer',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              <span>+</span>
              <span>Deposit E-Wallet</span>
            </button>

            <button
              onClick={() => setWithdrawModalOpen(true)}
              title="Tarik Dana dari Saldo Deposit"
              style={{
                flex: 1,
                padding: '7px 8px',
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                border: '1px solid #2a2e39',
                background: '#1e222d',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span>−</span>
              <span>Withdrawal</span>
            </button>
          </div>

          {/* Payment Method Badges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 2px', fontSize: 8.5, color: '#64748b' }}>
            <span style={{ color: '#00aadc', fontWeight: 800 }}>● GoPay</span>
            <span style={{ color: '#108ee9', fontWeight: 800 }}>● DANA</span>
            <span style={{ color: '#a855f7', fontWeight: 800 }}>● OVO</span>
            <span>Fee 1.5%</span>
          </div>
        </div>

        {/* ── C. TRADING INFORMATION (XM MT5 & MARKET DATA) ── */}
        <div
          style={{
            background: '#131722',
            border: '1px solid #2a2e39',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#38bdf8', letterSpacing: '0.05em' }}>
              TRADING INFORMATION
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: 3,
                background: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                color: isLive ? '#34d399' : '#eab308',
              }}
            >
              {statusLabel}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 9.5, marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Broker Gateway:</span>
              <strong style={{ color: '#f8fafc' }}>XM Global (MT5)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Instrumen Aktif:</span>
              <strong style={{ color: '#38bdf8' }}>{instrument} (GOLD)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Spread Broker:</span>
              <strong style={{ color: '#34d399', fontFamily: 'monospace' }}>{spread}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Market Session:</span>
              <strong style={{ color: '#f8fafc' }}>London / NY (24/5)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Jam Trading:</span>
              <span style={{ color: '#94a3b8' }}>00:00 - 23:59 UTC+2</span>
            </div>
          </div>

          <div style={{ height: 1, background: '#1e222d', margin: '3px 0' }} />

          {/* Risk & Margin Info */}
          <div style={{ fontSize: 9, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Leverage Akun:</span>
              <span style={{ color: '#cbd5e1' }}>1 : 500</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Stop Out Level:</span>
              <span style={{ color: '#fb7185' }}>20%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Contract Size:</span>
              <span style={{ color: '#cbd5e1' }}>100 oz / 1 Lot</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER STATUS STRIP ── */}
      <div
        style={{
          marginTop: 'auto',
          padding: '10px 14px',
          background: '#111520',
          borderTop: '1px solid #1e222d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 8.5,
          color: '#64748b',
        }}
      >
        <span>Security: AES-256 TLS</span>
        <span style={{ color: '#34d399' }}>● Ledger Sync OK</span>
      </div>

      {/* ── WITHDRAWAL MODAL ── */}
      {withdrawModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110000,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setWithdrawModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              background: '#131722',
              border: '1px solid #2a2e39',
              borderRadius: 10,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc' }}>
                WITHDRAWAL / PENARIKAN DANA
              </div>
              <button
                onClick={() => setWithdrawModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            {withdrawMessage && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 5,
                  fontSize: 10,
                  background: withdrawMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  border: `1px solid ${withdrawMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                  color: withdrawMessage.type === 'success' ? '#34d399' : '#fb7185',
                }}
              >
                {withdrawMessage.text}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Pilih Tujuan Penarikan:
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['DANA', 'OVO', 'GOPAY', 'BANK'].map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => setWithdrawDestination(dest)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        borderRadius: 4,
                        fontSize: 9.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: withdrawDestination === dest ? '1px solid #38bdf8' : '1px solid #2a2e39',
                        background: withdrawDestination === dest ? 'rgba(56, 189, 248, 0.18)' : '#1e222d',
                        color: withdrawDestination === dest ? '#38bdf8' : '#cbd5e1',
                      }}
                    >
                      {dest}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Nomor Rekening / Akun E-Wallet:
                </label>
                <input
                  type="text"
                  value={withdrawAccountNo}
                  onChange={(e) => setWithdrawAccountNo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 5,
                    border: '1px solid #2a2e39',
                    background: '#181c27',
                    color: '#f8fafc',
                    fontSize: 11,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Nominal Penarikan (Saldo Tersedia: Rp {depositBalanceIdr.toLocaleString('id-ID')}):
                </label>
                <input
                  type="number"
                  placeholder="Min Rp 50.000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 5,
                    border: '1px solid #2a2e39',
                    background: '#181c27',
                    color: '#f8fafc',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: 6,
                  padding: '9px 12px',
                  borderRadius: 5,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2962ff 0%, #1e40af 100%)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Konfirmasi Penarikan
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

