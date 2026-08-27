# Blueprint Specification
**Universal Cognitive Solution Contract (UAI-FB-1.0)**

Blueprint (`IDomainBlueprint`) adalah bahasa perantara tingkat sistem yang merepresentasikan solusi kognitif imutabel.

---

## 1. Struktur Skema JSON (Blueprint Schema)

```json
{
  "blueprintId": "bp-[uuid]",
  "schemaVersion": "1.0",
  "foundationBaseline": "UAI-FB-1.0",
  "domain": "medical | legal | journal",
  "classification": "domain",
  "type": "Reference Blueprint",
  "status": "REGISTERED",
  "analysisId": "analysis-[uuid]",
  "metadata": {
    "createdAt": 1767225600000,
    "createdBy": "Generator Name",
    "foundationBaseline": "UAI-FB-1.0",
    "generatorVersion": "1.0.0",
    "domainVersion": "1.0.0"
  },
  "specification": {
    "database": {},
    "workflow": {},
    "compliance": {},
    "security": {},
    "api": {}
  },
  "blueprintHash": "[sha256-signature]"
}
```

---

## 2. Kebijakan Integritas Hash
*   Hash dihitung menggunakan algoritma SHA-256 dari stringify properti:
    `schemaVersion` + `specification` + `metadata` + `foundationBaseline`.
*   Jika properti tersebut berubah, Registry wajib menolak karena pelanggaran imutabilitas.
