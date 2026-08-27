# Architecture Decision Record (ADR-001): Automation Hub Platform

**Status:** FROZEN (v1.0) - RATIFIED
**Date:** 2026-07-09
**Context:** UltimateAI Automation Platform
**Authors:** Architecture Board
**Affected Modules:** `src/production/automation/`

## 1. Konteks dan Latar Belakang
UltimateAI bukan sekadar pembuat aplikasi web. Aplikasi penelitian yang dihasilkan (survei, CRM, repositori jurnal) sangat membutuhkan alur kerja otomatisasi tingkat lanjut (seperti pengiriman email, webhook, persetujuan).
Awalnya, diusulkan integrasi langsung ke *engine* seperti n8n. Namun, demi mempertahankan kemurnian arsitektur (Strict Boundaries) dan skalabilitas jangka panjang (Enterprise-Grade), diputuskan bahwa Automation tidak boleh sekadar menjadi modul integrasi. 

**Keputusan Utama:** Automation resmi menjadi **Core Capability Domain** milik UltimateAI, setara dengan Reasoning dan Knowledge. Automation Hub dirancang untuk memiliki *lifecycle* independen: `Design ➔ Compile ➔ Validate ➔ Deploy ➔ Execute ➔ Monitor ➔ Audit ➔ Version`.

## 2. Keputusan Arsitektural (Decisions)

### 2.1 Bounded Context: `automation`
Lokasi: `src/production/automation/`
Tanggung jawabnya mencakup semua aspek otomatisasi internal maupun eksternal. Provider pihak ketiga (n8n, Camunda, Temporal) hanyalah "target kompilasi" dan bukan pusat logika.

### 2.2 Event Versioning & Taxonomy
Semua event wajib mengikuti kontrak taksonomi yang terstruktur. Format nama event dikunci menjadi `<context>.<action>` (misal: `journal.submitted`, `research.created`). 
Seluruh *event* wajib memiliki spesifikasi versi yang absolut.
```json
{
  "spec_version": "1.0",
  "event_id": "uuid",
  "event_type": "journal.submitted",
  "correlation_id": "uuid"
}
```

### 2.3 Pemisahan Manifest dan Workflow
Konfigurasi otomatisasi dibagi menjadi dua entitas terpisah:
- **Automation Manifest (Metadata):** Mengandung identitas, versi, target provider, kebijakan *retry*, dan otorisasi.
- **Workflow Definition (Logika):** Memuat DSL blok eksekusi aktual (`when` kondisi, `then` aksi).

### 2.4 Event Catalog (Data-Driven)
Sumber kebenaran taksonomi event berada dalam `automation/catalog/` dengan format YAML (misal `journal-events.yaml`). YAML digunakan agar generator dan compiler AI dapat membaca, memvalidasi, dan mengekspor dokumen Markdown secara otomatis.

### 2.4.1 State Catalog (Future Requirement)
Generator tidak diizinkan menciptakan representasi *state* secara bebas. Akan dibentuk katalog *state* resmi tingkat *enterprise* (State Catalog) sebagai rujukan kanonik *Workflow Model Generator*. Hal ini untuk memastikan *state* (misal: *Pending*, *Approved*) selalu terstandarisasi.

### 2.5 Expanded Capability Matrix
Setiap provider (*Adapter*) wajib mendeklarasikan *Capability Matrix* yang ekstensif, mencakup:
`supportsWebhook`, `supportsSchedule`, `supportsHumanTask`, `supportsStreaming`, `supportsCompensation`, `supportsTransactions`, `supportsLongRunningWorkflow`, `supportsApprovalWorkflow`, `supportsParallelExecution`, `supportsConditionalBranch`, `supportsSubWorkflow`, dan `supportsEventSubscription`. 
AI akan memilih provider secara analitik berdasarkan skor matriks ini. Prioritas pertama UltimateAI selalu diupayakan menggunakan **Native Provider**.

### 2.6 Credential Provider
Penggantian direktori rahasia menjadi direktori manajemen kredensial (`automation/credential/`) dengan pemisahan komponen: kontrak, *providers*, *vault* abstraksi, dan *resolver*. Hal ini memastikan kesiapan integrasi dengan HashiCorp Vault, AWS Secrets, dll.

### 2.7 Pipeline Compiler & Internal DSL
UltimateAI menggunakan **Automation DSL** internal yang independen dari vendor mana pun.
DSL tersebut kemudian melewati *Pipeline Compiler* dengan tahapan terpisah:
`DSL ➔ Parser ➔ Validator ➔ Optimizer ➔ Provider Translator ➔ Deployment Package`.
Desain ini memastikan optimasi dapat disuntikkan tanpa merombak translator.

### 2.8 Audit & Simulation
- **Audit:** Semua perubahan, deployment, dan rekam jejak eksekusi akan disalurkan ke komponen `automation/audit/`.
- **Simulation:** Komponen `automation/simulation/` memastikan *workflow* tervalidasi dengan mensimulasikan rute DSL terhadap *Fixtures* sebelum dipasang (*deploy*) ke production.

## 3. Konstitusi Arsitektur (Constitutional Rules)
Sebagai lapisan hukum absolut, implementasi selanjutnya **tidak boleh** melanggar 10 pilar berikut:

- **Rule 001 — Event Immutability:** Semua `AutomationEvent` bersifat *immutable*. Proses *enrichment* hanya boleh menghasilkan *copy* yang baru, tidak mengubah *payload* orisinal.
- **Rule 002 — Provider Independence:** `automation/contracts/` wajib 100% *vendor agnostic*. Tidak boleh ada penyebutan entitas spesifik seperti n8n, Temporal, atau Zapier di dalam antarmuka inti.
- **Rule 003 — Compiler Owns Translation:** Provider (Adapter) **tidak** melakukan kompilasi. Alur mutlak: `DSL ➔ Compiler ➔ Provider Package ➔ Provider Engine`.
- **Rule 004 — Catalog Owns Event Names:** Semua tipe *event* yang digunakan *Generator* wajib merujuk ke data terstruktur di dalam `catalog/`. Dilarang menggunakan string *hardcode*.
- **Rule 005 — Manifest Before Workflow:** Siklus hidup rute adalah `Manifest ➔ Workflow ➔ Compile ➔ Deploy`.
- **Rule 006 — AI Never Talks Directly to Provider:** AI Generator hanya menghasilkan *Automation DSL*, bukan menghasilkan *JSON n8n* atau *BPMN* secara langsung.
- **Rule 007 — Every Workflow is Versioned:** Setiap *workflow* wajib memiliki `workflow_id`, `version`, `created_at`, `compatible_spec`, `deprecated`, dan `superseded_by`.
- **Rule 008 — Capability Negotiation:** Runtime memilih target kompilasi berdasarkan evaluasi `Capability Matrix`, bukan dipilih manual.
- **Rule 009 — Native First:** Urutan prioritas penargetan: `Native ➔ Temporal ➔ Camunda ➔ n8n ➔ Make ➔ Zapier`. Visi utama adalah memiliki *Internal Workflow Engine*.
- **Rule 010 — Everything is Auditable:** Setiap aksi wajib memiliki jejak audit: *Who, When, Why, What, Version, Correlation ID, Result*.

## 4. Roadmap Implementasi (Milestone)
Dengan ditetapkannya ADR ini, implementasi akan dibagi ke dalam 4 Milestone absolut:

- **Milestone 1:** Event Specification v1, Event Catalog Lengkap, Manifest Schema, Workflow DSL.
- **Milestone 2:** Parser, Validator, Optimizer.
- **Milestone 3:** Native Compiler, Native Runtime (minimal).
- **Milestone 4:** n8n Translator, Temporal Translator, Camunda Translator.

## 5. Struktur Direktori Utama
```
automation/
├── adapters/
├── audit/
├── catalog/
├── compiler/ (parser/, validator/, optimizer/, translator/)
├── contracts/
├── credential/ (contracts/, providers/, vault/, resolver/)
├── dispatcher/
├── events/
├── execution/
├── fixtures/
├── monitoring/
├── providers/
├── registry/
├── retry/
├── simulation/
├── templates/
└── tests/
```
