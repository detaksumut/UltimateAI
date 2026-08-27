# UltimateAI Engineering Constitution
**Phase E Engineering Guidelines (UAI-FB-1.0)**

Dokumen ini mendefinisikan aturan rekayasa perangkat lunak resmi (*Engineering Constitution*) untuk memandu tim selama pelaksanaan Phase E.

---

## 1. Aturan Commit & Cabang (Commit & Branch Rules)

*   **Satu Sprint = Satu Cabang = Satu Pull Request = Satu Sertifikat.**
*   Pengerjaan setiap sprint harus diisolasi pada cabang git khusus dan hanya digabungkan setelah lolos seluruh audit kelayakan otomatis.

---

## 2. Aturan Pengujian (Testing Requirements)

Setiap modul generator wajib menyertakan:
1.  **Unit Test:** Memvalidasi fungsi internal terkecil secara terisolasi.
2.  **Integration Test:** Menguji interaksi data lintas-lapisan pipeline.
3.  **Benchmark:** Mengukur kecepatan operasional kompilasi.
4.  **Certification Test:** Membuktikan pemenuhan kriteria keluar (*exit criteria*).

---

## 3. Aturan Tinjauan Kode (Code Review Check)

Setiap Pull Request wajib lolos peninjauan empat titik:
*   **Architecture Check:** Memastikan kepatuhan terhadap rancangan *Solution Architecture*.
*   **Contract Check:** Menjamin ketiadaan modifikasi pada interface Foundation.
*   **Determinism Check:** Memverifikasi reproduserabilitas build biner 100%.
*   **Security Check:** Menganalisis ketahanan terhadap ancaman dari *Security Threat Model*.

---

## 4. Alur Kerja Integrasi Berkelanjutan (CI Pipeline Flow)

CI pipeline wajib mengeksekusi tahapan berikut secara runut sebelum penggabungan kode:
```
Linting ──► Build Compilation ──► Test Execution ──► Certification Audit ──► Artifact Generation
```
