import fs from 'fs';
import path from 'path';

const cases = [
  // CATEGORY A: Exact Extraction
  {
    id: 'CASE_A01',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi Nomor Standar Dokumen',
    prompt: 'Berdasarkan spesifikasi resmi AT-RQS, sebutkan kode identitas dokumen standar resmi (Dokumen Standar ID) yang ditetapkan.',
    expected: {
      keyTerms: ['SPEC-AT-RQS-2026-V1.0'],
      type: 'exact_match'
    }
  },
  {
    id: 'CASE_A02',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi Tiga Lapisan Arsitektur Tri-Source',
    prompt: 'Sebutkan akronim dan kepanjangan dari 3 lapisan analitik utama dalam arsitektur Tri-Source AT-RQS.',
    expected: {
      keyTerms: ['SCORE', 'SCREEN', 'CLUE'],
      fullNames: [
        'Structured Content & Objective Rigor Evaluation',
        'Statistical Compliance, Rigor & Error Evaluation Network',
        'Contextual Logic & Unbiased Evidence'
      ]
    }
  },
  {
    id: 'CASE_A03',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi 5 Pilar AECI',
    prompt: 'Sebutkan 5 pilar dalam Analytical Evidence Consistency Index (AECI) pada metodologi AT-RQS.',
    expected: {
      keyTerms: [
        'Methodological Coherence',
        'Data Grounding & Empirical Traceability',
        'Inferential Soundness',
        'Statistical Reproducibility',
        'Cross-Source Corroboration'
      ]
    }
  },
  {
    id: 'CASE_A04',
    category: 'A_EXACT_EXTRACTION',
    name: 'Ekstraksi Klasifikasi Paten IPC',
    prompt: 'Sebutkan klasifikasi paten (IPC) yang tercantum dalam spesifikasi invensi AT-RQS.',
    expected: {
      keyTerms: ['G06F 40/20', 'G06N 3/00', 'G06F 16/30', 'G06F 21/64']
    }
  },

  // CATEGORY B: Structured Extraction
  {
    id: 'CASE_B01',
    category: 'B_STRUCTURED_EXTRACTION',
    name: 'Ekstraksi 7 Dimensi BWS',
    prompt: 'Sebutkan 7 dimensi evaluasi dalam Balanced Weight Synthesis (BWS) beserta bobot masing-masing.',
    expected: {
      dimensions: [
        { name: 'Clarity & Formulation of Problem', weight: 0.15 },
        { name: 'Theoretical Grounding & Literature Integration', weight: 0.15 },
        { name: 'Methodological Rigor & Data Integrity', weight: 0.20 },
        { name: 'Empirical Analysis & Statistical Robustness', weight: 0.20 },
        { name: 'Discussion Quality & Inferential Validity', weight: 0.15 },
        { name: 'Contribution, Novelty & Practical Relevance', weight: 0.10 },
        { name: 'Ethical Compliance, Data Availability & Governance', weight: 0.05 }
      ]
    }
  },
  {
    id: 'CASE_B02',
    category: 'B_STRUCTURED_EXTRACTION',
    name: 'Struktur Bobot Layer Master Formula',
    prompt: 'Berapa bobot lapisan (layer weights) masing-masing untuk S_SCORE, S_SCREEN, dan S_CLUE dalam formulasi master AT-RQS?',
    expected: {
      weights: { SCORE: 0.35, SCREEN: 0.35, CLUE: 0.30 }
    }
  },
  {
    id: 'CASE_B03',
    category: 'B_STRUCTURED_EXTRACTION',
    name: 'Struktur Tier Klasifikasi Kualitas',
    prompt: 'Sebutkan 5 tingkatan (Tier) klasifikasi mutu naskah dalam AT-RQS beserta rentang skornya.',
    expected: {
      tiers: ['TIER 1 (90-100)', 'TIER 2 (80-89.99)', 'TIER 3 (70-79.99)', 'TIER 4 (55-69.99)', 'TIER 5 (< 55)']
    }
  },

  // CATEGORY C: Numerical Fidelity
  {
    id: 'CASE_C01',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Nilai Eksak Parameter Koefisien Redaman Lambda dan Eksponen Gamma',
    prompt: 'Berapakah nilai numerik eksak untuk koefisien redaman lambda (λ) dan eksponen penalti gamma (γ) pada formula Consistency Factor (CF)?',
    expected: {
      lambda: 0.35,
      gamma: 1.50
    }
  },
  {
    id: 'CASE_C02',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Batas Bawah dan Atas Nilai Consistency Factor (CF)',
    prompt: 'Berapa batas rentang nilai minimum (batas bawah) dan maksimum (batas atas) dari Consistency Factor (CF)?',
    expected: {
      min: 0.65,
      max: 1.00
    }
  },
  {
    id: 'CASE_C03',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Data Benchmark Ablasi N=24',
    prompt: 'Pada laporan validasi VAL-AT-RQS-2026-B01 dengan ukuran sampel N=24, berapakah false high score rate model konvensional dibandingkan dengan AT-RQS?',
    expected: {
      conventionalRate: '37.5%',
      atRqsRate: '4.2%',
      sampleSize: 24
    }
  },
  {
    id: 'CASE_C04',
    category: 'C_NUMERICAL_FIDELITY',
    name: 'Jumlah Total Klaim Paten dan Nomor Klaim Independen',
    prompt: 'Berapa jumlah total klaim paten AT-RQS, dan sebutkan nomor klaim yang merupakan klaim independen?',
    expected: {
      totalClaims: 20,
      independentClaims: [1, 8, 15]
    }
  },

  // CATEGORY D: Formula Fidelity
  {
    id: 'CASE_D01',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Matematis Consistency Factor (CF)',
    prompt: 'Tuliskan persamaan matematis lengkap untuk menghitung Consistency Factor (CF) menggunakan parameter AECI, lambda, dan gamma.',
    expected: {
      formulaContains: ['CF = 1.0 - lambda * (1.0 - AECI)^gamma', '1 - lambda * (1 - AECI)^gamma']
    }
  },
  {
    id: 'CASE_D02',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Master Skor AT-RQS',
    prompt: 'Tuliskan rumus master perhitungan skor akhir AT-RQS yang menggabungkan skor SCORE, SCREEN, CLUE, dan Consistency Factor (CF).',
    expected: {
      formulaContains: ['(0.35 * S_SCORE + 0.35 * S_SCREEN + 0.30 * S_CLUE) * CF', 'w_SCORE * S_SCORE']
    }
  },
  {
    id: 'CASE_D03',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Indeks ARTI',
    prompt: 'Tuliskan rumus Academic Rigor & Trust Index (ARTI) beserta variabel penyusunnya.',
    expected: {
      formulaContains: ['ARTI = AT_RQS * sqrt(AECI)', 'sqrt(AECI)']
    }
  },
  {
    id: 'CASE_D04',
    category: 'D_FORMULA_FIDELITY',
    name: 'Formulasi Koefisien AAC',
    prompt: 'Bagaimana rumus Auditability & Accuracy Coefficient (AAC) didefinisikan dalam dokumen spesifikasi?',
    expected: {
      formulaContains: ['AAC = min(1.0, (N_verified_claims / N_total_claims) * (1.0 - Error_Rate))', 'min(1.0']
    }
  },

  // CATEGORY E: Cross-Section Consistency
  {
    id: 'CASE_E01',
    category: 'E_CROSS_SECTION_CONSISTENCY',
    name: 'Korelasi Antara AECI dan Penalti CF',
    prompt: 'Jika sebuah artikel memiliki AECI = 1.0 (konsistensi sempurna), berapa nilai CF yang dihasilkan? Dan jika AECI = 0.0, berapa nilai CF yang dihasilkan?',
    expected: {
      cfAt1: 1.0,
      cfAt0: 0.65
    }
  },
  {
    id: 'CASE_E02',
    category: 'E_CROSS_SECTION_CONSISTENCY',
    name: 'Hubungan Antara Klaim Independen 1, 8, dan 15',
    prompt: 'Jelaskan perbedaan kategori subjek (subject matter) dari ketiga klaim independen AT-RQS: Klaim 1, Klaim 8, dan Klaim 15.',
    expected: {
      claim1: 'Sistem / Aparatus Terkomputerisasi',
      claim8: 'Metode Terkomputerisasi',
      claim15: 'Media Penyimpan Terbaca Komputer'
    }
  },

  // CATEGORY F: Long-Context Comprehension
  {
    id: 'CASE_F01',
    category: 'F_LONG_CONTEXT_COMPREHENSION',
    name: 'Tujuan Strategis Pengajuan Paten dan Window PCT',
    prompt: 'Apa status tata kelola pengajuan paten AT-RQS dan berapa lama jendela prioritas PCT (Patent Cooperation Treaty) yang ditargetkan?',
    expected: {
      status: 'Ready for Patent Counsel Review / Target Filing DJKI Sept 2026',
      pctWindow: '12 Bulan'
    }
  },
  {
    id: 'CASE_F02',
    category: 'F_LONG_CONTEXT_COMPREHENSION',
    name: 'Pengakuan Internasional dan Lembaga Penerbit',
    prompt: 'Sebutkan lembaga penerbit spesifikasi AT-RQS dan nomor pengenal internasional (WoS, Scopus, ORCID) yang tercantum.',
    expected: {
      institution: 'Asia Pacific Academician (ASIA) / APASIFIC',
      wos: 'QKY-3514-2026',
      scopus: '59675598500',
      orcid: '0009-0006-8416-6156'
    }
  },

  // CATEGORY G: Contradiction Detection
  {
    id: 'CASE_G01',
    category: 'G_CONTRADICTION_DETECTION',
    name: 'Deteksi Kontradiksi Model Generatif LLM',
    prompt: 'Pernyataan: "AT-RQS menggunakan single-source model generatif LLM untuk memberikan skor secara langsung tanpa redaman struktural." Apakah pernyataan ini BENAR atau SALAH menurut dokumen? Jelaskan kontradiksinya.',
    expected: {
      verdict: 'SALAH',
      reasonContains: ['deterministik', 'tri-source', 'redaman konsistensi struktural (CF)', 'bukan generative LLM tunggal']
    }
  },
  {
    id: 'CASE_G02',
    category: 'G_CONTRADICTION_DETECTION',
    name: 'Deteksi Kontradiksi Bobot BWS',
    prompt: 'Pernyataan: "Dimensi Ethical Compliance, Data Availability & Governance (D7) memiliki bobot 25% dalam BWS." Apakah ini BENAR atau SALAH? Sebutkan bobot yang benar.',
    expected: {
      verdict: 'SALAH',
      correctWeight: '5% (0.05)'
    }
  },

  // CATEGORY H: Evidence Grounding
  {
    id: 'CASE_H01',
    category: 'H_EVIDENCE_GROUNDING',
    name: 'Keterbatasan Prior Art US Patent 10,846,360',
    prompt: 'Apa kelemahan utama dari dokumen pembanding terdahulu US Patent 10,846,360 jika dibandingkan dengan invensi AT-RQS?',
    expected: {
      limitation: 'Berbasis frekuensi kata & model regresi linear; rentan manipulasi retoris'
    }
  },
  {
    id: 'CASE_H02',
    category: 'H_EVIDENCE_GROUNDING',
    name: 'Mekanisme Penguncian Integritas Bukti',
    prompt: 'Teknologi kriptografi apa yang digunakan dalam AT-RQS untuk menjamin tamper-evident audit trail terhadap bukti ilmiah?',
    expected: {
      keyTerms: ['SHA-256', 'kriptografis', 'audit trail', 'tamper-evident']
    }
  },

  // CATEGORY I: Overclaim Detection
  {
    id: 'CASE_I01',
    category: 'I_OVERCLAIM_DETECTION',
    name: 'Deteksi Klaim Berlebihan (Overclaim)',
    prompt: 'Pernyataan: "Metodologi AT-RQS mengklaim dapat menjamin 100% semua naskah ilmiah lolos publikasi Scopus Q1 tanpa revisi." Evaluasi pernyataan ini: Apakah didukung oleh dokumen atau merupakan OVERCLAIM?',
    expected: {
      verdict: 'OVERCLAIM / TIDAK DIDUKUNG',
      fact: 'AT-RQS adalah sistem evaluasi objektif dan penilaian kualitas ilmiah, bukan jaminan penerimaan publikasi otomatis'
    }
  },

  // CATEGORY J: Self-Correction
  {
    id: 'CASE_J01',
    category: 'J_SELF_CORRECTION',
    name: 'Uji Koreksi Fakta Bobot SCORE vs CLUE',
    prompt: 'Seseorang mengatakan bahwa bobot layer SCORE adalah 30% dan CLUE adalah 35%. Koreksi kesalahan tersebut berdasarkan spesifikasi baku AT-RQS.',
    expected: {
      correction: 'Terbalik: bobot SCORE adalah 35% (0.35) dan bobot CLUE adalah 30% (0.30), sedangkan SCREEN adalah 35% (0.35)'
    }
  }
];

const outDir = 'D:/Users/ultimateai/tests/model-fidelity/cases';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'benchmark_cases.json');
fs.writeFileSync(outPath, JSON.stringify(cases, null, 2), 'utf8');
console.log(`Saved ${cases.length} benchmark test cases to ${outPath}`);
