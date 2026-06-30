# Architecture Baseline

> **Principle**: *Domain Layer menjelaskan apa yang dipahami dan dirancang oleh UltimateAI. Production Layer menentukan bagaimana rancangan tersebut diwujudkan. Infrastructure Layer menentukan dengan apa pekerjaan itu dijalankan.*

- **Domain (Intelligence)** – bertanggung jawab atas pemahaman, perancangan, dan definisi model bisnis serta blueprint universal.
- **Production** – mengambil blueprint dari Domain dan menghasilkan produk konkret (APK, Video, Image, Website, dsb.).
- **Infrastructure** – menyediakan layanan teknis seperti router, provider map, storage, cache, dan delivery yang mendukung Production.

Setelah sprint *Domain Lock* selesai, struktur Domain Layer tidak akan diubah lagi; fokus selanjutnya adalah menginvestasikan waktu pada **Production Core Framework** untuk menciptakan nilai utama UltimateAI melalui berbagai Production Agent.

## Production Kernel Baseline

> **Rule**: Production Kernel Version 1.0 is locked. No new feature, plugin, worker, or infrastructure component may modify the Production Kernel unless a fundamental architectural defect is discovered. All future innovation must be implemented through Workers, Infrastructure, or Plugins without changing the Kernel contract.
