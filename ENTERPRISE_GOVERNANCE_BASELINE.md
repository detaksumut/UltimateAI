# Enterprise Architecture Governance Baseline v1.0

**Status:** RATIFIED & FROZEN (Architecture Era Complete)
**Date:** 2026-07-09

> **Paradigm Shift:** UltimateAI bukan lagi sekadar "AI App Generator". UltimateAI telah berevolusi menjadi **Enterprise AI Engineering Platform (EAEP)**.
> Kami tidak sekadar menghasilkan aplikasi, melainkan menghasilkan artefak rekayasa kelas enterprise (manifest, kontrak, model, deployment package, audit trail) yang dapat dikompilasi dan dijalankan pada berbagai target runtime independen.

Dokumen ini merupakan konstitusi tata kelola rekayasa perangkat lunak (Software Engineering Governance) untuk platform UltimateAI. Seluruh pengembangan di masa depan harus tunduk pada konstitusi ini demi mempertahankan stabilitas *Enterprise-Grade*.

## 1. UltimateAI Core Domains (EAEP)
UltimateAI dipartisi menjadi 10 **Domain Inti (Bounded Contexts)** yang setara dan independen:
1. `Intelligence`
2. `Knowledge`
3. `Memory`
4. `Reasoning`
5. `Generator`
6. `Runtime`
7. `Automation`
8. `Deployment`
9. `Observability` (Audit sebagai Cross-Cutting Domain)
10. `Governance`

## 2. Uniform Domain Structure
Setiap Domain Inti wajib mengikuti taksonomi direktori internal yang seragam:
```
domain_name/
├── contracts/
├── catalog/
├── compiler/ (Compilation Layer)
├── serialization/ (YAML/JSON Deserializer)
├── runtime/
├── registry/
├── events/
├── audit/
├── monitoring/
├── tests/
├── fixtures/
└── docs/
```

## 3. Architecture Decision Record (ADR) Governance
Perubahan arsitektural lintas komponen wajib melalui proposal dan pengesahan *Architecture Decision Record (ADR)* dengan penomoran resmi di `docs/architecture/` (misal: ADR-001 Automation Hub).

## 4. Architecture Compliance (CI/CD)
Kepatuhan terhadap batas-batas arsitektur (*Strict Boundaries*) akan ditegakkan secara otomatis melalui pipeline CI/CD (misal: dilarang menyebut n8n di dalam kontrak).

## 5. Definition of Done (DoD)
Sebuah Domain Inti dinyatakan **SELESAI (DONE)** jika:
1. ADR disetujui dan berstatus FROZEN.
2. *Contracts* stabil dan bersifat *vendor-agnostic*.
3. Spesifikasi *Event* tersedia dan terdokumentasi.
4. *Test Fixtures* tersedia.
5. Strategi pengauditan diimplementasikan.
6. Lulus pengujian *Architecture Compliance*.

## 6. Implementation Priorities (Beta Phase)
Berdasarkan deklarasi *Chief Architect*, **EAEP Foundation v1.0 telah berstatus COMPLETE dan FROZEN**. 
Prioritas pengembangan kini bergeser dari pembangunan fondasi menuju fase implementasi *Beta Phase*, yang dipecah menjadi tiga *stream* paralel:

- **Execution Stream:** Native Runtime Enhancement, Package Loader, Execution Context, State Persistence.
- **Observability Stream:** Structured Logging, Metrics, Trace, Audit Dashboard.
- **Integration Stream:** Ekstensi penuh Adapter (n8n, Temporal, Camunda), dan penyusunan Plugin SDK.

Segala perubahan pada kontrak publik fondasi (seperti `IWorkflowModel`, `ICompilationArtifact`) sejak titik ini HANYA diizinkan melalui pengajuan ADR baru yang dilampiri bukti empiris.
Visi siklus *end-to-end* yang menjadi aset intelektual sejati (Intellectual Property) UltimateAI berpusat pada **WorkflowModel sebagai Canonical Object**:

`User Prompt ➔ Intent ➔ Workflow Model ➔ Manifest ➔ Serializer ➔ YAML/JSON (Format Penyimpanan)`
*(AI tidak menghasilkan YAML secara langsung, melainkan menghasilkan Model yang kemudian diserialisasi).*

Eksekusi:
`Workflow Model ➔ Native Runtime Foundation ➔ Audit Event`
ATAU
`Workflow Model ➔ Compiler Translator ➔ Provider Package (n8n JSON) ➔ External Ecosystem`
