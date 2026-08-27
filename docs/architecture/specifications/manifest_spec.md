# Manifest Specification
**Runtime Metadata Registry Contract (UAI-FB-1.0)**

Setiap runtime wajib menyertakan berkas periferal periferal periferal periferal `runtime.yaml` untuk keperluan verifikasi registry.

---

## 1. Struktur Skema Manifes (YAML Specification)

```yaml
id: "ultimate.runtime.unique-id"
name: "Human Readable Name"
version: "1.0.0"
category: "Domain | Platform | Infrastructure | Support | Integration"
foundation:
  baseline: "UAI-FB-1.0"
  compatibleFrom: "UAI-FB-1.0"
  compatibleUntil: "UAI-FB-1.x"
capabilities:
  - "UniqueCapabilityName"
dependencies:
  - id: "ultimate.runtime.dependency"
    version: ">=1.0"
permissions:
  - "knowledge.read"
  - "bus.emit"
signature:
  publisher: "UltimateAI"
  checksum: "sha256-signature-hash"
  signed: true
```

---

## 2. Pemeriksaan Wajib Registry
*   Jika tanda tangan `signed` bernilai salah atau penerbit bukan `UltimateAI`, pendaftaran ditolak.
*   Jika kecocokan rentang baseline tidak mencakup versi Kernel aktif, pendaftaran ditolak (*BLOCK*).
