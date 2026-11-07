import React, { useState, useEffect } from 'react';
import { demoTradingEngineInstance } from '../../services/trading/DemoTradingEngine.js';

/**
 * OrderConfirmModal
 * Displays a confirmation dialog before submitting a BUY or SELL order.
 * Shows entry price, SL, TP1, TP2, lot size selector, risk estimate, and comment.
 *
 * MODE SEPARATION:
 * - DEMO: Executed strictly on virtual ledger via DemoTradingEngine.
 *   NEVER calls mt5.order_send() or broker endpoints.
 * - LIVE XM: Sends order to MT5 Bridge router endpoint with confirmation.
 */
export default function OrderConfirmModal({
  open = false,
  onClose,
  side = 'BUY',
  instrument = 'XAUUSD',
  signal = null,
  currentPrice = null,
  spread = '—',
  tradingMode = 'DEMO', // 'DEMO' | 'LIVE'
  onConfirm,
}) {
  const [lotSize, setLotSize] = useState('0.01');
  const [comment, setComment] = useState('');
  const [executionStage, setExecutionStage] = useState('IDLE'); // 'IDLE' | 'SENDING' | 'ORDER_CHECKED' | 'ORDER_FILLED' | 'ORDER_REJECTED' | 'BRIDGE_OFFLINE' | 'ERROR'
  const [orderResult, setOrderResult] = useState(null);
  const [orderError, setOrderError] = useState(null);

  const isDemo = tradingMode === 'DEMO';

  useEffect(() => {
    if (open) {
      setLotSize('0.01');
      setComment(isDemo ? `JIN DEMO ${side} ${instrument}` : `JIN AI ${side} ${instrument}`);
      setExecutionStage('IDLE');
      setOrderResult(null);
      setOrderError(null);
    }
  }, [open, side, instrument, isDemo]);

  if (!open) return null;

  const isBuy = side === 'BUY';
  const spreadVal = Number.isFinite(Number(spread)) ? Number(spread) : 0;
  const bid = Number.isFinite(currentPrice) ? currentPrice : null;
  const ask = bid !== null ? bid + spreadVal : null;
  const entryPrice = isBuy ? ask : bid;

  const displayEntry = entryPrice !== null
    ? entryPrice.toFixed(2)
    : (Number.isFinite(signal?.entry) ? signal.entry.toFixed(2) : '—');

  const sl  = Number.isFinite(signal?.stopLoss)    ? signal.stopLoss.toFixed(2)    : '—';
  const tp1 = Number.isFinite(signal?.takeProfit1) ? signal.takeProfit1.toFixed(2) : '—';
  const tp2 = Number.isFinite(signal?.takeProfit2) ? signal.takeProfit2.toFixed(2) : '—';
  const rrRatio = signal?.riskReward || '—';
  const confidence = Number.isFinite(signal?.confidence) ? `${signal.confidence}%` : '—';

  const lotVal = Math.max(0, parseFloat(lotSize) || 0);
  let estRisk = '—';
  let estProfit = '—';
  if (entryPrice && Number.isFinite(signal?.stopLoss) && lotVal > 0) {
    const pipsDiff = Math.abs(entryPrice - signal.stopLoss);
    const pipsProfit = Number.isFinite(signal?.takeProfit1) ? Math.abs(entryPrice - signal.takeProfit1) : null;
    const perLot = 100;
    estRisk   = `$${(pipsDiff * lotVal * perLot).toFixed(2)}`;
    if (pipsProfit !== null) {
      estProfit = `$${(pipsProfit * lotVal * perLot).toFixed(2)}`;
    }
  }

  const handleConfirm = async () => {
    setExecutionStage('SENDING');
    setOrderError(null);

    // ── 1. DEMO MODE EXECUTION (VIRTUAL LEDGER ONLY) ──
    if (isDemo) {
      // Simulate quick 300ms realistic processing delay
      await new Promise(r => setTimeout(r, 300));

      const parsedEntry = entryPrice !== null ? entryPrice : (Number.isFinite(signal?.entry) ? signal.entry : null);
      if (!Number.isFinite(parsedEntry) || parsedEntry <= 0) {
        setExecutionStage('ERROR');
        setOrderError('Harga live feed XM MT5 tidak tersedia. Tidak dapat membuka posisi demo.');
        return;
      }

      const res = demoTradingEngineInstance.openPosition({
        side,
        instrument,
        lotSize: lotVal,
        entryPrice: parsedEntry,
        stopLoss: sl !== '—' ? Number(sl) : null,
        takeProfit1: tp1 !== '—' ? Number(tp1) : null,
        takeProfit2: tp2 !== '—' ? Number(tp2) : null,
        comment: comment.trim() || `JIN DEMO ${side}`,
        signal,
      });

      if (!res.ok) {
        setExecutionStage('ORDER_REJECTED');
        setOrderError(res.error || 'Gagal membuka posisi demo.');
        return;
      }

      const orderData = {
        side,
        instrument,
        entry: res.position.entryPrice,
        lotSize: res.position.lotSize,
        ticket: res.position.ticket,
        mode: 'DEMO',
        timestamp: new Date().toISOString()
      };

      try {
        window.dispatchEvent(new CustomEvent('jin:order-confirmed', { detail: orderData }));
      } catch (_) {}

      if (typeof onConfirm === 'function') {
        try { onConfirm(orderData); } catch (_) {}
      }

      setOrderResult({
        ticket: res.position.ticket,
        orderId: res.position.ticket,
        brokerSymbol: res.position.instrument,
        executionPrice: res.position.entryPrice,
        retcode: 10009,
        status: 'ORDER_FILLED',
        comment: 'Virtual Ledger FILLED (Saldo $5,000, 0 Risk)',
        margin: res.position.margin,
        isDemo: true
      });
      setExecutionStage('ORDER_FILLED');
      return;
    }

    // ── 2. LIVE XM BROKER EXECUTION (BRIDGE CALL) ──
    const idempotencyKey = 'IDEM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const orderData = {
      side,
      instrument,
      entry: displayEntry,
      lotSize: lotVal,
      volume: lotVal,
      stopLoss: sl !== '—' ? Number(sl) : null,
      takeProfit: tp1 !== '—' ? Number(tp1) : null,
      takeProfit2: tp2 !== '—' ? Number(tp2) : null,
      comment: comment.trim() || `JIN AI ${side}`,
      idempotencyKey,
      dryRun: false,
      signal: signal,
      mode: 'LIVE',
      timestamp: new Date().toISOString(),
    };

    try {
      window.dispatchEvent(new CustomEvent('jin:order-confirmed', { detail: orderData }));
    } catch (_) {}

    if (typeof onConfirm === 'function') {
      try { onConfirm(orderData); } catch (_) {}
    }

    try {
      const res = await fetch('http://127.0.0.1:20200/api/trading/order/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const submitRes = await res.json();
      if (!submitRes.ok) {
        if (submitRes.status === 'BRIDGE_OFFLINE') {
          setExecutionStage('BRIDGE_OFFLINE');
          setOrderError(submitRes.error || 'Bridge MT5 tidak terhubung.');
        } else {
          setExecutionStage('ORDER_REJECTED');
          setOrderError(submitRes.error || 'Order ditolak sistem broker.');
        }
        return;
      }

      const orderId = submitRes.orderId;

      let resolved = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        try {
          const statusRes = await fetch(`http://127.0.0.1:20200/api/trading/order/status?orderId=${encodeURIComponent(orderId)}`);
          if (!statusRes.ok) continue;
          const statusData = await statusRes.json();
          const brokerOrder = statusData.order;

          if (brokerOrder && ['ORDER_FILLED', 'ORDER_CHECKED', 'ORDER_REJECTED'].includes(brokerOrder.status)) {
            setOrderResult(brokerOrder);
            setExecutionStage(brokerOrder.status);
            resolved = true;
            break;
          }
        } catch (_) {}
      }

      if (!resolved) {
        setExecutionStage('ORDER_CHECKED');
        setOrderResult({
          orderId,
          status: 'ORDER_SENT',
          comment: 'Order diterima antrean MT5. Menunggu konfirmasi terminal.',
          executionPrice: Number(displayEntry) || bid
        });
      }
    } catch (err) {
      setExecutionStage('ERROR');
      setOrderError(err?.message || 'Gagal menghubungi server bridge');
    }
  };

  const accentColor  = isBuy ? '#34d399' : '#fb7185';
  const accentBright = isBuy ? '#10b981' : '#f43f5e';
  const bgGlow       = isBuy ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)';
  const borderColor  = isBuy ? 'rgba(16,185,129,0.4)'  : 'rgba(244,63,94,0.4)';
  const btnGrad      = isBuy
    ? 'linear-gradient(135deg, #16a34a 0%, #065f46 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #9f1239 100%)';
  const btnShadow    = isBuy ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)';

  const LOT_PRESETS = ['0.01', '0.05', '0.10', '0.50'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Konfirmasi order ${side} ${instrument}`}
      onClick={e => { if (e.target === e.currentTarget && executionStage !== 'SENDING') onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 20000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(10px)',
        padding: 16,
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'linear-gradient(180deg, #071a2c 0%, #030f1e 100%)',
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: `0 24px 60px rgba(0,0,0,0.85), 0 0 50px ${bgGlow}`,
      }}>
        {/* ── Header ── */}
        <div style={{
          background: bgGlow,
          borderBottom: `1px solid ${borderColor}`,
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: isBuy ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
              border: `1px solid ${borderColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              {isBuy ? '📈' : '📉'}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: accentColor, letterSpacing: '0.08em' }}>
                {side} {instrument}
              </div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 8.5,
                  fontWeight: 900,
                  background: isDemo ? 'rgba(0, 229, 255, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  color: isDemo ? '#00e5ff' : '#fb7185',
                  border: `1px solid ${isDemo ? 'rgba(0, 229, 255, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
                }}>
                  {isDemo ? '🎯 DEMO VIRTUAL' : '⚡ LIVE BROKER'}
                </span>
                <span>{isDemo ? 'Virtual Ledger ($5,000)' : 'XM Global MT5 (GOLD)'}</span>
                <span>•</span>
                <span>{new Date().toLocaleTimeString('id-ID')} WIB</span>
              </div>
            </div>
          </div>
          {executionStage !== 'SENDING' && (
            <button
              onClick={onClose}
              aria-label="Tutup"
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#64748b', cursor: 'pointer',
                fontSize: 16, width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >×</button>
          )}
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>

          {/* ── Live Execution Feedback Card ── */}
          {executionStage === 'SENDING' && (
            <div style={{
              background: 'rgba(0, 229, 255, 0.08)',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              borderRadius: 8, padding: '12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#00e5ff', marginBottom: 4 }}>
                ⏳ Mengirim Order ke Bridge MT5...
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>
                Menghubungkan ke terminal XM Global MT5 untuk verifikasi broker
              </div>
            </div>
          )}

          {executionStage === 'ORDER_CHECKED' && orderResult && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 8, padding: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 900, color: '#34d399' }}>
                  ✓ ORDER TERVERIFIKASI BROKER
                </span>
                <span style={{ fontSize: 8.5, background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: 4, color: '#34d399', fontWeight: 800 }}>
                  DRY-RUN CHECKED
                </span>
              </div>
              <div style={{ fontSize: 9.5, color: '#cbd5e1', lineHeight: 1.6 }}>
                <div>• Provider: <strong>XM Global MT5</strong> (Simbol: <strong>{orderResult.brokerSymbol || 'GOLD'}</strong>)</div>
                <div>• Kuotasi Eksekusi: <strong style={{ color: '#00e5ff' }}>${orderResult.executionPrice?.toFixed(2)}</strong> (Spread: {orderResult.spread?.toFixed(2) ?? '0.55'})</div>
                <div>• Status Broker: <strong>Retcode {orderResult.retcode}</strong> ({orderResult.comment})</div>
                <div>• Margin Dibutuhkan: <strong>${orderResult.margin?.toFixed(2) ?? '4.06'}</strong> | Saldo: <strong>${orderResult.balance?.toFixed(2) ?? '-22.50'}</strong></div>
              </div>
            </div>
          )}

          {executionStage === 'ORDER_FILLED' && orderResult && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.6)',
              borderRadius: 8, padding: '12px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#34d399', marginBottom: 4 }}>
                ✓ ORDER FILLED (EKSEKUSI BERHASIL)
              </div>
              <div style={{ fontSize: 9.5, color: '#cbd5e1', lineHeight: 1.5 }}>
                <div>Tiket / Deal ID: <strong>#{orderResult.deal || orderResult.order || 'MT5-FILL'}</strong></div>
                <div>Harga Eksekusi: <strong>${orderResult.executionPrice?.toFixed(2)}</strong></div>
              </div>
            </div>
          )}

          {(executionStage === 'ORDER_REJECTED' || executionStage === 'BRIDGE_OFFLINE' || executionStage === 'ERROR') && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.5)',
              borderRadius: 8, padding: '12px',
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: '#fb7185', marginBottom: 4 }}>
                ✕ {executionStage === 'BRIDGE_OFFLINE' ? 'BRIDGE MT5 OFFLINE' : 'ORDER DITOLAK BROKER'}
              </div>
              <div style={{ fontSize: 9, color: '#cbd5e1', lineHeight: 1.5 }}>
                {orderError || orderResult?.comment || 'Koneksi ke broker terputus.'}
              </div>
            </div>
          )}

          {/* ── Price Info Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
            {[
              { label: isBuy ? 'Ask (Entry BUY)' : 'Bid (Entry SELL)', value: displayEntry, color: accentColor },
              { label: 'Stop Loss', value: sl, color: '#fb7185' },
              { label: 'Take Profit 1', value: tp1, color: '#34d399' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(2,6,23,0.7)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '8px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 7.5, color: '#64748b', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── TP2, R:R, Confidence ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
            {[
              { label: 'Take Profit 2', value: tp2, color: '#6ee7b7' },
              { label: 'Risk : Reward', value: rrRatio, color: '#00e5ff' },
              { label: 'Confidence AI', value: confidence, color: '#a78bfa' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(2,6,23,0.7)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '8px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 7.5, color: '#64748b', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── Lot Size Selector ── */}
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 5 }}>
              Volume (Lot Size)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr) auto', gap: 5 }}>
              {LOT_PRESETS.map(v => (
                <button
                  key={v}
                  disabled={executionStage === 'SENDING'}
                  onClick={() => setLotSize(v)}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 7,
                    border: `1px solid ${lotSize === v ? accentBright : 'rgba(255,255,255,0.08)'}`,
                    background: lotSize === v ? bgGlow : 'rgba(2,6,23,0.6)',
                    color: lotSize === v ? accentColor : '#64748b',
                    fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                    cursor: executionStage === 'SENDING' ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {v}
                </button>
              ))}
              <input
                type="number" min="0.01" step="0.01"
                disabled={executionStage === 'SENDING'}
                value={lotSize}
                onChange={e => setLotSize(e.target.value)}
                style={{
                  width: 56, padding: '7px 6px', borderRadius: 7,
                  border: '1px solid rgba(0,229,255,0.25)',
                  background: 'rgba(2,6,23,0.8)',
                  color: '#00e5ff', fontSize: 10, fontFamily: 'monospace',
                  outline: 'none', textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* ── Risk / Profit Estimate ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7,
            background: 'rgba(2,6,23,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8, padding: '9px 12px',
          }}>
            <div>
              <div style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Estimasi Risiko (SL)</div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                {estRisk}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Estimasi Profit (TP1)</div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                {estProfit}
              </div>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div style={{ display: 'grid', gridTemplateColumns: executionStage === 'IDLE' ? '1fr 1.6fr' : '1fr', gap: 9, marginTop: 2 }}>
            {executionStage === 'IDLE' ? (
              <>
                <button
                  onClick={onClose}
                  style={{
                    padding: '11px', borderRadius: 9,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(2,6,23,0.6)',
                    color: '#94a3b8', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  ✕ Batal
                </button>
                <button
                  onClick={handleConfirm}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
                  style={{
                    padding: '11px', borderRadius: 9,
                    border: `1px solid ${accentBright}`,
                    background: btnGrad,
                    color: '#fff', fontSize: 12, fontWeight: 900,
                    cursor: 'pointer', letterSpacing: '0.06em',
                    boxShadow: `0 6px 20px ${btnShadow}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  ✓ KIRIM ORDER {side}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                disabled={executionStage === 'SENDING'}
                style={{
                  padding: '11px', borderRadius: 9,
                  border: '1px solid rgba(0,229,255,0.3)',
                  background: 'rgba(0,229,255,0.12)',
                  color: '#00e5ff', fontSize: 11.5, fontWeight: 800,
                  cursor: executionStage === 'SENDING' ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {executionStage === 'SENDING' ? '⏳ Menunggu Broker...' : '✕ Tutup Jendela Konfirmasi'}
              </button>
            )}
          </div>

          {/* Attribution Notice */}
          <div style={{ fontSize: 8, color: '#334155', textAlign: 'center', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 7 }}>
            {isDemo ? (
              <span style={{ color: '#38bdf8' }}>
                Mode Eksekusi: <strong>Virtual Demo Ledger ($5,000)</strong>. Tanpa pemanggilan mt5.order_send() — aman tanpa risiko finansial.
              </span>
            ) : (
              <span>
                Rute Eksekusi: <strong>XM Global MT5</strong> via Local Router. Kuotasi terverifikasi langsung dari broker.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
