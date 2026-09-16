/**
 * server/studio/architectural/MasterDesignDraft.mjs
 * Master Architectural Draft Document & Brief Generator for User Alignment.
 */

export class MasterDesignDraft {
  constructor() {}

  /**
   * Compiles the official Master Design Draft markdown report for user review and sign-off.
   */
  generateDraftDocument(siteAnalysis, designProgram, projectMeta = {}) {
    const { dimensions, setbacks, regulations, orientation, access, environmentalStrategies } = siteAnalysis;
    const { concept, zoning, metrics } = designProgram;

    const projectName = projectMeta.name || `Proyek Rancang Bangun Rumah Lahan ${dimensions.width}×${dimensions.length}m`;
    const clientName = projectMeta.client || 'Klien Eksekutif UltimateAI';
    const dateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    let doc = `# MASTER DESIGN DRAFT: ${projectName.toUpperCase()}
**Tanggal:** ${dateStr} | **Status:** **MENUNGGU PERSETUJUAN (PENDING APPROVAL)**

---

## A. DATA LAHAN & ANALISIS TAPAK
* **Dimensi Lahan:** **${dimensions.width} meter** (lebar muka) $\\times$ **${dimensions.length} meter** (panjang/kedalaman)
* **Luas Tapak:** **${dimensions.totalArea} m²** (Rasio ${dimensions.aspectRatio})
* **Orientasi Tapak:** ${orientation.value} *(Status: \`${orientation.label}\`)*
* **Aksesibilitas Jalan:** ${access.road} *(Status: \`${access.label}\`)*
* **Sempadan Bangunan (GSB):**
  - Garis Sempadan Depan (GSB): **${setbacks.front} meter**
  - Sempadan Samping Kiri: **${setbacks.left} meter** | Samping Kanan: **${setbacks.right} meter**
  - Sempadan Belakang: **${setbacks.rear} meter**
* **Parameter Regulasi:**
  - Koefisien Dasar Bangunan (KDB Target): **${regulations.kdbPercent}%** (Maksimal Lantai Dasar: **${regulations.maxGroundFootprint} m²**)
  - Koefisien Dasar Hijau (KDH Target): **${regulations.kdhPercent}%** (Area Resapan Air: **${regulations.minGreenArea} m²**)
* **Strategi Lingkungan Mikro:**
${environmentalStrategies.map(s => `  - ${s}`).join('\n')}

---

## B. KONSEP ARSITEKTUR & FASAD
* **Gaya Arsitektur:** **${concept.style}**
* **Jumlah Lantai:** **${concept.floors} Lantai** (Ketinggian Plafon Lantai 1: 3.8m, Plafon Lantai 2: 3.4m)
* **Konsep Bentukan Massa:** ${concept.massing}
* **Konsep Atap:** ${concept.roofType}
* **Palet Material Utama:**
${concept.facadeMaterials.map(m => `  - ${m}`).join('\n')}

---

## C. PROGRAM RUANG & ESTIMASI LUASAN

### 1. Zona Publik (Lantai 1)
| Ruang | Estimasi Dimensi | Luas (m²) |
| :--- | :--- | :--- |
${zoning.public.map(r => `| ${r.name} | ${r.dimensions} | ${r.area.toFixed(1)} |`).join('\n')}

### 2. Zona Semi-Publik (Lantai 1)
| Ruang | Estimasi Dimensi | Luas (m²) |
| :--- | :--- | :--- |
${zoning.semiPublic.map(r => `| ${r.name} | ${r.dimensions} | ${r.area.toFixed(1)} |`).join('\n')}

### 3. Zona Privat (Lantai 1 & Lantai 2)
| Ruang | Estimasi Dimensi | Luas (m²) | Lantai |
| :--- | :--- | :--- | :--- |
${zoning.private.map(r => `| ${r.name} | ${r.dimensions} | ${r.area.toFixed(1)} | Lt. ${r.floor} |`).join('\n')}

### 4. Zona Servis (Lantai 1)
| Ruang | Estimasi Dimensi | Luas (m²) |
| :--- | :--- | :--- |
${zoning.service.map(r => `| ${r.name} | ${r.dimensions} | ${r.area.toFixed(1)} |`).join('\n')}

### 5. Zona Lanskap & Outdoor
| Area Terbuka | Tipe Fasilitas | Luas (m²) |
| :--- | :--- | :--- |
${zoning.outdoor.map(r => `| ${r.name} | ${r.dimensions} | ${r.area.toFixed(1)} |`).join('\n')}

**Rekapitulasi Luasan:**
* Luas Terbangun Lantai 1: **${metrics.groundFloorBuiltArea} m²** (KDB Riil: ${metrics.kdbActualPercent}%)
* Luas Terbangun Lantai 2: **${metrics.upperFloorBuiltArea} m²**
* Total Luas Bangunan (Gross Floor Area): **${metrics.totalBuiltArea} m²**
* Total Area Terbuka Hijau & Resapan: **${dimensions.totalArea - metrics.groundFloorBuiltArea} m²** (KDH Riil: ${metrics.kdhActualPercent}%)

---

## D. ZONASI SPASIAL
1. **Zonasi Horizontal:**
   - **Depan:** Carport, Garasi, Teras, Taman Depan, Foyer (Buffer Publik).
   - **Tengah:** Ruang Tamu, Ruang Keluarga, Inner Courtyard & Pool (Jantung Aktivitas Keluarga).
   - **Sayap Kanan/Belakang:** Master Suite Utama (Privasi Maksimal dengan Pemandangan Kolam).
   - **Sayap Kiri:** Zona Servis (Dapur Basah, Laundry, Kamar ART, Akses Servis Mandiri).
2. **Zonasi Vertikal:**
   - **Lantai 1:** Aktivitas Komunal, Ruang Tamu, Master Bedroom Suite, dan Area Servis.
   - **Lantai 2:** Kamar Anak, Kamar Tamu, Ruang Santai Keluarga, dan Balkon Pemandangan.

---

## E. RENCANA PRODUKSI VISUAL SEKUENSIAL (SATU PER SATU)
*(Setiap visual diproduksi sebagai artefak terpisah beresolusi tinggi yang mengacu pada satu model konsisten)*

1. **STEP 01 — DENAH ARSITEKTUR DETAIL** *(Denah Lantai 1 & Lantai 2)*
2. **STEP 02 — RANGKA STRUKTUR TEKNIS** *(Pondasi, Grid Kolom, Balok & Rangka Atap)*
3. **STEP 03 — TAMPAK DEPAN (FRONT ELEVATION)**
4. **STEP 04 — TAMPAK SAMPING KIRI (LEFT ELEVATION)**
5. **STEP 05 — TAMPAK SAMPING KANAN (RIGHT ELEVATION)**
6. **STEP 06 — TAMPAK BELAKANG (REAR ELEVATION)**
7. **STEP 07 — PERSPEKTIF 3D EKSTERIOR MODEL**
8. **STEP 08 — MODEL 3D HOLOGRAFIK HUD**

---
> 💡 **TINDAKAN DIPERLUKAN:**
> Silakan tinjau Master Design Draft ini. Jika sudah sesuai, katakan **"Setuju, lanjutkan ke Step 1 Denah"** untuk mengunci konsep dasar ini dan memulai produksi visual pertama. Anda juga dapat memberikan catatan revisi pada ruangan atau tata letak jika diinginkan.
`;

    return doc;
  }

  generateDraft(siteAnalysis, designProgram, projectMeta = {}) {
    return this.generateDraftDocument(siteAnalysis, designProgram, projectMeta);
  }
}

export const masterDesignDraftInstance = new MasterDesignDraft();
export default masterDesignDraftInstance;
