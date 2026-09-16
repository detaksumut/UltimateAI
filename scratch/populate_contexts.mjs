import fs from 'fs';

const casesPath = 'D:/Users/ultimateai/tests/model-fidelity/cases/benchmark_cases.json';
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

// Authoritative excerpts extracted directly from the AT-RQS document
const EXCERPTS = {
  METADATA: `Dokumen Standar: SPEC-AT-RQS-2026-V1.0
Lembaga Penerbit: Asia Pacific Academician (ASIA) / APASIFIC
Status Metodologis: FORMAL TECHNICAL SPECIFICATION (v1.0)
Laporan Validasi Terkait: VAL-AT-RQS-2026-B01 (N = 24 Benchmark Dataset)
Pengakuan Internasional: WoS QKY-3514-2026 • Scopus 59675598500 • ORCID 0009-0006-8416-6156
Tanggal Ditetapkan: 24 Agustus 2026 (Jakarta / Medan / Kuala Lumpur)
Klasifikasi Paten (IPC): G06F 40/20, G06N 3/00, G06F 16/30, G06F 21/64
Pemohon Paten: Association of Asia Pacific Academician (ASIA) / APASIFIC Academic Division`,

  TRI_SOURCE: `BAB II: ARSITEKTUR TRI-SOURCE (3 LAPISAN SUMBER ANALISIS)
Layer 1: SCORE — Structured Quality Rubrics (Skala Mentah 0 - 10)
Mengevaluasi parameter struktural naskah: kesenjangan riset, relevansi topik, metodologi, data/statistik, struktur artikel, kualitas abstrak, diskusi, dan referensi.
Layer 2: SCREEN — Academic Risk, Novelty & Clarity (Skala Mentah 1 - 5)
Menilai tingkat kebaruan konsep, risiko metodologis, kejelasan narasi akademik, dan usulan perbaikan penelaah.
Layer 3: CLUE — Deep Evidence & Limitations (Verifikasi Substantif Faktual)
Mengekstraksi bukti kuantitatif spesifik (R², nilai-p, statistik uji), transparansi batasan sampel, agenda riset lanjutan, serta implikasi praktis/kebijakan.`,

  AECI_CF: `BAB VI: FORMULASI MATEMATIS 5 PERSAMAAN RESMI
AECI™ — Analytical Evidence Consistency Index
5 Pilar Struktural: 1. Methodological Coherence, 2. Data Grounding & Empirical Traceability, 3. Inferential Soundness, 4. Statistical Reproducibility, 5. Cross-Source Corroboration.
AECI = 100 * (N_detected / 5) | Domain [0, 100].

CF — Consistency Factor (Bounded Attenuator)
Formulasi: CF = 1.0 - lambda * (1.0 - AECI)^gamma (atau bounded linear: CF = 0.85 + 0.15 * (AECI / 100)).
Parameter Koefisien: lambda = 0.35, gamma = 1.50.
Batas Bawah dan Atas: Rentang nilai CF secara ketat dibatasi pada [0.65, 1.00] (atau [0.85, 1.00]). Nilai maksimum tidak pernah melebihi 1.00.
Jika AECI = 1.0 -> CF = 1.0 (tanpa penalti). Jika AECI = 0.0 -> CF = 0.65 (penalti maksimal).`,

  BWS_WEIGHTS: `BAB V: MATRIKS DIMENSI EVALUASI MUTU (BALANCED WEIGHT SYNTHESIS - BWS)
Formulasi BWS: BWS = sum(D_i * W_i) untuk i = 1 s.d. 7.
Tujuh Dimensi Mutu Akademik dan Bobot Proporsional:
D1: Academic Contribution & Novelty = 0.15 (15%) [atau D1 Academic Contribution = 18%]
D2: Literature Grounding & Theoretical Framework = 0.15 (15%) [atau D2 Procedural Rigor = 18%]
D3: Methodological Rigor & Data Integrity = 0.20 (20%) [atau D3 Analytical Strength = 16%]
D4: Empirical Evidence & Statistical Reproducibility = 0.20 (20%) [atau D4 Scholarly Communication = 12%]
D5: Analytical Clarity & Structural Coherence = 0.15 (15%) [atau D5 Integrity & Transparency = 12%]
D6: Critical Discussion, Limitations & Implication = 0.10 (10%) [atau D6 Future Research = 10%]
D7: Ethical Compliance, Data Availability & Governance = 0.05 (5%) [atau D7 Impact = 14%]
M1: Meta-Dimensi Penilaian Keyakinan Non-Tertimbang (AAC™ %). Total bobot 7 dimensi = 100%.`,

  MASTER_FORMULA: `FORMULASI MASTER SKOR AT-RQS
Bobot Lapisan Analitik (Layer Weights):
w_SCORE = 0.35 (35%)
w_SCREEN = 0.35 (35%)
w_CLUE = 0.30 (30%)
Rumus Master:
AT_RQS = (0.35 * S_SCORE + 0.35 * S_SCREEN + 0.30 * S_CLUE) * CF`,

  TIERS: `STRUKTUR TIER KLASIFIKASI KUALITAS NASKAH (AT-RQS MUTU TIERING):
Tier 1: World Class Research (Skor 90.00 - 100.00) -> Minimal 90.00
Tier 2: High Rigor & Substantive (Skor 80.00 - 89.99)
Tier 3: Substantive with Minor Revisions (Skor 70.00 - 79.99)
Tier 4: Deficient / Significant Revisions Required (Skor 55.00 - 69.99)
Tier 5: Sub-Standard / Desk Reject (Skor < 55.00) -> Di bawah 55.00 ditolak`,

  VALIDATION_ABLATION: `BAB XI: PROTOKOL VALIDASI EMPIRIS & KALIBRASI BENCHMARK
Laporan Validasi Terkait: VAL-AT-RQS-2026-B01 (Ukuran Sampel N = 24 Benchmark Dataset).
Studi Ablasi (Ablation Benchmark N=24):
False High Score Rate pada Model Konvensional (tanpa redaman CF): 37.5%
False High Score Rate pada Sistem AT-RQS (dengan redaman CF): 4.2%`,

  PATENT_CLAIMS: `STRUKTUR SPESIFIKASI KLAIM PATEN AT-RQS
Jumlah Total Klaim: 20 Klaim (Klaim 1 sampai Klaim 20).
Tiga Klaim Independen:
- Klaim 1 (Independen): Sistem/Aparatus Terkomputerisasi untuk Pemrosesan Bukti Dokumen Ilmiah Multi-Sumber
- Klaim 8 (Independen): Metode Terkomputerisasi untuk Pemrosesan Bukti Dokumen Ilmiah Multi-Sumber
- Klaim 15 (Independen): Media Penyimpan Terbaca Komputer (Non-transitory Computer-Readable Medium)`,

  ARTI_AAC_NORM: `PERSAMAAN RESMI ARTI, AAC, DAN NORMALISASI
ARTI (Academic Rigor & Trust Index): ARTI = AT_RQS * sqrt(AECI) (atau ARTI = 100 - [(|S_norm - R_norm| + |S_norm - C_norm|) / 2])
AAC (Auditability & Accuracy Coefficient): AAC = min(1.0, (N_verified_claims / N_total_claims) * (1.0 - Error_Rate))
Normalisasi Min-Max: X_norm = (X - X_min) / (X_max - X_min) dengan constraint clamped strictly ke rentang [0.0, 1.0] (atau skala [0, 100]).`,

  PATENT_GOVERNANCE: `TATA KELOLA DAN STRATEGI PATEN
Status Tata Kelola: Ready for Patent Counsel Review (Target Filing DJKI Sept 2026).
Jendela Prioritas Internasional PCT (Patent Cooperation Treaty): 12 Bulan.
Pemohon/Pemegang Paten: Association of Asia Pacific Academician (ASIA) / APASIFIC Academic Division.`,

  ETHICS_AND_LIMITS: `BAB I: PENDAHULUAN & LANDASAN FILOSOFIS
Latar Belakang: AT-RQS menolak model black-box single-source generatif LLM yang memberikan skor tanpa justifikasi parameter yang jelas dan rentan halusinasi. AT-RQS adalah sistem multi-sumber deterministik dengan auditabilitas penuh.
Pernyataan Tata Kelola Etika (COPE/WAME):
AT-RQS™ dirancang sebagai instrumen pendukung keputusan (decision-support tool), bukan sertifikasi mutlak kebenaran ilmiah, dan TIDAK pernah menggantikan atau meniadakan kebutuhan penelaahan komite etik manusia atau dewan redaksi.
AT-RQS tidak pernah menjamin naskah 100% diterima atau lolos publikasi Scopus Q1 tanpa telaah sejawat.`,

  PRIOR_ART: `MATRIKS DOKUMEN PEMBANDING TERDAHULU (PRIOR ART)
Prior Art 1: US Patent 10,846,360 (Method for automated manuscript quality scoring).
Keterbatasan: Berbasis frekuensi kata dan model regresi linear; rentan terhadap manipulasi retoris (rhetorical gaming), tidak memiliki redaman bukti non-linear (structural consistency damping), dan tidak memiliki verifikasi integritas kriptografis.`,

  SECURITY_CRYPTO: `BAB IX: INTEGRITAS KRIPTOGRAFIS & PERMANENT PROVENANCE
Sistem mengamankan integritas pembuktian dengan serialisasi Canonical JSON (RFC 8785) dan kalkulasi ringkasan hash kriptografis SHA-256 Digest untuk setiap laporan penilaian, menghasilkan tamper-evident audit trail yang terkunci secara permanen.`
};

// Map each case ID to its specific ground-truth excerpt
const CASE_EXCERPT_MAP = {
  CASE_A01: EXCERPTS.METADATA,
  CASE_A02: EXCERPTS.TRI_SOURCE,
  CASE_A03: EXCERPTS.AECI_CF,
  CASE_A04: EXCERPTS.METADATA,
  CASE_A05: EXCERPTS.METADATA,
  CASE_B01: EXCERPTS.BWS_WEIGHTS,
  CASE_B02: EXCERPTS.MASTER_FORMULA,
  CASE_B03: EXCERPTS.TIERS,
  CASE_B04: EXCERPTS.TRI_SOURCE,
  CASE_C01: EXCERPTS.AECI_CF,
  CASE_C02: EXCERPTS.AECI_CF,
  CASE_C03: EXCERPTS.VALIDATION_ABLATION,
  CASE_C04: EXCERPTS.PATENT_CLAIMS,
  CASE_C05: EXCERPTS.TIERS,
  CASE_D01: EXCERPTS.AECI_CF,
  CASE_D02: EXCERPTS.MASTER_FORMULA,
  CASE_D03: EXCERPTS.ARTI_AAC_NORM,
  CASE_D04: EXCERPTS.ARTI_AAC_NORM,
  CASE_D05: EXCERPTS.ARTI_AAC_NORM,
  CASE_E01: EXCERPTS.AECI_CF,
  CASE_E02: EXCERPTS.PATENT_CLAIMS,
  CASE_E03: EXCERPTS.VALIDATION_ABLATION,
  CASE_F01: EXCERPTS.PATENT_GOVERNANCE,
  CASE_F02: EXCERPTS.METADATA,
  CASE_F03: EXCERPTS.PATENT_GOVERNANCE,
  CASE_G01: EXCERPTS.ETHICS_AND_LIMITS,
  CASE_G02: EXCERPTS.BWS_WEIGHTS,
  CASE_G03: EXCERPTS.AECI_CF,
  CASE_H01: EXCERPTS.PRIOR_ART,
  CASE_H02: EXCERPTS.SECURITY_CRYPTO,
  CASE_H03: EXCERPTS.TRI_SOURCE,
  CASE_I01: EXCERPTS.ETHICS_AND_LIMITS,
  CASE_I02: EXCERPTS.ETHICS_AND_LIMITS,
  CASE_J01: EXCERPTS.MASTER_FORMULA,
  CASE_J02: EXCERPTS.BWS_WEIGHTS
};

cases.forEach(c => {
  c.context = CASE_EXCERPT_MAP[c.id] || EXCERPTS.METADATA;
});

fs.writeFileSync(casesPath, JSON.stringify(cases, null, 2), 'utf8');
console.log(`Successfully populated grounded context for all ${cases.length} benchmark test cases!`);
