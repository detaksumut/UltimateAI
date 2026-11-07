# JIN SCALPING - M1

Panel scalping M1 untuk JIN Trading Studio dan Broker Workspace. Modul ini
bersifat **display-only**: tidak menghasilkan sinyal BUY/SELL, tidak mengubah
strategi, dan tidak mengirim order. Eksekusi tetap manual.

Di Broker Workspace, panel tersedia sebagai tab **SCALPING M1** di samping
**JINI MONITOR** dan **S&D ENGINE**.

## Status implementasi

1. **S&D Engine Phase 1** selesai dan tervalidasi oleh
   `tests/supply-demand-engine.test.mjs`.
2. **Panel Scalping M1** sudah membaca hasil S&D Engine dan OHLC XM
   tervalidasi.
3. **Logika setup scalping** baru sebatas PREVIEW level dari zona M1. Sinyal
   BUY/SELL belum diaktifkan karena aturan strategi scalping belum disetujui.
4. **Preview level di chart**: panel menampilkan chart JIN M1 dari OHLC XM
   tervalidasi dengan zona S&D dan garis Entry/SL/TP skenario demand/supply.
   Chart native XM adalah layer WebContentsView terpisah dan tidak diinjeksi.

## Alur data

```
Sumber XM (pilih salah satu):
  A. Python bridge  : scripts/xm_mt5_jin_bridge.py (MetaTrader5 package)
  B. Expert Advisor : integrations/mt5/JIN_OHLC_Bridge.mq5
  -> POST /api/trading/ohlc/ingest   (loopback only)
  -> LocalRouterServer menyimpan candle + tick di memori
  -> GET /api/trading/ohlc?symbol=...&timeframe=...
  -> xmOhlcClient.js (menolak sumber selain MT5_LOCAL_BRIDGE)
  -> SupplyDemandEngine (validasi candle + deteksi zona)
  -> scalpingM1.js (metrik M1, konteks HTF, preview level)
  -> ScalpingM1Panel.jsx (tampilan)
```

Bridge Python menerbitkan simbol kanonis `XAUUSD` sambil membaca simbol broker
`GOLD` dari XM MT5. Jalankan hanya **satu** bridge (Python atau EA) agar order
tidak diproses ganda.

Jika bridge MT5 offline, server dapat mengembalikan fallback
`LIVE_MARKET_FEED` (mis. Yahoo). Client **menolak** fallback tersebut dan panel
menampilkan `DATA UNAVAILABLE`. Tidak ada data simulasi yang dipakai untuk
klaim live.

## Sumber data per metrik

| Metrik | Sumber | Perhitungan | Jika tidak tersedia |
| --- | --- | --- | --- |
| Trend M1 | OHLC M1 XM (`MT5_LOCAL_BRIDGE`) | EMA 9 vs EMA 21, posisi close terhadap EMA 21, slope EMA dalam ATR | `DATA UNAVAILABLE` |
| Kondisi pasar | OHLC M1 XM | ADX(14); fallback efficiency ratio(20) bila ADX belum cukup | `DATA UNAVAILABLE` |
| Spread | Tick bid/ask XM dari bridge | `ask - bid`, status `WIDE` bila spread > 0.35 x ATR M1 | `DATA UNAVAILABLE` |
| Volatilitas | OHLC M1 XM | ATR(14) dan percentile ATR terhadap 100 sampel terakhir | `DATA UNAVAILABLE` |
| Supply & Demand M1 | S&D Engine Phase 1 dari OHLC M1 XM | Base + displacement, BOS, lifecycle FRESH/TESTED/WEAKENED/INVALID, skor 0-100 | Tidak ada zona dibuat |
| Konteks higher timeframe | S&D Engine Phase 1 dari M5/M15/H1/H4 OHLC XM | Jarak zona ke harga dalam ATR M1; `ALIGNED`/`CONFLICT`; identitas TF dipertahankan | `NO_HTF_CONTEXT` |
| Zona entry potensial | Turunan zona M1 | Proximal zona terdekat sisi DEMAND/SUPPLY | `WAITING_FOR_ZONE` |
| Stop Loss | Turunan zona M1 + buffer | `distal +/- max(0.2 x ATR M1, spread)` | Tidak dibuat |
| Take Profit | Zona lawan / fallback R | Proximal zona lawan; jika tidak valid, fallback 2R | Tidak dibuat |
| Risk/Reward | Turunan entry/SL/TP | `reward / risk`; minimum RR 1.5 | Tidak dibuat |
| Status setup | Aturan modul | Flag data, spread, konflik HTF, ketersediaan zona; strategi belum disetujui | `DATA UNAVAILABLE` |

Setiap section di panel juga menampilkan label `Sumber:` dan panel memiliki
bagian **SUMBER DATA PER METRIK** yang dapat dibuka.

## Aturan integritas data

- Hanya candle dengan `source === MT5_LOCAL_BRIDGE` yang diterima untuk zona live.
- Validasi mencakup simbol, timeframe, timestamp, integritas OHLC, duplikat,
  gap, kelengkapan, dan freshness terhadap tick broker.
- Screenshot / visual capture tidak pernah diubah menjadi OHLC.
- Zona tidak dibuat dari data yang tidak lengkap atau rusak.
- Panel tidak mengklaim data live jika sumber belum tervalidasi.

## Batasan yang disengaja

- Tidak ada sinyal BUY/SELL otomatis.
- Tidak ada auto-order; eksekusi manual.
- Tidak ada penggabungan zona lintas timeframe menjadi satu box anonim; setiap
  zona tetap membawa identitas timeframenya.
- Entry/SL/TP/RR adalah preview, bukan rekomendasi trading.

## Pengujian

```bash
node tests/supply-demand-engine.test.mjs   # 13 checks
node tests/scalping-m1.test.mjs            # 11 checks
node tests/trading-symbols.test.mjs        # 4 checks
```

Backtest opsional (memerlukan bridge MT5 aktif untuk data XM tervalidasi):

```bash
node scripts/backtest-supply-demand.mjs
```

## Troubleshooting S&D "DATA UNAVAILABLE"

Cek status terlebih dahulu:

```powershell
Invoke-RestMethod 'http://127.0.0.1:20200/api/trading/ohlc/status?symbol=XAUUSD'
```

Setiap timeframe harus memiliki `count > 0`. Jika semua `count` adalah 0,
bridge belum berjalan atau MT5 belum terhubung.

### Jalur A - Python bridge (tanpa memasang EA)

Prasyarat: Python 3.12 dengan paket `MetaTrader5`, XM MT5 sudah login.

```powershell
py -3.12 -c "import MetaTrader5 as mt5; print(mt5.__version__)"
$env:XM_MT5_SYMBOL='GOLD'
$env:XM_MT5_DRY_RUN='1'
py -3.12 scripts/xm_mt5_jin_bridge.py
```

Biarkan proses tetap berjalan. Bridge akan membuka MT5, membaca `GOLD`, lalu
mengirim candle M1/M5/M15/H1/H4/D1 dan tick ke router setiap detik. Jangan
menjalankan bridge lebih dari satu instance.

### Jalur B - Expert Advisor

1. Pastikan EA `JIN_OHLC_Bridge` benar-benar menempel pada chart XAUUSD/GOLD di
   MT5, Algo Trading aktif, dan URL `http://127.0.0.1:20200` diizinkan di
   Tools > Options > Expert Advisors.
2. Pastikan tidak ada bridge Python yang berjalan bersamaan.

### Catatan umum

3. Alias simbol dinormalisasi di server: `GOLD`, `GOLD.a`, `XAUUSD.a`, dan
   varian suffix lain dipetakan ke `XAUUSD`. Restart LocalRouterServer setelah
   memperbarui kode server agar pemetaan ini aktif.
4. Jika endpoint mengembalikan `source: LIVE_MARKET_FEED`, panel sengaja
   menolak data tersebut dan menampilkan `NON_XM_SOURCE` / `DATA UNAVAILABLE`.
   Ini bukan bug: feed fallback tidak dipakai untuk zona live.
5. Jika `currentPrice` tampil 0 atau konteks HTF kosong padahal candle ada,
   pastikan `SupplyDemandEngine` menerima tick broker dan tidak mengubah
   `currentPrice: null` menjadi 0.

## Berkas utama

- `src/services/trading/supplyDemand/` - S&D Engine Phase 1.
- `src/services/trading/scalping/scalpingM1.js` - metrik dan preview M1.
- `src/services/trading/scalping/previewLevels.js` - pemetaan Entry/SL/TP ke garis chart.
- `src/components/trading/ScalpingM1Panel.jsx` - panel Trading Studio.
- `src/components/broker-workspace/SupplyDemandOverlayChart.jsx` - chart JIN + zona + level.
- `src/components/trading/TradingStudioModal.jsx` - integrasi panel.
- `integrations/mt5/JIN_OHLC_Bridge.mq5` - EA publisher OHLC + tick XM.
- `server/local_router/LocalRouterServer.mjs` - endpoint OHLC loopback.
