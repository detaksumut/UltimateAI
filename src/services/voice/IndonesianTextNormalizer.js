/**
 * IndonesianTextNormalizer.js
 * Transforms raw text (numbers, dates, currency, abbreviations, markdown)
 * into speech-friendly Indonesian before TTS synthesis.
 *
 * ARCHITECTURE RULE:
 * - Works on text structure and linguistic patterns, NOT hardcoded response sentences.
 * - Every transformation targets a class of patterns, not specific examples.
 * - Abbreviation mapping is a data table, not a case list.
 * - This module has no knowledge of JIN's answers — it only reformats text for speech.
 */

// Abbreviation pronunciation table (Indonesian context)
const ABBREVIATION_MAP = {
  // Government & Policy
  'UU': 'Undang-Undang',
  'PP': 'Peraturan Pemerintah',
  'Perpres': 'Peraturan Presiden',
  'Kepres': 'Keputusan Presiden',
  'Perda': 'Peraturan Daerah',
  'DPRD': 'Dewan Perwakilan Rakyat Daerah',
  'DPR': 'Dewan Perwakilan Rakyat',
  'DPD': 'Dewan Perwakilan Daerah',
  'MPR': 'Majelis Permusyawaratan Rakyat',
  'MK': 'Mahkamah Konstitusi',
  'MA': 'Mahkamah Agung',
  'KPK': 'Komisi Pemberantasan Korupsi',
  'Bappenas': 'Badan Perencanaan Pembangunan Nasional',
  'BUMN': 'Badan Usaha Milik Negara',
  'BUMD': 'Badan Usaha Milik Daerah',
  'BPK': 'Badan Pemeriksa Keuangan',
  'OJK': 'Otoritas Jasa Keuangan',
  'BI': 'Bank Indonesia',
  'KPU': 'Komisi Pemilihan Umum',
  'Polri': 'Kepolisian Republik Indonesia',
  'TNI': 'Tentara Nasional Indonesia',
  'KemenKeu': 'Kementerian Keuangan',
  // Tech & Business
  'AI': 'Kecerdasan Buatan',
  'API': 'antarmuka pemrograman aplikasi',
  'UI': 'antarmuka pengguna',
  'UX': 'pengalaman pengguna',
  'IT': 'teknologi informasi',
  'ICT': 'teknologi informasi dan komunikasi',
  'IoT': 'Internet of Things',
  'ML': 'pembelajaran mesin',
  'NLP': 'pemrosesan bahasa alami',
  'ROI': 'imbal hasil investasi',
  'KPI': 'indikator kinerja utama',
  'SLA': 'perjanjian tingkat layanan',
  'ERR': 'kesalahan',
  'CEO': 'direktur utama',
  'CFO': 'direktur keuangan',
  'CTO': 'direktur teknologi',
  'COO': 'direktur operasional',
  'HR': 'sumber daya manusia',
  'HRD': 'divisi sumber daya manusia',
  'CSR': 'tanggung jawab sosial perusahaan',
  'B2B': 'bisnis ke bisnis',
  'B2C': 'bisnis ke konsumen',
  'SaaS': 'perangkat lunak sebagai layanan',
  // Documents & Files
  'PDF': 'P-D-F',
  'DOCX': 'dokumen Word',
  'XLSX': 'file Excel',
  'PNG': 'gambar PNG',
  'JPG': 'gambar JPEG',
  'MP4': 'video M-P-4',
  'URL': 'tautan',
  // Economic
  'APBN': 'Anggaran Pendapatan dan Belanja Negara',
  'APBD': 'Anggaran Pendapatan dan Belanja Daerah',
  'PDB': 'Produk Domestik Bruto',
  'GDP': 'Produk Domestik Bruto',
  'IPM': 'Indeks Pembangunan Manusia',
  'Rp': 'Rupiah',
  'PPN': 'Pajak Pertambahan Nilai',
  'PPh': 'Pajak Penghasilan',
  'UMKM': 'Usaha Mikro Kecil dan Menengah',
  // Time
  'YTD': 'sepanjang tahun ini',
  'QoQ': 'kuartal ke kuartal',
  'YoY': 'tahun ke tahun',
};

// Indonesian number words
const ONES = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
              'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
              'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];
const TENS = ['', '', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh',
              'enam puluh', 'tujuh puluh', 'delapan puluh', 'sembilan puluh'];

function numberToWords(n) {
  if (n === 0) return 'nol';
  if (n < 0) return 'minus ' + numberToWords(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 200) return 'seratus' + (n % 100 ? ' ' + numberToWords(n % 100) : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' ratus' + (n % 100 ? ' ' + numberToWords(n % 100) : '');
  if (n < 2000) return 'seribu' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
  if (n < 1000000) return numberToWords(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
  if (n < 1000000000) return numberToWords(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 ? ' ' + numberToWords(n % 1000000) : '');
  if (n < 1000000000000) return numberToWords(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 ? ' ' + numberToWords(n % 1000000000) : '');
  return numberToWords(Math.floor(n / 1000000000000)) + ' triliun' + (n % 1000000000000 ? ' ' + numberToWords(n % 1000000000000) : '');
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export class IndonesianTextNormalizer {
  /**
   * Full normalization pipeline for TTS.
   * @param {string} text - Raw text (may contain markdown, numbers, abbreviations)
   * @returns {string} Speech-ready Indonesian text
   */
  normalize(text) {
    if (!text) return '';
    let t = text;

    // 1. Strip markdown structure
    t = this.stripMarkdown(t);

    // 2. Strip URLs and file paths
    t = t.replace(/https?:\/\/[^\s]+/g, 'tautan web');
    t = t.replace(/\b[\w/\\]+\.(js|ts|mjs|json|py|sh|md|txt|pdf|docx)\b/gi, 'berkas');

    // 3. Strip code blocks (already handled by markdown strip, but extra safety)
    t = t.replace(/`[^`]+`/g, '');

    // 4. Normalize dates: DD/MM/YYYY or DD-MM-YYYY
    t = t.replace(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g, (_, d, m, y) => {
      const monthName = MONTHS_ID[parseInt(m, 10) - 1] || m;
      return `${numberToWords(parseInt(d, 10))} ${monthName} ${this.yearToWords(parseInt(y, 10))}`;
    });

    // 5. Normalize dates: YYYY-MM-DD (ISO)
    t = t.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => {
      const monthName = MONTHS_ID[parseInt(m, 10) - 1] || m;
      return `${numberToWords(parseInt(d, 10))} ${monthName} ${this.yearToWords(parseInt(y, 10))}`;
    });

    // 6. Currency: Rp 1.250.000 or Rp1250000
    t = t.replace(/Rp\.?\s*([\d.,]+)/gi, (_, num) => {
      const clean = num.replace(/[.,]/g, '').replace(/\D/g, '');
      const val = parseInt(clean, 10);
      return isNaN(val) ? 'sejumlah rupiah' : numberToWords(val) + ' rupiah';
    });

    // 7. Percentages: 33,8% or 33.8%
    t = t.replace(/([\d]+)[,\.]([\d]+)\s*%/g, (_, whole, dec) => {
      return `${numberToWords(parseInt(whole, 10))} koma ${numberToWords(parseInt(dec, 10))} persen`;
    });
    t = t.replace(/([\d]+)\s*%/g, (_, n) => {
      return `${numberToWords(parseInt(n, 10))} persen`;
    });

    // 8. Large numbers with dots (Indonesian thousand separator): 1.250.000
    t = t.replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g, (match) => {
      const n = parseInt(match.replace(/\./g, ''), 10);
      return isNaN(n) ? match : numberToWords(n);
    });

    // 9. Decimal numbers (comma as decimal, Indonesian style): 3,14
    t = t.replace(/\b(\d+),(\d+)\b/g, (_, whole, dec) => {
      return `${numberToWords(parseInt(whole, 10))} koma ${dec.split('').map(d => numberToWords(parseInt(d, 10))).join(' ')}`;
    });

    // 10. Remaining standalone integers (avoid replacing years handled above)
    t = t.replace(/\b(\d{5,})\b/g, (_, n) => {
      const val = parseInt(n, 10);
      return isNaN(val) ? n : numberToWords(val);
    });

    // 11. Abbreviations — word boundary match
    for (const [abbr, expansion] of Object.entries(ABBREVIATION_MAP)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'g');
      t = t.replace(regex, expansion);
    }

    // 12. Clean residual special characters
    t = t.replace(/[•·→↓↑←▼▸►]/g, '');
    t = t.replace(/\|/g, ',');
    t = t.replace(/—/g, ',');
    t = t.replace(/\s{2,}/g, ' ');
    t = t.trim();

    return t;
  }

  /**
   * Strip markdown formatting from text.
   */
  stripMarkdown(text) {
    let t = text;

    // Fenced code blocks → skip entirely (not useful for speech)
    t = t.replace(/```[\s\S]*?```/g, '');

    // Headings: ### Judul → "Judul."
    t = t.replace(/^#{1,6}\s+(.+)$/gm, '$1.');

    // Horizontal rules
    t = t.replace(/^[-*_]{3,}$/gm, '');

    // Bold/italic
    t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
    t = t.replace(/\*([^*]+)\*/g, '$1');
    t = t.replace(/__([^_]+)__/g, '$1');
    t = t.replace(/_([^_]+)_/g, '$1');

    // Inline code
    t = t.replace(/`([^`]+)`/g, '$1');

    // Bullet points → natural pause
    t = t.replace(/^[\s]*[-*+]\s+/gm, '');

    // Numbered lists: "1. " or "1) "
    t = t.replace(/^\s*\d+[.)]\s+/gm, '');

    // Blockquotes
    t = t.replace(/^>\s*/gm, '');

    // Links: [text](url) → text
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Images: ![alt](url) → skip
    t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

    // HTML tags
    t = t.replace(/<[^>]+>/g, '');

    // JSON-like artifacts
    t = t.replace(/\{[^}]{0,100}\}/g, '');
    t = t.replace(/\[[^\]]{0,100}\]/g, '');

    // Bracket tags like [9Router ...] [INITIALIZED ...]
    t = t.replace(/\[[A-Z_\s.]+\]/g, '');

    // Extra whitespace and newlines
    t = t.replace(/\n{3,}/g, '\n\n');
    t = t.replace(/[ \t]+/g, ' ');

    return t;
  }

  /**
   * Convert text to a spoken summary (max ~3 key sentences).
   * Used for voice output when the full text is too long.
   */
  toSpokenSummary(text, maxSentences = 4) {
    const normalized = this.normalize(text);
    const sentences = this.splitIntoSentences(normalized);
    if (sentences.length <= maxSentences) return sentences.join(' ');

    // Take intro + most informative sentences (heuristic: mid-section has most density)
    const selected = [
      sentences[0],
      ...sentences.slice(1, maxSentences - 1)
    ];
    return selected.join(' ');
  }

  /**
   * Split text into speech-appropriate sentence segments.
   * Respects paragraph boundaries and sentence structure.
   */
  splitIntoSentences(text) {
    if (!text) return [];
    const normalized = this.normalize(text);

    // Split by sentence-ending punctuation
    const raw = normalized.split(/(?<=[.!?])\s+(?=[A-ZA-z])/);

    // Merge very short fragments with the next sentence
    const merged = [];
    let buffer = '';
    for (const seg of raw) {
      const combined = (buffer + ' ' + seg).trim();
      if (buffer.length < 30) {
        buffer = combined;
      } else {
        merged.push(buffer);
        buffer = seg;
      }
    }
    if (buffer) merged.push(buffer);

    return merged.filter(s => s.trim().length > 0);
  }

  /**
   * Split text into paragraph-aware speech segments.
   * Splits on raw paragraph boundaries BEFORE normalization,
   * then normalizes each paragraph individually.
   */
  splitIntoParagraphs(text) {
    if (!text) return [];
    // Split on raw double-newlines first (paragraph boundaries)
    const rawParas = text.split(/\n{2,}/);
    return rawParas
      .map(p => this.normalize(p.replace(/\n/g, ' ').trim()))
      .filter(p => p.trim().length > 3);
  }

  yearToWords(year) {
    // e.g. 2026 → "dua ribu dua puluh enam"
    return numberToWords(year);
  }
}

export const indonesianTextNormalizerInstance = new IndonesianTextNormalizer();
export default indonesianTextNormalizerInstance;
