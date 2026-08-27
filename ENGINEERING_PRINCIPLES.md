# Engineering Principles (FAR-001)

Dokumen ini merupakan panduan mutlak (Final Architecture Resolution / FAR-001) bagi seluruh insinyur perangkat lunak maupun AI Agent yang menulis kode dalam *codebase* UltimateAI.
Prinsip-prinsip ini harus selalu ditegakkan dalam setiap pengajuan kode (*Pull Request*) dan implementasi fitur.

## 1. Deterministic by Design
Setiap eksekusi harus memberikan hasil yang sama jika diberikan *input* yang sama.
Hindari *state* tersembunyi (*hidden state*) atau logika probabilistik yang memotong batas domain.

## 2. Interface First
Mulailah dari kontrak, bukan implementasi.
Setiap Bounded Context wajib memiliki antarmuka (Interface) yang telah dibekukan di `contracts/` sebelum logika bisnis atau integrasi eksternal mulai ditulis.

## 3. Event First
Gunakan paradigma *Event-Driven* (*Event Bus / Message Queue*) alih-alih pemanggilan metode langsung (*direct method call*) secara sinkron antardomain. Payload *event* adalah perantara komunikasi utama.

## 4. Immutable Data
Seluruh objek transfer data (*DTO*) dan representasi Event (`AutomationEvent`) bersifat mutlak *read-only* (hanya-baca). Proses validasi dan pengayaan (*enrichment*) hanya boleh menghasilkan salinan baru, bukan memodifikasi objek aslinya.

## 5. Zero Vendor Lock-in
Aplikasi dan Runtime tidak boleh mengetahui cara kerja penyedia pihak ketiga.
Dilarang keras menyematkan istilah vendor spesifik (seperti n8n, OpenAI, Supabase, Temporal) di dalam `contracts/` atau `core logic`. Semua komunikasi dengan layanan eksternal harus difasilitasi oleh `adapters/`.

## 6. WorkflowModel is the Canonical Source of Truth
`IWorkflowModel` adalah satu-satunya representasi kanonik (Canonical Workflow Representation). *DSL* (YAML/JSON) bukanlah artefak utama, melainkan **hanya format serialisasi**. AI menghasilkan *Workflow Model* dalam memori; kompilator membaca *Workflow Model*; runtime menjalankan *Workflow Model*.

## 7. AI Generates, Runtime Executes
*Generator AI* tidak bertugas mengeksekusi sistem atau memanggil API pihak ketiga. Tugas utamanya murni memproduksi konfigurasi, *Manifest*, dan *WorkflowModel* yang terlepas dari vendor. Eksekusi adalah tugas eksklusif *Runtime Foundation*.

## 8. Compiler Owns Translation (Parser is just Serialization)
Proses kompilasi dan translasi *Model* ke format spesifik (seperti JSON n8n) berada di bawah *Compiler Pipeline*. Sementara itu, Parser (YAML/JSON to Model) adalah lapisan *Deserialization*, terpisah murni dari tugas *Compiler*.

## 9. Native First (Runtime Foundation)
Secara konseptual maupun teknikal, platform harus selalu diupayakan memiliki kapabilitas pelaksanaan (*Workflow Execution*) secara mandiri (*Native Runtime Foundation*) sebelum bergantung pada mesin eksternal skala *enterprise* (Temporal, Camunda, dsb.). *Native Engine* dikembangkan dengan memperluas kemampuan, bukan mengganti desain.

## 10. Audit Before Optimization
Kejelasan jejak aktivitas (*Auditability*, *Who, When, What, Why*) jauh lebih berharga daripada optimasi kinerja prematur. Audit adalah domain *cross-cutting concern* murni. Setiap transisi wajib menghasilkan *Audit Event* absolut.

## 11. Test Before Feature (Validation Matrix)
Tidak ada fitur baru yang dikembangkan secara massal sebelum kapabilitas arsitekturalnya lulus dari *Validation Matrix* (termasuk *Semantic Validator*). Validator ini bukan sekadar pemeriksa error, melainkan cikal bakal *Workflow Analysis Engine* untuk simulasi dan optimasi.

## 12. The Canonical Pipeline
Rantai rekayasa mutlak platform UltimateAI beroperasi secara kaku tanpa jalan pintas:
`Intent Model ➔ Workflow Model ➔ Analysis ➔ Optimization ➔ Compilation ➔ Compilation Artifact ➔ Compilation Adapter ➔ Target Runtime`.
Logika bisnis tidak diizinkan masuk ke lapisan *Adapter* (*Adapter remains dumb*).

## 13. CompilationArtifact as Intellectual Property
Jika *WorkflowModel* adalah model rekayasanya, maka `ICompilationArtifact` adalah produk puncaknya. Artefak ini bertindak sebagai satu-satunya pusat referensi bagi eksekusi *Runtime*, *Package Registry*, maupun sistem observabilitas.

## 14. Strict CI/CD Governance
Kode tidak boleh di-*merge* ke *main branch* kecuali memenuhi syarat pengujian fondasi:
- *Lossless Serializer Test* lulus (100% deterministik).
- *Optimizer Idempotency* terjamin.
- *Compilation Artifact* terverifikasi.
- Tidak ada cacat kompatibilitas arsitektur (Architecture Compliance Passed).
