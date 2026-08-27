# Architecture Baseline

## The Golden Path (Urutan Membaca Resmi)
Agar insinyur perangkat lunak maupun AI Agent yang baru berkontribusi tidak kebingungan, silakan ikuti urutan membaca (*onboarding*) berikut secara sekuensial:

1. [Enterprise Governance Baseline](file:///d:/Users/ultimateai/ENTERPRISE_GOVERNANCE_BASELINE.md)
2. [Architecture Baseline](file:///d:/Users/ultimateai/ARCHITECTURE_BASELINE.md) (Dokumen ini)
3. [Engineering Principles (FAR-001)](file:///d:/Users/ultimateai/ENGINEERING_PRINCIPLES.md)
4. [ADR Index / Master](file:///d:/Users/ultimateai/ROADMAP.md) (Rujukan sentral)
5. Domain ADR (misal: [ADR-001 Automation Hub](file:///d:/Users/ultimateai/docs/architecture/AUTOMATION_HUB_ARCHITECTURE.md))
6. [Implementability Validation (Phase Ω)](file:///d:/Users/ultimateai/IMPLEMENTABILITY_VALIDATION.md)
7. **Implementation** (Codebase & Runtime)

---

> **Principle**: *Domain Layer menjelaskan apa yang dipahami dan dirancang oleh UltimateAI. Production Layer menentukan bagaimana rancangan tersebut diwujudkan. Infrastructure Layer menentukan dengan apa pekerjaan itu dijalankan.*

- **Domain (Intelligence)** – bertanggung jawab atas pemahaman, perancangan, dan definisi model bisnis serta blueprint universal.
- **Production** – mengambil blueprint dari Domain dan menghasilkan produk konkret (APK, Video, Image, Website, dsb.).
- **Infrastructure** – menyediakan layanan teknis seperti router, provider map, storage, cache, dan delivery yang mendukung Production.

Setelah sprint *Domain Lock* selesai, struktur Domain Layer tidak akan diubah lagi; fokus selanjutnya adalah menginvestasikan waktu pada **Production Core Framework** untuk menciptakan nilai utama UltimateAI melalui berbagai Production Agent.

## Production Kernel Baseline

> **Rule**: Production Kernel Version 1.0 is locked. No new feature, plugin, worker, or infrastructure component may modify the Production Kernel unless a fundamental architectural defect is discovered. All future innovation must be implemented through Workers, Infrastructure, or Plugins without changing the Kernel contract.
