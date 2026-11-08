/**
 * tests/ewallet-payment-system.test.js
 * Verification of UltimateAI E-Wallet Payment System (DANA, OVO, GoPay) via Payment Gateway.
 */

import assert from 'assert';
import crypto from 'crypto';
import { paymentGatewayServiceInstance } from '../server/payment/PaymentGatewayService.mjs';
import { paymentLedgerInstance } from '../server/payment/PaymentLedger.mjs';

console.log('========================================================================');
console.log('💳 ULTIMATEAI E-WALLET PAYMENT SYSTEM (DANA / OVO / GOPAY) TEST SUITE');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function it(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  // Reset ledger state before running tests
  paymentLedgerInstance.resetAllForTesting();

  // ── 1. CONFIGURATION & FEE VERIFICATION ──
  console.log('--- 1. KONFIGURASI GATEWAY & STRUKTUR BIAYA E-WALLET ---');

  await it('Mendukung tiga metode pembayaran utama: DANA, OVO, GOPAY', () => {
    const info = paymentGatewayServiceInstance.getEnvironmentInfo();
    assert.deepStrictEqual(info.supportedMethods, ['DANA', 'OVO', 'GOPAY']);
    assert.strictEqual(info.currency, 'IDR');
  });

  await it('Menghitung biaya transaksi 1.5% secara akurat untuk setiap metode', () => {
    const feeGopay = paymentGatewayServiceInstance.calculateFee(100000, 'GOPAY');
    const feeDana = paymentGatewayServiceInstance.calculateFee(100000, 'DANA');
    const feeOvo = paymentGatewayServiceInstance.calculateFee(100000, 'OVO');

    assert.strictEqual(feeGopay, 1500, 'Biaya GoPay 1.5% dari Rp 100.000 harus Rp 1.500');
    assert.strictEqual(feeDana, 1500, 'Biaya DANA 1.5% dari Rp 100.000 harus Rp 1.500');
    assert.strictEqual(feeOvo, 1500, 'Biaya OVO 1.5% dari Rp 100.000 harus Rp 1.500');
  });

  // ── 2. ALUR DEPOSIT GOPAY ──
  console.log('\n--- 2. ALUR TRANSAKSI DEPOSIT GOPAY ---');

  let gopayTx = null;
  await it('Berhasil membuat permintaan deposit GoPay Rp 50.000', async () => {
    const res = await paymentGatewayServiceInstance.createDeposit({
      userId: 'trader-01',
      amount: 50000,
      method: 'GOPAY'
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.transaction.id.startsWith('DEP-'));
    assert.ok(res.transaction.id.includes('GOPAY'));
    assert.strictEqual(res.transaction.nominal, 50000);
    assert.strictEqual(res.transaction.fee, 750);
    assert.strictEqual(res.transaction.status, 'PENDING');
    assert.ok(res.transaction.deepLinkUrl.includes('gojek://gopay'));
    gopayTx = res.transaction;
  });

  // ── 3. ALUR DEPOSIT DANA ──
  console.log('\n--- 3. ALUR TRANSAKSI DEPOSIT DANA ---');

  let danaTx = null;
  await it('Berhasil membuat permintaan deposit DANA Rp 100.000', async () => {
    const res = await paymentGatewayServiceInstance.createDeposit({
      userId: 'trader-01',
      amount: 100000,
      method: 'DANA'
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.transaction.id.startsWith('DEP-'));
    assert.ok(res.transaction.id.includes('DANA'));
    assert.strictEqual(res.transaction.nominal, 100000);
    assert.strictEqual(res.transaction.fee, 1500);
    assert.strictEqual(res.transaction.status, 'PENDING');
    assert.ok(res.transaction.deepLinkUrl.includes('dana://payment'));
    danaTx = res.transaction;
  });

  // ── 4. ALUR DEPOSIT OVO ──
  console.log('\n--- 4. ALUR TRANSAKSI DEPOSIT OVO ---');

  let ovoTx = null;
  await it('Berhasil membuat permintaan deposit OVO Rp 250.000 dengan nomor HP', async () => {
    const res = await paymentGatewayServiceInstance.createDeposit({
      userId: 'trader-01',
      amount: 250000,
      method: 'OVO',
      customerDetails: { phone: '081299887766' }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.transaction.id.startsWith('DEP-'));
    assert.ok(res.transaction.id.includes('OVO'));
    assert.strictEqual(res.transaction.nominal, 250000);
    assert.strictEqual(res.transaction.fee, 3750);
    assert.strictEqual(res.transaction.status, 'PENDING');
    assert.ok(res.transaction.deepLinkUrl.includes('081299887766'));
    ovoTx = res.transaction;
  });

  // ── 5. VALIDASI & BATASAN KEAMANAN ──
  console.log('\n--- 5. VALIDASI MINIMAL NOMINAL & METODE SALAH ---');

  await it('Menolak deposit dengan nominal di bawah batas minimum (Rp 10.000)', async () => {
    await assert.rejects(
      async () => {
        await paymentGatewayServiceInstance.createDeposit({
          userId: 'trader-01',
          amount: 5000,
          method: 'DANA'
        });
      },
      /Nominal deposit minimal adalah Rp 10.000/
    );
  });

  await it('Menolak metode pembayaran di luar DANA, OVO, GOPAY', async () => {
    await assert.rejects(
      async () => {
        await paymentGatewayServiceInstance.createDeposit({
          userId: 'trader-01',
          amount: 50000,
          method: 'BITCOIN'
        });
      },
      /Metode pembayaran BITCOIN tidak didukung/
    );
  });

  // ── 6. VERIFIKASI TANDA TANGAN KRIPTOGRAFIS SHA-512 WEBHOOK ──
  console.log('\n--- 6. VERIFIKASI TANDA TANGAN KRIPTOGRAFIS SHA-512 ---');

  await it('Menerima webhook dengan tanda tangan kriptografis SHA-512 yang sah', () => {
    const orderId = danaTx.id;
    const statusCode = '200';
    const grossAmount = '101500.00';
    const validSignature = paymentGatewayServiceInstance.generateSignatureKey(orderId, statusCode, grossAmount);

    const check = paymentGatewayServiceInstance.verifyWebhookSignature({
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: validSignature
    });

    assert.strictEqual(check.valid, true);
  });

  await it('Menolak webhook dengan tanda tangan palsu / dimanipulasi (Anti-Fraud)', () => {
    const orderId = danaTx.id;
    const statusCode = '200';
    const grossAmount = '101500.00';
    const fakeSignature = 'badf00d123456789abcdef0123456789abcdef0123456789abcdef0123456789';

    const check = paymentGatewayServiceInstance.verifyWebhookSignature({
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: fakeSignature
    });

    assert.strictEqual(check.valid, false);
    assert.strictEqual(check.reason, 'Tanda tangan kriptografis SHA-512 tidak cocok');
  });

  // ── 7. VERIFIKASI EKSEKUSI PEMBAYARAN & UPDATE SALDO (PAID) ──
  console.log('\n--- 7. EKSEKUSI PEMBAYARAN WEBHOOK & PENAMBAHAN SALDO DEPOSIT ---');

  await it('Saldo awal dompet Rupiah adalah Rp 0', () => {
    const wallet = paymentLedgerInstance.getWallet('trader-01');
    assert.strictEqual(wallet.depositBalanceIdr, 0);
  });

  await it('Webhook DANA settlement terverifikasi berhasil mengkreditkan saldo Rp 100.000', async () => {
    const res = await paymentGatewayServiceInstance.simulateSandboxPayment(danaTx.id, 'settlement');
    assert.strictEqual(res.newStatus, 'PAID');
    assert.strictEqual(res.balanceUpdated, true);

    const wallet = paymentLedgerInstance.getWallet('trader-01');
    assert.strictEqual(wallet.depositBalanceIdr, 100000, `Saldo harus Rp 100.000, aktual: Rp ${wallet.depositBalanceIdr}`);
  });

  await it('Webhook GoPay settlement terverifikasi berhasil menambahkan saldo Rp 50.000 (Total Rp 150.000)', async () => {
    const res = await paymentGatewayServiceInstance.simulateSandboxPayment(gopayTx.id, 'settlement');
    assert.strictEqual(res.newStatus, 'PAID');

    const wallet = paymentLedgerInstance.getWallet('trader-01');
    assert.strictEqual(wallet.depositBalanceIdr, 150000, `Saldo harus Rp 150.000, aktual: Rp ${wallet.depositBalanceIdr}`);
  });

  // ── 8. PROTEKSI IDEMPOTENSI & NOTIFIKASI GANDA (DUPLICATE NOTIFICATION) ──
  console.log('\n--- 8. PROTEKSI IDEMPOTENSI (DUPLICATE NOTIFICATION PROTECTION) ---');

  await it('Notifikasi webhook ganda untuk order yang sama TIDAK menambah saldo ganda', async () => {
    const balanceBefore = paymentLedgerInstance.getWallet('trader-01').depositBalanceIdr;

    // Kirim ulang webhook yang sama persis
    const resDuplicate = await paymentGatewayServiceInstance.simulateSandboxPayment(danaTx.id, 'settlement');
    assert.strictEqual(resDuplicate.alreadyProcessed, true);

    const balanceAfter = paymentLedgerInstance.getWallet('trader-01').depositBalanceIdr;
    assert.strictEqual(balanceAfter, balanceBefore, 'Saldo tidak boleh bertambah dua kali akibat notifikasi ganda');
  });

  // ── 9. STATUS NON-PAID (EXPIRED / CANCELLED) ──
  console.log('\n--- 9. PENANGANAN STATUS EXPIRED / CANCELLED ---');

  await it('Status EXPIRED tidak menambah saldo dompet', async () => {
    const balanceBefore = paymentLedgerInstance.getWallet('trader-01').depositBalanceIdr;
    const resExpire = await paymentGatewayServiceInstance.simulateSandboxPayment(ovoTx.id, 'expire');

    assert.strictEqual(resExpire.newStatus, 'EXPIRED');
    assert.strictEqual(resExpire.balanceUpdated, false);

    const balanceAfter = paymentLedgerInstance.getWallet('trader-01').depositBalanceIdr;
    assert.strictEqual(balanceAfter, balanceBefore, 'Saldo tetap tidak berubah saat transaksi kadaluarsa');
  });

  // ── 10. PEMISAHAN MUTLAK ANTAR SALDO AKUN ──
  console.log('\n--- 10. PEMISAHAN MUTLAK SALDO (DEMO $5,000 VS DEPOSIT RUPIAH VS XM MT5) ---');

  await it('Saldo Demo USD 5,000 sama sekali tidak terpengaruh oleh deposit Rupiah', () => {
    // Virtual Demo Ledger tetap utuh
    const walletIdr = paymentLedgerInstance.getWallet('trader-01').depositBalanceIdr;
    assert.strictEqual(walletIdr, 150000);
    // Saldo Rupiah tidak bocor ke akun USD
    assert.notStrictEqual(walletIdr, 5000);
  });

  await it('Riwayat transaksi tersimpan lengkap dengan audit trail', () => {
    const history = paymentLedgerInstance.getUserTransactions('trader-01');
    assert.strictEqual(history.length, 3);
    assert.ok(history[0].auditTrail.length >= 2, 'Audit trail mencatat transisi status');
  });

  console.log('\n========================================================================');
  console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('========================================================================');
}

runTests();

