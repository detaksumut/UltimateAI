/**
 * scratch/setup_at_rqs_studio.mjs
 * Purges all remnants of 'Kelemahan dan kelebihan Regulasi Peraturan Desa'
 * and establishes the canonical AT-RQS™ 10-slide presentation in StudioSessionManager.
 */

import fs from 'fs';
import path from 'path';
import { studioSessionManagerInstance } from '../server/studio/core/StudioSessionManager.mjs';
import { slideStudioInstance } from '../server/studio/slide/SlideStudio.mjs';

const vaultPath = 'd:/Users/ultimateai/server/data/memory-vault.json';
if (fs.existsSync(vaultPath)) {
  try {
    const raw = fs.readFileSync(vaultPath, 'utf8');
    const vault = JSON.parse(raw);
    if (Array.isArray(vault)) {
      const filtered = vault.filter(item => {
        const text = (typeof item === 'string' ? item : (item.content || JSON.stringify(item))).toLowerCase();
        return !text.includes('regulasi peraturan desa') && !text.includes('peraturan desa');
      });
      fs.writeFileSync(vaultPath, JSON.stringify(filtered, null, 2), 'utf8');
      console.log(`[VAULT] Purged old topic. Remaining items: ${filtered.length}`);
    }
  } catch (e) {
    console.error('[VAULT] Clean error:', e.message);
  }
}

// 10 Canonical Slides specified by user for AT-RQS™ v1.0
const atRqsSlidePlan = [
  {
    number: 1,
    num: 1,
    title: "Judul Invensi & Ringkasan Identitas Paten",
    subtitle: "APASIFIC Tri-Source Research Quality Score™ (AT-RQS™) v1.0",
    archetype: "title_slide",
    purpose: "Invensi sistem pemrosesan ilmiah deterministik pertama yang menyatukan redaman bukti struktural dengan penguncian integritas kriptografis",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 2,
    num: 2,
    title: "Problematika Industri & Keterbatasan Prior Art",
    subtitle: "Distorsi Skala Heterogen, False High Score Rate, dan Circularity Bias LLM",
    archetype: "comparison_slide",
    purpose: "Model evaluasi ilmiah konvensional dan LLM generatif gagal akibat distorsi skala, bias sirkular, dan hilangnya penalti bukti empiris",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 3,
    num: 3,
    title: "Arsitektur Utama Sistem (Tri-Layer Engine)",
    subtitle: "Pipeline Deterministik Tiga Lapisan: Ingesti, Penilaian Matriks, dan Kriptografi",
    archetype: "framework_slide",
    purpose: "Pemrosesan deterministik tiga lapisan menjamin konversi data dari ingesti masukan mentah hingga audit internal yang tamper-evident",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 4,
    num: 4,
    title: "Lapisan 1: Ingesti Data & Normalisasi Tri-Source",
    subtitle: "Transformasi Masukan Multi-Sumber ke Skala Terpadu [0, 100]",
    archetype: "process_slide",
    purpose: "Transformasi masukan multi-sumber ke skala terpadu [0, 100] tanpa risiko manipulasi linier",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 5,
    num: 5,
    title: "Lapisan 2: Matrix 7 Dimensi & Base Weighted Score (BWS)",
    subtitle: "Penilaian Kualitas Substantif Terbobot Mutlak Sum(Wi) = 1.00",
    archetype: "grid_slide",
    purpose: "Penilaian kualitas substansial dilakukan via 7 dimensi terkalibrasi dengan total bobot mutlak",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 6,
    num: 6,
    title: "Lapisan 2: Mesin Redaman Terikat (AECI & CF)",
    subtitle: "Evidence Consistency Index dan Consistency Factor Penalti Non-Linier",
    archetype: "matrix_slide",
    purpose: "Mekanisme penalti non-linier meredam skor naskah tanpa bukti metodologis tepat hingga 15% tanpa penalti ganda",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 7,
    num: 7,
    title: "Pengisolasian Bias Sirkular (AAC) & Validator Skema Independen",
    subtitle: "Isolasi Topologis Assessment Confidence dari Pengali Mutu",
    archetype: "hierarchy_slide",
    purpose: "Menghilangkan confidence inflation AI dengan mengisolasi skor keyakinan dari pengali kualitas mutu",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 8,
    num: 8,
    title: "Lapisan 3: Integritas & Penguncian Ledger SHA-256",
    subtitle: "Serialisasi RFC 8785 Canonical JSON & Timestamped Immutable Ledger",
    archetype: "dashboard_slide",
    purpose: "Membekukan seluruh hasil evaluasi ke dalam format canonical yang tidak dapat dimanipulasi (tamper-evident)",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 9,
    num: 9,
    title: "Pembuktian Empiris & Data Ablasi (N = 24)",
    subtitle: "Reduksi MAE dari 14.8 ke 3.8 & Eliminasi Total False High Score",
    archetype: "metrics_slide",
    purpose: "Pengujian menunjukkan AT-RQS™ v1.0 berhasil menekan error hingga 3.8 poin serta mengeliminasi total false high score dan bias sirkular",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  },
  {
    number: 10,
    num: 10,
    title: "Strategi Perlindungan Hukum Paten & Roadmap Global",
    subtitle: "20 Klaim Perlindungan Komprehensif, Fallback Ladder, dan WIPO/PCT Filing",
    archetype: "timeline_slide",
    purpose: "Perlindungan 20 klaim komprehensif didukung Fallback Ladder tangguh untuk menghadapi pemeriksaan DJKI & WIPO/PCT",
    status: "PENDING",
    version: 1,
    artifact: null,
    revisionNotes: null
  }
];

const projectTitle = "APASIFIC Tri-Source Research Quality Score™ (AT-RQS™)";
console.log(`[SETUP] Initializing canonical project: "${projectTitle}"`);

const session = studioSessionManagerInstance.createOrUpdateSlideSession({
  projectId: "PATENT-AT-RQS-V1",
  deckId: "PATENT-AT-RQS-V1",
  projectTitle,
  totalSlides: 10,
  currentSlide: 1,
  slidePlan: atRqsSlidePlan,
  phase: "PRODUCTION",
  status: "ACTIVE"
});

console.log(`[SETUP] Session activeStudio=SLIDE_STUDIO saved to disk.`);

// Render Slide 1 immediately!
const s1 = atRqsSlidePlan[0];
console.log(`[RENDER] Rendering Slide 1: "${s1.title}"...`);

const prompt = `Slide 1 Judul: "${s1.title}", Subjudul: "${s1.subtitle}", landscape, corporate patent executive, APASIFIC Tri-Source Research Quality Score`;
const result = await slideStudioInstance.createSlide(prompt, {
  forceType: s1.archetype,
  context: {
    topic: projectTitle,
    slideNumber: 1,
    totalSlides: 10,
    deckId: "PATENT-AT-RQS-V1"
  }
});

session.updateSlideStatus(1, "LOCKED", {
  path: result.files.preview.path,
  pptxPath: result.files.pptx.path,
  title: result.title
});

session.currentSlide = 1;
session.artifacts['slide_1'] = {
  path: result.files.preview.path,
  pptxPath: result.files.pptx.path,
  title: result.title,
  slideType: result.slideType,
  schema: result.schema,
  layout: result.layout,
  updatedAt: new Date().toISOString()
};

studioSessionManagerInstance.updateSession('SLIDE_STUDIO', {
  currentSlide: 1,
  execution: session.execution,
  slidePlan: session.slidePlan,
  artifacts: session.artifacts
});

console.log(`[RENDER] Slide 1 rendered successfully: ${result.files.preview.path}`);
console.log(`[RENDER] PPTX: ${result.files.pptx.path}`);
