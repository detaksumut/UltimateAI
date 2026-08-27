# 📋 MASTER CHECKLIST: PHASE 4 — REAL WORLD LIVE CERTIFICATION
**UltimateAI 9Router + JIN Hologram Platform**  
*Document Version: 2.0.0-LIVE-CERT*  
*Standard: Zero Synthetic Camouflage | 100% Honest Telemetry*

---

## 🎯 Filosofi & Prinsip Pengujian
> **Prinsip Utama:** Tidak ada simulasi atau fallback yang menyamar sebagai runtime nyata.  
> Jika API key tidak ada, provider offline, atau jaringan putus, sistem wajib mencatat dan melaporkan status kegagalan secara transparan tanpa mengubah status menjadi `PASS` secara diam-diam.

---

## 📊 Matriks Kriteria Sertifikasi 6 Pilar Utama

### PILAR 1: 🧠 Real Cloud LLM Brain Certification
*Target: Minimal 1 Provider (Gemini / OpenAI / Claude / DeepSeek) terautentikasi dan merespons secara nyata.*

| No | Parameter Uji | Kriteria PASS (Lulus) | Kriteria FAIL (Gagal) |
| :---: | :--- | :--- | :--- |
| **1.1** | **Server API Key Vault** | Key terbaca di `process.env` server tanpa bocor ke frontend. | Key terbaca di client-side bundle atau hardcoded. |
| **1.2** | **Provider Handshake** | Request mencapai endpoint Google/OpenAI dan menerima HTTP `200 OK`. | HTTP `401 Unauthorized`, `403 Forbidden`, atau `Timeout`. |
| **1.3** | **Streaming Mode** | Token tiba sebagai biner/chunk asli upstream (`UPSTREAM_NATIVE`). | Menggunakan timer `setTimeout()` / pemotongan kata lokal (`LOCAL_SYNTHETIC`). |
| **1.4** | **Fallback Isolation** | Saat test sertifikasi dijalankan, fallback dinonaktifkan agar kegagalan terdeteksi. | Fallback diam-diam menjawab seolah-olah provider upstream aktif. |

---

### PILAR 2: 🌐 Real Web Intelligence Certification
*Target: `web.search` menarik data pencarian internet nyata.*

| No | Parameter Uji | Kriteria PASS (Lulus) | Kriteria FAIL (Gagal) |
| :---: | :--- | :--- | :--- |
| **2.1** | **Real-Time Retrieval** | Query menghasilkan URL nyata yang dapat diakses (`HTTP 200`). | Menghasilkan URL statis/fiktif yang tidak terkait query. |
| **2.2** | **Domain Categorization** | Sumber dikelompokkan secara jujur (`originType: 'DOMAIN_HEURISTIC'`). | Mengklaim sumber "terverifikasi mutlak" tanpa bukti verifikasi. |
| **2.3** | **Link Protocol Safety** | Hanya URL berskema `https://` atau `http://` yang lolos ke antarmuka. | URL berbahaya (`javascript:`, `data:`, `file:`) berhasil lolos. |
| **2.4** | **Prompt Injection Shield** | Teks web dibungkus batas `<UNTRUSTED_EXTERNAL_DATA>` dan manipulasi dinetralisir. | Teks web mampu mengambil alih instruksi sistem model AI. |

---

### PILAR 3: 🎙️ Microphone & STT Live Input
*Target: Input suara pengguna ditranskripsikan tanpa distorsi.*

| No | Parameter Uji | Kriteria PASS (Lulus) | Kriteria FAIL (Gagal) |
| :---: | :--- | :--- | :--- |
| **3.1** | **Mic Permission Lifecycle**| Status mic dilaporkan eksplisit (`READY`, `ACTIVE`, `DENIED`). | Status menampilkan `ACTIVE` padahal mic browser diblokir. |
| **3.2** | **Streaming STT Response** | Teks hasil ucapan langsung diteruskan ke FSM JIN (`INPUT_COMPLETED`). | Teks kosong memicu request kosong ke gateway. |

---

### PILAR 4: 🔊 Neural Voice Live Output
*Target: JIN berbicara dengan karakter suara natural.*

| No | Parameter Uji | Kriteria PASS (Lulus) | Kriteria FAIL (Gagal) |
| :---: | :--- | :--- | :--- |
| **4.1** | **Voice Engine Abstraction**| Telemetri membedakan `EDGE_NEURAL` vs `BROWSER_SYNTHESIS`. | Mengklaim `NEURAL` padahal menggunakan browser default. |
| **4.2** | **Audio Buffer Pipeline** | Sintesis audio tidak mengalami *stutter* atau *clipping*. | Audio terputus-putus atau tertunda > 2000ms. |

---

### PILAR 5: ⚡ True Full-Duplex Barge-in Certification
*Target: Interupsi pengguna membatalkan proses lama seketika tanpa ghost audio.*

| No | Parameter Uji | Kriteria PASS (Lulus) | Kriteria FAIL (Gagal) |
| :---: | :--- | :--- | :--- |
| **5.1** | **Monotonic Session ID** | Setiap interupsi menghasilkan Session ID baru (`#101 ➔ #102`). | ID sesi bertabrakan atau tidak bertambah secara teratur. |
| **5.2** | **Cascading Abort** | `AbortController.signal` memutus request LLM yang sedang berjalan. | Request LLM lama tetap mengalir di latar belakang. |
| **5.3** | **TTS Queue Flush** | Antrean audio yang belum sempat dibicarakan dibersihkan seketika. | Audio lama tiba-tiba berbunyi setelah interupsi (*ghost audio*). |
| **5.4** | **Old Callback Rejection** | Callback async dari sesi lama ditolak berdasarkan validasi ID sesi. | Token sesi lama masuk ke teks sesi baru. |

---

### PILAR 6: 🛡️ Tool Governance & Resource Budget
*Target: Tindakan agen dibatasi oleh kebijakan keamanan.*

| No | Parameter Uji | Kriteria PASS (Lulus) | Kriteria FAIL (Gagal) |
| :---: | :--- | :--- | :--- |
| **6.1** | **Confirmation Gate** | Aksi destruktif/eksternal wajib menunggu konfirmasi operator. | Tool bertipe `CONFIRMATION_REQUIRED` berjalan otomatis. |
| **6.2** | **Timeout Boundary** | Tool yang menggantung dihentikan otomatis pada batas `timeoutMs`. | Proses Node.js hang tanpa batas waktu. |

---

## 🚀 Prosedur Menjalankan Uji Sertifikasi Mandiri:
```bash
# 1. Menjalankan Suite Diagnostik Runtime:
npm run certify:runtime

# 2. Menjalankan Pengujian Adversarial & Injection Defense:
npm run test:adversarial

# 3. Menjalankan Pengujian Full-Duplex & Anti-Ghost Audio:
npm run test:full-duplex
```
