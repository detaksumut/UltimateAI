import fs from 'fs';
import path from 'path';

const cases = [
  // CATEGORY A: Exact Extraction
  {
    id: 'CASE_A01',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi Nomor Standar Dokumen',
    prompt: 'Berdasarkan spesifikasi resmi AT-RQS, sebutkan kode identitas dokumen standar resmi (Dokumen Standar ID) yang ditetapkan.',
    expectedFact: 'SPEC-AT-RQS-2026-V1.0'
  },
  {
    id: 'CASE_A02',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi Tiga Lapisan Arsitektur Tri-Source',
    prompt: 'Sebutkan akronim dan kepanjangan dari 3 lapisan analitik utama dalam arsitektur Tri-Source AT-RQS.',
    expectedFact: 'SCORE (Structured Content & Objective Rigor Evaluation), SCREEN (Statistical Compliance, Rigor & Error Evaluation Network), CLUE (Contextual Logic & Unbiased Evidence)'
  },
  {
    id: 'CASE_A03',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi 5 Pilar AECI',
    prompt: 'Sebutkan 5 pilar dalam Analytical Evidence Consistency Index (AECI) pada metodologi AT-RQS.',
    expectedFact: '1. Methodological Coherence, 2. Data Grounding & Empirical Traceability, 3. Inferential Soundness, 4. Statistical Reproducibility, 5. Cross-Source Corroboration'
  },
  {
    id: 'CASE_A04',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi Klasifikasi Paten IPC',
    prompt: 'Sebutkan klasifikasi paten internasional (IPC) yang tercantum dalam spesifikasi invensi AT-RQS.',
    expectedFact: 'G06F 40/20, G06N 3/00, G06F 16/30, G06F 21/64'
  },
  {
    id: 'CASE_A05',
    category: 'A_EXACT_EXTRACTION',
    name: 'Tanggal Penetapan Dokumen dan Lokasi Regional',
    prompt: 'Kapan tanggal penetapan spesifikasi formal AT-RQS dan sebutkan 3 kota regional yang tercantum sebagai lokasi penetapan.',
    expectedFact: '24 Agustus 2026 (Jakarta / Medan / Kuala Lumpur)'
  },

  // CATEGORY B: Structured Extraction
  {
    id: 'CASE_B01',
    category: 'B_STRUCTURED_EXTRACTION',
    name: 'Ekstraksi 7 Dimensi BWS dan Bobotnya',
    prompt: 'Sebutkan 7 dimensi evaluasi dalam Balanced Weight Synthesis (BWS) beserta bobot numerik masing-masing.',
    expectedFact: 'D1: 0.15 (15%), D2: 0.15 (15%), D3: 0.20 (20%), D4: 0.20 (20%), D5: 0.15 (15%), D6: 0.10 (10%), D7: 0.05 (5%)'
  },
  {
    id: 'CASE_B02',
    category: 'B_STRUCTURED_EXTRACTION',
    name: 'Struktur Bobot Layer Master Formula',
    prompt: 'Berapa bobot lapisan (layer weights) masing-masing untuk S_SCORE, S_SCREEN, dan S_CLUE dalam formulasi master AT-RQS?',
    expectedFact: 'w_SCORE = 0.35 (35%), w_SCREEN = 0.35 (35%), w_CLUE = 0.30 (30%)'
  },
  {
    id: 'CASE_B03',
    category: 'B_STRUCTURED_EXTRACTION',
    name: 'Struktur Tier Klasifikasi Kualitas',
    prompt: 'Sebutkan 5 tingkatan (Tier) klasifikasi mutu naskah dalam AT-RQS beserta rentang skornya.',
    expectedFact: 'Tier 1: World Class (90-100), Tier 2: High Rigor (80-89.99), Tier 3: Substantive (70-79.99), Tier 4: Deficient (55-69.99), Tier 5: Sub-Standard (<55)'
  },
  {
    id: 'CASE_B04',
    category: 'B_STRUCTURED_EXTRACTION',
    name: 'Struktur Tiga Komponen Triangulasi Bukti',
    prompt: 'Sebutkan 3 komponen pembuktian dalam triangulasi integritas naskah ilmiah pada metodologi AT-RQS.',
    expectedFact: 'SCORE (Struktural), SCREEN (Statistik/Data), CLUE (Logika Kontekstual)'
  },

  // CATEGORY C: Numerical Fidelity
  {
    id: 'CASE_C01',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Nilai Eksak Koefisien Redaman Lambda dan Eksponen Gamma',
    prompt: 'Berapakah nilai numerik eksak untuk koefisien redaman lambda (λ) dan eksponen penalti gamma (γ) pada formula Consistency Factor (CF)?',
    expectedFact: 'lambda = 0.35, gamma = 1.50'
  },
  {
    id: 'CASE_C02',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Batas Bawah dan Atas Nilai Consistency Factor (CF)',
    prompt: 'Berapa batas rentang nilai minimum (batas bawah) dan maksimum (batas atas) dari Consistency Factor (CF)?',
    expectedFact: 'Min: 0.65, Max: 1.00'
  },
  {
    id: 'CASE_C03',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Data Benchmark Ablasi N=24',
    prompt: 'Pada laporan validasi VAL-AT-RQS-2026-B01 dengan ukuran sampel N=24, berapakah false high score rate model konvensional dibandingkan dengan AT-RQS?',
    expectedFact: 'Model konvensional: 37.5%, AT-RQS: 4.2% (Ukuran sampel N = 24)'
  },
  {
    id: 'CASE_C04',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Jumlah Total Klaim Paten dan Nomor Klaim Independen',
    prompt: 'Berapa jumlah total klaim paten AT-RQS, dan sebutkan nomor klaim yang merupakan klaim independen?',
    expectedFact: 'Total 20 klaim; Klaim independen: Klaim 1, Klaim 8, dan Klaim 15'
  },
  {
    id: 'CASE_C05',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Ambang Batas Skor Minimal World Class vs Desk Reject',
    prompt: 'Berapakah batas skor minimal untuk kategori Tier 1: World Class, dan berapa batas atas skor untuk Tier 5: Desk Reject?',
    expectedFact: 'Tier 1 World Class minimal: 90.00, Tier 5 Desk Reject: < 55.00'
  },

  // CATEGORY D: Formula Fidelity
  {
    id: 'CASE_D01',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Matematis Consistency Factor (CF)',
    prompt: 'Tuliskan persamaan matematis lengkap untuk menghitung Consistency Factor (CF) menggunakan parameter AECI, lambda, dan gamma.',
    expectedFact: 'CF = 1.0 - lambda * (1.0 - AECI)^gamma'
  },
  {
    id: 'CASE_D02',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Master Skor AT-RQS',
    prompt: 'Tuliskan rumus master perhitungan skor akhir AT-RQS yang menggabungkan skor SCORE, SCREEN, CLUE, dan Consistency Factor (CF).',
    expectedFact: 'AT_RQS = (0.35 * S_SCORE + 0.35 * S_SCREEN + 0.30 * S_CLUE) * CF'
  },
  {
    id: 'CASE_D03',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Indeks ARTI',
    prompt: 'Tuliskan rumus Academic Rigor & Trust Index (ARTI) beserta variabel penyusunnya.',
    expectedFact: 'ARTI = AT_RQS * sqrt(AECI)'
  },
  {
    id: 'CASE_D04',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Koefisien AAC',
    prompt: 'Bagaimana rumus Auditability & Accuracy Coefficient (AAC) didefinisikan dalam dokumen spesifikasi?',
    expectedFact: 'AAC = min(1.0, (N_verified_claims / N_total_claims) * (1.0 - Error_Rate))'
  },
  {
    id: 'CASE_D05',
    category: 'D_FORMULA_FIDELITY',
    name: 'Persamaan Matematis Normalisasi Min-Max X_norm',
    prompt: 'Tuliskan persamaan normalisasi standar yang digunakan untuk membawa seluruh metrik heterogen ke dalam skala seragam [0.0, 1.0].',
    expectedFact: 'X_norm = (X - X_min) / (X_max - X_min) dengan constraint clamped strictly ke [0.0, 1.0]'
  },

  // CATEGORY E: Cross-Section Consistency
  {
    id: 'CASE_E01',
    category: 'E_CROSS_SECTION_CONSISTENCY',
    name: 'Korelasi Antara AECI dan Penalti CF',
    prompt: 'Jika sebuah artikel memiliki AECI = 1.0 (konsistensi sempurna), berapa nilai CF yang dihasilkan? Dan jika AECI = 0.0, berapa nilai CF yang dihasilkan?',
    expectedFact: 'AECI = 1.0 -> CF = 1.0 (tanpa penalti); AECI = 0.0 -> CF = 0.65 (penalti maksimal 35%)'
  },
  {
    id: 'CASE_E02',
    category: 'E_CROSS_SECTION_CONSISTENCY',
    name: 'Hubungan Antara Tiga Klaim Independen Paten',
    prompt: 'Jelaskan perbedaan kategori subjek (subject matter) dari ketiga klaim independen AT-RQS: Klaim 1, Klaim 8, dan Klaim 15.',
    expectedFact: 'Klaim 1: Sistem/Aparatus Terkomputerisasi; Klaim 8: Metode Terkomputerisasi; Klaim 15: Media Penyimpan Terbaca Komputer (Non-transitory medium)'
  },
  {
    id: 'CASE_E03',
    category: 'E_CROSS_SECTION_CONSISTENCY',
    name: 'Konsistensi Kode Laporan Validasi Benchmark N=24',
    prompt: 'Apakah kode dokumen laporan validasi yang mencakup dataset N=24 benchmark?',
    expectedFact: 'VAL-AT-RQS-2026-B01'
  },

  // CATEGORY F: Long-Context Comprehension
  {
    id: 'CASE_F01',
    category: 'F_LONG_CONTEXT_COMPREHENSION',
    name: 'Tujuan Strategis Pengajuan Paten dan Window PCT',
    prompt: 'Apa status tata kelola pengajuan paten AT-RQS dan berapa lama jendela prioritas PCT (Patent Cooperation Treaty) yang ditargetkan?',
    expectedFact: 'Status: Ready for Patent Counsel Review (Target Filing DJKI Sept 2026) dengan Jendela Prioritas PCT 12 Bulan'
  },
  {
    id: 'CASE_F02',
    category: 'F_LONG_CONTEXT_COMPREHENSION',
    name: 'Pengakuan Internasional dan Lembaga Penerbit',
    prompt: 'Sebutkan lembaga penerbit spesifikasi AT-RQS dan nomor pengenal internasional (WoS, Scopus, ORCID) yang tercantum.',
    expectedFact: 'Penerbit: Asia Pacific Academician (ASIA) / APASIFIC; WoS: QKY-3514-2026; Scopus: 59675598500; ORCID: 0009-0006-8416-6156'
  },
  {
    id: 'CASE_F03',
    category: 'F_LONG_CONTEXT_COMPREHENSION',
    name: 'Identitas Pemohon Paten dan Hak Eksklusif',
    prompt: 'Siapakah pemegang/pemohon resmi hak paten invensi AT-RQS sebagaimana dinyatakan dalam dokumen formal?',
    expectedFact: 'Association of Asia Pacific Academician (ASIA) / APASIFIC Academic Division'
  },

  // CATEGORY G: Contradiction Detection
  {
    id: 'CASE_G01',
    category: 'G_CONTRADICTION_DETECTION',
    name: 'Deteksi Kontradiksi Model Generatif LLM',
    prompt: 'Pernyataan: "AT-RQS menggunakan single-source model generatif LLM untuk memberikan skor secara langsung tanpa redaman struktural." Apakah pernyataan ini BENAR atau SALAH menurut dokumen? Jelaskan kontradiksinya.',
    expectedFact: 'SALAH: AT-RQS adalah sistem deterministik multi-sumber (SCORE, SCREEN, CLUE) dengan formula matematis pasti dan redaman konsistensi struktural (CF), bukan model generatif LLM tunggal'
  },
  {
    id: 'CASE_G02',
    category: 'G_CONTRADICTION_DETECTION',
    name: 'Deteksi Kontradiksi Bobot BWS D7',
    prompt: 'Pernyataan: "Dimensi Ethical Compliance, Data Availability & Governance (D7) memiliki bobot 25% dalam BWS." Apakah ini BENAR atau SALAH? Sebutkan bobot yang benar.',
    expectedFact: 'SALAH: Bobot D7 yang benar adalah 0.05 (5%), bukan 25%'
  },
  {
    id: 'CASE_G03',
    category: 'G_CONTRADICTION_DETECTION',
    name: 'Deteksi Kontradiksi Batas Nilai Konsistensi CF',
    prompt: 'Pernyataan: "Nilai Consistency Factor (CF) dapat mencapai 1.25 untuk naskah dengan bukti yang luar biasa sempurna." Apakah pernyataan ini BENAR atau SALAH? Jelaskan batas atas maksimumnya.',
    expectedFact: 'SALAH: Nilai maksimum CF dibatasi secara tegas (clamped) pada 1.00; tidak pernah melebihi 1.00'
  },

  // CATEGORY H: Evidence Grounding
  {
    id: 'CASE_H01',
    category: 'H_EVIDENCE_GROUNDING',
    name: 'Keterbatasan Prior Art US Patent 10,846,360',
    prompt: 'Apa kelemahan utama dari dokumen pembanding terdahulu US Patent 10,846,360 jika dibandingkan dengan invensi AT-RQS?',
    expectedFact: 'US Patent 10,846,360 berbasis frekuensi kata dan model regresi linear; rentan terhadap manipulasi retoris dan tidak memiliki redaman bukti non-linear'
  },
  {
    id: 'CASE_H02',
    category: 'H_EVIDENCE_GROUNDING',
    name: 'Mekanisme Penguncian Integritas Bukti Kriptografis',
    prompt: 'Teknologi kriptografi apa yang digunakan dalam AT-RQS untuk menjamin tamper-evident audit trail terhadap bukti ilmiah?',
    expectedFact: 'Penguncian integritas kriptografis berbasis hashing SHA-256 untuk memastikan audit trail permanen dan tamper-evident'
  },
  {
    id: 'CASE_H03',
    category: 'H_EVIDENCE_GROUNDING',
    name: 'Peran Lapisan SCREEN dalam Menguji Integritas Data',
    prompt: 'Apa fungsi utama lapisan analitik kedua (SCREEN) dalam mendeteksi kelemahan atau anomali naskah ilmiah?',
    expectedFact: 'Pemeriksaan kepatuhan statistik, rigor metodologi, deteksi anomali data, dan statistical reproducibility'
  },

  // CATEGORY I: Overclaim Detection
  {
    id: 'CASE_I01',
    category: 'I_OVERCLAIM_DETECTION',
    name: 'Deteksi Klaim Berlebihan Jaminan Publikasi',
    prompt: 'Pernyataan: "Metodologi AT-RQS mengklaim dapat menjamin 100% semua naskah ilmiah lolos publikasi Scopus Q1 tanpa revisi." Evaluasi pernyataan ini: Apakah didukung oleh dokumen atau merupakan OVERCLAIM?',
    expectedFact: 'OVERCLAIM / TIDAK DIDUKUNG: Dokumen tidak pernah menjamin penerimaan naskah 100%; AT-RQS adalah instrumen asesmen dan diagnosis mutu objektif'
  },
  {
    id: 'CASE_I02',
    category: 'I_OVERCLAIM_DETECTION',
    name: 'Deteksi Overclaim Subtitusi Komite Etik',
    prompt: 'Pernyataan: "AT-RQS mengklaim bahwa algoritma ini menghapus kebutuhan atas tinjauan etik manusia dan dewan riset." Evaluasi pernyataan ini: Apakah didukung dokumen atau OVERCLAIM?',
    expectedFact: 'OVERCLAIM / TIDAK DIDUKUNG: AT-RQS justru mewajibkan dimensi Ethical Compliance & Governance (D7) sebagai bagian dari audit tata kelola integritas'
  },

  // CATEGORY J: Self-Correction
  {
    id: 'CASE_J01',
    category: 'J_SELF_CORRECTION',
    name: 'Uji Koreksi Fakta Bobot SCORE vs CLUE',
    prompt: 'Seseorang mengatakan bahwa bobot layer SCORE adalah 30% dan CLUE adalah 35%. Koreksi kesalahan tersebut berdasarkan spesifikasi baku AT-RQS.',
    expectedFact: 'Koreksi: Terbalik. Bobot SCORE adalah 35% (0.35), bobot CLUE adalah 30% (0.30), dan bobot SCREEN adalah 35% (0.35)'
  },
  {
    id: 'CASE_J02',
    category: 'J_SELF_CORRECTION',
    name: 'Uji Koreksi Fakta Bobot D3 Methodological Rigor',
    prompt: 'Seseorang mengklaim: "Dimensi D3 (Methodological Rigor & Data Integrity) hanya memiliki bobot 10% dalam BWS." Koreksi pernyataan tersebut dengan nilai bobot yang benar menurut dokumen.',
    expectedFact: 'Koreksi: Bobot dimensi D3 (Methodological Rigor & Data Integrity) yang benar adalah 20% (0.20), bukan 10%'
  }
];

const outPath = 'D:/Users/ultimateai/tests/model-fidelity/cases/benchmark_cases.json';
fs.writeFileSync(outPath, JSON.stringify(cases, null, 2), 'utf8');
console.log(`Saved exactly ${cases.length} comprehensive benchmark test cases to ${outPath}`);
