/**
 * SlideStudio.mjs
 * End-to-end corporate slide renderer: prompt -> structured schema -> SVG/PNG/PPTX -> QA.
 * Generated PPTX uses editable PowerPoint text and shapes, not a flattened screenshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { slideRendererInstance } from './SlideRenderer.mjs';
import { slideQAInstance } from './SlideQA.mjs';
import { slideDeckPlannerInstance } from './SlideDeckPlanner.mjs';
import { slidePlannerInstance } from './SlidePlanner.mjs';

const DEFAULT_ARTIFACTS_DIR = path.resolve(
  process.env.JIN_SLIDE_ARTIFACTS_DIR || path.join(process.cwd(), 'storage', 'artifacts', 'slides')
);

function plain(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
function safeSlug(value) {
  return plain(value).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'slide';
}
function extractTitle(prompt) {
  const raw = plain(prompt);
  const quoted = raw.match(/[“"']([^”"']{3,180})[”"']/);
  if (quoted) return plain(quoted[1]);
  return plain(raw
    .replace(/^\s*(?:jin|jini)\s*/i, '')
    .replace(/^\s*(?:buatkan|buat|bikin|bikinkan|generate|create|render|tampilkan)\s*/i, '')
    .replace(/^\s*(?:visual\s+)?(?:slide\s+presentasi|presentasi|presentation|powerpoint|pptx?|slide)\s*/i, '')
    .replace(/\b(?:landscape|corporate enterprise|enterprise style|gaya korporat|rasio\s*16:9)\b/gi, '')
    .replace(/\b\d{1,2}\s*(?:slide|slides|halaman)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()) || 'Corporate Strategy and Implementation';
}
function asBullet(text, title) {
  return { title: plain(title || text), text: plain(text) };
}

function makeContent(topic, archetype, context = {}) {
  const sections = {
    comparison_slide: {
      subtitle: 'Perbandingan eksekutif untuk menilai manfaat, keterbatasan, dan keputusan implementasi.',
      left: ['Kebutuhan Lokal: kebijakan dapat disesuaikan dengan konteks dan prioritas masyarakat.', 'Partisipasi: ruang konsultasi bagi warga dan pemangku kepentingan.', 'Kecepatan Respons: keputusan operasional dapat lebih dekat dengan kebutuhan lapangan.', 'Akuntabilitas: tanggung jawab lokal dapat dibuat lebih terlihat.', 'Inovasi Layanan: peluang untuk mencoba solusi yang relevan dengan kondisi setempat.'],
      right: ['Kapasitas Beragam: kompetensi dan sumber daya dapat berbeda antarlokasi.', 'Kualitas Data: keputusan membutuhkan data yang cukup dan mutakhir.', 'Tata Kelola: pembagian wewenang dan proses persetujuan harus jelas.', 'Pengawasan: mekanisme audit dan pelaporan harus berfungsi.', 'Keberlanjutan: pendanaan, SDM, dan pemeliharaan perlu direncanakan.'],
      leftTitle: 'KELEBIHAN REGULASI PERDES',
      rightTitle: 'KEKURANGAN / RISIKO IMPLEMENTASI',
      takeaway: 'Kebijakan yang baik menyeimbangkan kebutuhan lokal, kapasitas pelaksana, dan pengawasan.',
      conclusion: 'Verifikasi setiap implikasi hukum dengan peraturan dan sumber resmi sebelum dipakai sebagai nasihat hukum.'
    },
    title_slide: {
      subtitle: 'Executive briefing · Tujuan, konteks, dan arah pembahasan.',
      left: ['Tujuan dan hasil yang diharapkan.', 'Konteks organisasi atau kebijakan.', 'Ruang lingkup pembahasan.'],
      right: ['Keputusan yang dibutuhkan.', 'Audiens utama dan pemangku kepentingan.', 'Langkah berikutnya yang disarankan.'],
      leftTitle: 'EXECUTIVE OVERVIEW',
      rightTitle: 'MEETING OBJECTIVES',
      takeaway: context.presenter?.name ? 'Pemateri: ' + context.presenter.name : 'Satu pesan utama, didukung struktur dan bukti yang jelas.',
      conclusion: context.presenter?.title ? context.presenter.title + (context.presenter.institution ? ' · ' + context.presenter.institution : '') : 'Corporate Enterprise · Draft for review.'
    },
    quote_slide: {
      subtitle: 'Prinsip utama yang menjadi dasar analisis dan tindakan.',
      left: ['Urgensi: jelaskan masalah yang perlu dipecahkan.', 'Akuntabilitas: nyatakan pihak yang bertanggung jawab.', 'Transparansi: tunjukkan asumsi dan dasar keputusan.', 'Proporsionalitas: sesuaikan respons dengan dampak.', 'Evaluasi: tetapkan indikator dan siklus peninjauan.'],
      right: ['Pilar 1 — tujuan yang jelas.', 'Pilar 2 — bukti yang dapat diperiksa.', 'Pilar 3 — tanggung jawab yang terukur.', 'Pilar 4 — pengawasan yang berjalan.', 'Pilar 5 — perbaikan berkelanjutan.'],
      leftTitle: 'URGENSI & PRINSIP',
      rightTitle: 'PILAR PELAKSANAAN',
      takeaway: 'Prinsip menjadi operasional ketika diterjemahkan menjadi keputusan dan indikator.',
      conclusion: 'Sesuaikan konten dengan konteks dan sumber resmi yang relevan.'
    },
    hierarchy_slide: {
      subtitle: 'Struktur kewenangan dan hubungan antar lapisan.',
      left: ['TINGKAT 1 — landasan dan mandat utama.', 'TINGKAT 2 — kebijakan dan aturan turunan.', 'TINGKAT 3 — standar operasional.', 'TINGKAT 4 — pelaksanaan dan layanan.', 'TINGKAT 5 — pemantauan dan evaluasi.'],
      right: ['Mandat: siapa berwenang memutuskan.', 'Standar: apa yang harus dipenuhi.', 'Proses: bagaimana keputusan dijalankan.', 'Kontrol: bagaimana risiko dipantau.', 'Umpan balik: bagaimana kebijakan diperbaiki.'],
      leftTitle: 'TINGKATAN KERANGKA',
      rightTitle: 'TATA KELOLA & KONTROL',
      takeaway: 'Peran, batas kewenangan, dan mekanisme eskalasi harus dapat ditelusuri.',
      conclusion: 'Struktur ilustratif; pastikan pemetaan akhir sesuai sumber regulasi yang berlaku.'
    },
    process_slide: {
      subtitle: 'Alur kerja dari perencanaan hingga evaluasi.',
      left: ['Perencanaan: tetapkan kebutuhan dan tujuan.', 'Penyusunan: siapkan rancangan dan dasar bukti.', 'Konsultasi: libatkan pihak terkait.', 'Penetapan: lakukan pemeriksaan dan persetujuan.', 'Pengundangan: publikasikan serta dokumentasikan.'],
      right: ['Pemilik proses: tetapkan tanggung jawab.', 'Input: kumpulkan data dan dokumen.', 'Quality Gate: verifikasi isi dan kepatuhan.', 'Output: hasil yang dapat dipantau.', 'Review: evaluasi dampak dan tindak lanjut.'],
      leftTitle: 'PERENCANAAN → PENGUNDANGAN',
      rightTitle: 'KONTROL PROSES',
      takeaway: 'Setiap tahap membutuhkan pemilik, keluaran, dan pemeriksaan mutu.',
      conclusion: 'Urutan proses perlu disesuaikan dengan prosedur resmi yang berlaku.'
    },
    grid_slide: {
      subtitle: 'Peta area kerja dan cakupan utama.',
      left: ['People: kapasitas dan akuntabilitas.', 'Process: alur kerja dan standar.', 'Data: kualitas serta kepemilikan.', 'Technology: alat dan integrasi.', 'Governance: risiko dan kepatuhan.'],
      right: ['Prioritas 1: hasil bagi pengguna.', 'Prioritas 2: keandalan operasi.', 'Prioritas 3: integritas data.', 'Prioritas 4: keamanan dan privasi.', 'Prioritas 5: pengukuran dan perbaikan.'],
      leftTitle: 'DOMAIN CAKUPAN',
      rightTitle: 'PRIORITAS IMPLEMENTASI',
      takeaway: 'Koordinasikan domain secara terpadu agar tidak membangun solusi terpisah.',
      conclusion: 'Peta cakupan adalah kerangka awal, bukan pengganti analisis kebutuhan.'
    },
    data_slide: {
      subtitle: 'Kerangka penyajian data dan temuan.',
      left: ['Metrik utama: definisi dan satuan.', 'Baseline: nilai awal yang bersumber.', 'Tren: perubahan dari waktu ke waktu.', 'Segmentasi: perbedaan yang relevan.', 'Keterbatasan: gap dan ketidakpastian.'],
      right: ['Sumber: tautan dan tanggal akses.', 'Metode: cara pengumpulan dan hitung.', 'Validasi: pemeriksaan silang.', 'Visual: grafik sesuai tipe data.', 'Implikasi: keputusan yang didukung.'],
      leftTitle: 'DATA & TEMUAN',
      rightTitle: 'KUALITAS BUKTI',
      takeaway: 'Jangan mengisi data numerik yang belum tersedia dengan angka rekaan.',
      conclusion: 'Masukkan angka aktual beserta sumbernya sebelum publikasi.'
    },
    stakeholder_slide: {
      subtitle: 'Peran, kepentingan, dan mekanisme kolaborasi.',
      left: ['Pimpinan: arah dan keputusan.', 'Tim pelaksana: eksekusi dan pelaporan.', 'Pengguna: kebutuhan dan umpan balik.', 'Mitra: dukungan dan dependensi.', 'Pengawas: jaminan dan kontrol.'],
      right: ['RACI: peran yang jelas.', 'Forum koordinasi: keputusan terdokumentasi.', 'Kanal komunikasi: informasi konsisten.', 'Eskalasi: penyelesaian hambatan.', 'Review: tindak lanjut berbasis bukti.'],
      leftTitle: 'PEMANGKU KEPENTINGAN',
      rightTitle: 'MODEL KOLABORASI',
      takeaway: 'Kolaborasi efektif memerlukan pemilik keputusan dan jalur komunikasi yang jelas.',
      conclusion: 'Validasi nama organisasi, peran, dan kewenangan pada konteks proyek.'
    },
    timeline_slide: {
      subtitle: 'Tahap pelaksanaan dan titik pemeriksaan.',
      left: ['Fase 1: persiapan dan baseline.', 'Fase 2: desain dan validasi.', 'Fase 3: pilot dan evaluasi.', 'Fase 4: perluasan bertahap.', 'Fase 5: operasi dan optimasi.'],
      right: ['Milestone: hasil yang dapat diverifikasi.', 'Dependensi: prasyarat dan hambatan.', 'Owner: satu penanggung jawab.', 'Risiko: pemicu dan mitigasi.', 'Review: kriteria lanjut atau berhenti.'],
      leftTitle: 'ROADMAP TAHAPAN',
      rightTitle: 'MILESTONE & KONTROL',
      takeaway: 'Gunakan tahapan yang dapat diukur, bukan tanggal yang belum dikonfirmasi.',
      conclusion: 'Ganti fase ilustratif dengan jadwal proyek aktual sebelum diedarkan.'
    },
    risk_slide: {
      subtitle: 'Identifikasi risiko, dampak, serta pengendalian.',
      left: ['Strategic: tujuan dan prioritas.', 'Operational: kapasitas dan dependensi.', 'Financial: anggaran dan biaya.', 'Data: kualitas, akses, dan privasi.', 'Compliance: aturan dan audit.'],
      right: ['Likelihood: peluang kejadian.', 'Impact: tingkat konsekuensi.', 'Mitigation: tindakan pengendalian.', 'Owner: pihak bertanggung jawab.', 'Residual risk: risiko setelah mitigasi.'],
      leftTitle: 'KATEGORI RISIKO',
      rightTitle: 'PENGENDALIAN',
      takeaway: 'Risiko harus memiliki penanggung jawab, mitigasi, dan indikator pemantauan.',
      conclusion: 'Rating risiko perlu ditetapkan berdasarkan asesmen dan bukti aktual.'
    },
    recommendation_slide: {
      subtitle: 'Pilihan tindakan, dasar pertimbangan, dan langkah awal.',
      left: ['Rekomendasi 1: selesaikan hambatan kritis.', 'Rekomendasi 2: gunakan bukti terverifikasi.', 'Rekomendasi 3: uji coba sebelum perluasan.', 'Rekomendasi 4: tetapkan pemilik hasil.', 'Rekomendasi 5: ukur dampak.'],
      right: ['Dampak: hasil yang diharapkan.', 'Biaya: kebutuhan sumber daya.', 'Risiko: konsekuensi dan mitigasi.', 'Waktu: dependensi implementasi.', 'Keputusan: persetujuan yang diperlukan.'],
      leftTitle: 'REKOMENDASI',
      rightTitle: 'KRITERIA KEPUTUSAN',
      takeaway: 'Prioritaskan langkah yang berdampak, dapat dijalankan, dan terukur.',
      conclusion: 'Rekomendasi masih berupa kerangka; sesuaikan dengan temuan aktual.'
    },
    KPI_dashboard_slide: {
      subtitle: 'Indikator kinerja dan mekanisme pemantauan.',
      left: ['Outcome: hasil untuk pengguna.', 'Output: produk atau layanan.', 'Quality: ketepatan dan konsistensi.', 'Efficiency: biaya dan waktu.', 'Risk: insiden dan penyelesaian.'],
      right: ['Definisi metrik: jelas dan konsisten.', 'Baseline: catat nilai awal.', 'Target: disetujui pemilik.', 'Frekuensi: jadwal pembaruan.', 'Owner: penanggung jawab data.'],
      leftTitle: 'AREA KINERJA',
      rightTitle: 'KONTROL METRIK',
      takeaway: 'Tampilkan target hanya jika sudah ditetapkan dan punya pemilik.',
      conclusion: 'Nilai, baseline, dan target belum dimasukkan secara otomatis.'
    },
    table_slide: {
      subtitle: 'Matriks ringkas untuk analisis dan keputusan.',
      left: ['Kriteria: apa yang dibandingkan.', 'Kondisi saat ini: data atau fakta.', 'Gap: selisih terhadap target.', 'Dampak: konsekuensi terukur.', 'Keputusan: tindakan yang dibutuhkan.'],
      right: ['Sumber: asal informasi.', 'Owner: pihak yang mengelola.', 'Tanggal: kapan diverifikasi.', 'Status: terbuka atau selesai.', 'Tindak lanjut: pemilik dan tenggat.'],
      leftTitle: 'ANALISIS',
      rightTitle: 'CATATAN VERIFIKASI',
      takeaway: 'Matriks yang baik menjaga fakta, interpretasi, dan keputusan tetap terpisah.',
      conclusion: 'Ganti isi contoh dengan tabel proyek atau dataset yang sebenarnya.'
    },
    roadmap_slide: {
      subtitle: 'Peta jalan yang bertahap dan dapat diawasi.',
      left: ['Foundation: tata kelola dan baseline.', 'Pilot: validasi asumsi penting.', 'Scale: perluasan terkendali.', 'Optimize: perbaikan berulang.', 'Sustain: operasi jangka panjang.'],
      right: ['Entry criteria: siap memulai.', 'Gate: syarat untuk lanjut.', 'Owner: pengambil tanggung jawab.', 'Measurement: bukti hasil.', 'Exit criteria: kondisi selesai.'],
      leftTitle: 'FASE ROADMAP',
      rightTitle: 'GATE & UKURAN',
      takeaway: 'Setiap fase memiliki syarat masuk, hasil, dan syarat selesai.',
      conclusion: 'Waktu dan sumber daya harus berasal dari rencana yang disetujui.'
    },
    metric_slide: {
      subtitle: 'Kerangka indikator, baseline, dan target.',
      left: ['Kapasitas: sumber daya tersedia.', 'Waktu: durasi proses.', 'Mutu: kesesuaian standar.', 'Adopsi: penggunaan oleh sasaran.', 'Dampak: hasil akhir.'],
      right: ['Satuan: cara mengukur.', 'Baseline: nilai pembanding.', 'Target: hasil yang disepakati.', 'Frekuensi: waktu pengukuran.', 'Validasi: sumber dan metode.'],
      leftTitle: 'DIMENSI UKUR',
      rightTitle: 'DEFINISI INDIKATOR',
      takeaway: 'Indikator bernilai ketika definisi dan metode hitungnya dapat diulang.',
      conclusion: 'Tidak ada angka yang diasumsikan; isi dengan data terverifikasi.'
    },
    case_study_slide: {
      subtitle: 'Struktur studi kasus untuk memisahkan fakta dan interpretasi.',
      left: ['Konteks: organisasi dan situasi.', 'Tantangan: masalah yang dirasakan.', 'Intervensi: tindakan yang dilakukan.', 'Hasil: perubahan yang tercatat.', 'Pelajaran: faktor keberhasilan.'],
      right: ['Sumber: dokumen atau wawancara.', 'Baseline: kondisi awal.', 'Periode: rentang pengukuran.', 'Batasan: faktor pengganggu.', 'Transferabilitas: apa yang bisa dipelajari.'],
      leftTitle: 'NARASI KASUS',
      rightTitle: 'VALIDITAS TEMUAN',
      takeaway: 'Contoh ilustratif harus diberi label agar tidak disalahartikan sebagai kasus nyata.',
      conclusion: 'Gunakan data kasus yang dapat diverifikasi sebelum publikasi.'
    },
    policy_slide: {
      subtitle: 'Tujuan, opsi kebijakan, implikasi, dan kontrol.',
      left: ['Masalah publik: definisi kebutuhan.', 'Tujuan: hasil yang dituju.', 'Opsi: alternatif tindakan.', 'Trade-off: biaya dan manfaat.', 'Implementasi: jalur pelaksanaan.'],
      right: ['Dasar hukum: sumber resmi.', 'Kewenangan: pemilik keputusan.', 'Dampak: kelompok yang terdampak.', 'Pengawasan: indikator dan audit.', 'Evaluasi: hasil serta koreksi.'],
      leftTitle: 'DESAIN KEBIJAKAN',
      rightTitle: 'KEPATUHAN & DAMPAK',
      takeaway: 'Pilihan kebijakan perlu menyatakan bukti, konsekuensi, dan batasan.',
      conclusion: 'Verifikasi dasar hukum terhadap dokumen resmi terkini.'
    },
    implementation_slide: {
      subtitle: 'Rencana pelaksanaan yang operasional dan terukur.',
      left: ['Workstream: ruang lingkup kerja.', 'Owner: penanggung jawab.', 'Deliverable: keluaran konkret.', 'Dependency: prasyarat penting.', 'Acceptance: kriteria selesai.'],
      right: ['Kick-off: persetujuan ruang lingkup.', 'Execution: jalankan pekerjaan.', 'QA: cek keluaran.', 'Handover: serahkan ke operasi.', 'Review: ukur hasil.'],
      leftTitle: 'WORKSTREAM',
      rightTitle: 'MILESTONE PELAKSANAAN',
      takeaway: 'Bagi pekerjaan menjadi keluaran terukur dengan pemilik dan kriteria penerimaan.',
      conclusion: 'Nama owner, deadline, dan budget perlu diisi sesuai proyek.'
    },
    checklist_slide: {
      subtitle: 'Keputusan dan tindak lanjut yang dapat dipantau.',
      left: ['Konfirmasi tujuan dan ruang lingkup.', 'Validasi fakta dan sumber.', 'Tetapkan pemilik dan tenggat.', 'Selesaikan risiko utama.', 'Dokumentasikan keputusan.'],
      right: ['Approval: pihak yang menyetujui.', 'Evidence: dokumen pendukung.', 'Status: belum mulai atau selesai.', 'Escalation: jalur hambatan.', 'Follow-up: waktu peninjauan.'],
      leftTitle: 'CHECKLIST TINDAKAN',
      rightTitle: 'GOVERNANCE',
      takeaway: 'Tutup setiap keputusan dengan pemilik tindakan dan tenggat yang jelas.',
      conclusion: 'Checklist ini adalah kerangka awal yang perlu disesuaikan.'
    },
    closing_slide: {
      subtitle: 'Rangkuman keputusan utama dan tindakan berikutnya.',
      left: ['Pesan utama yang perlu diingat.', 'Keputusan yang perlu dibuat.', 'Hasil yang ingin dicapai.', 'Risiko yang harus dikelola.', 'Ukuran keberhasilan.'],
      right: ['Langkah pertama.', 'Penanggung jawab.', 'Tenggat yang disepakati.', 'Sumber dan dokumentasi.', 'Jadwal evaluasi.'],
      leftTitle: 'KEY TAKEAWAYS',
      rightTitle: 'NEXT STEPS',
      takeaway: 'Satukan keputusan, pemilik tindakan, dan ukuran hasil.',
      conclusion: 'Terima kasih · Diskusi dan tindak lanjut.'
    }
  };
  const chosen = sections[archetype] || sections.comparison_slide;
  return {
    subtitle: chosen.subtitle,
    leftTitle: chosen.leftTitle,
    rightTitle: chosen.rightTitle,
    leftItems: [...chosen.left],
    rightItems: [...chosen.right],
    takeaway: chosen.takeaway,
    conclusion: chosen.conclusion
  };
}

function uniqueSlideSchema(topic, archetype, options = {}) {
  const context = options.context || {};
  const content = makeContent(topic, archetype, context);
  const presenter = context.presenter;
  const leftItems = content.leftItems.slice();
  if (presenter?.name) leftItems[0] = 'Pemateri: ' + presenter.name;
  const elements = Array.isArray(context.specElements) ? context.specElements : [];
  if (elements.length >= 2) {
    // Respect authored content from the upstream visual spec when present.
    const custom = elements.map(element => plain(element.text || element.title || '')).filter(Boolean).slice(0, 10);
    if (custom.length) leftItems.splice(0, Math.min(leftItems.length, custom.length), ...custom);
  }
  return {
    version: 'JIN.VisualDesignSpec/1.0',
    domain: 'PRESENTATION',
    requestId: context.requestId || 'req-slide-' + Date.now(),
    metadata: {
      audience: context.audience || 'Corporate / Enterprise Stakeholders',
      evidencePolicy: 'Facts, figures, and legal claims require source verification; this slide uses clearly labeled illustrative content where no sources were provided.',
      topic
    },
    theme: {
      style: plain(options.theme || context.theme || 'corporate-enterprise'),
      primaryColor: context.primaryColor || '#0F766E',
      accentColor: context.accentColor || '#2DD4BF'
    },
    canvas: { width: 1920, height: 1080, aspectRatio: '16:9' },
    header: { title: topic, subtitle: plain(context.subtitle || content.subtitle) },
    columns: [
      { title: content.leftTitle, items: leftItems.map(item => asBullet(item)) },
      { title: content.rightTitle, items: content.rightItems.map(item => asBullet(item)) }
    ],
    elements,
    footer: { takeaway: content.takeaway, conclusion: content.conclusion },
    style: {
      family: 'corporate-enterprise',
      aspectRatio: '16:9',
      typography: 'Aptos',
      density: 'executive'
    }
  };
}

export class SlideStudio {
  constructor({ artifactsDir = DEFAULT_ARTIFACTS_DIR, renderer = slideRendererInstance, qa = slideQAInstance } = {}) {
    this.artifactsDir = artifactsDir;
    this.renderer = renderer;
    this.qa = qa;
    this._ensureDir();
  }

  _ensureDir() {
    fs.mkdirSync(this.artifactsDir, { recursive: true });
  }

  _inferSlideType(prompt, options = {}) {
    if (options.forceType) return options.forceType;
    const low = String(prompt || '').toLowerCase();
    if (/kelebihan|kekurangan|perbandingan|comparison|versus|\bvs\b/.test(low)) return 'comparison_slide';
    return slidePlannerInstance.detectArchetype(prompt);
  }

  async createSlide(prompt = '', options = {}) {
    const rawPrompt = plain(prompt);
    if (!rawPrompt) return { success: false, error: 'EMPTY_PROMPT', reasonCode: 'INVALID_INPUT' };
    const topic = extractTitle(rawPrompt);
    const slideType = this._inferSlideType(rawPrompt, options);
    const schema = uniqueSlideSchema(topic, slideType, options);
    const rendered = await this.renderer.render(schema);
    const qaReport = await this.qa.audit(schema, rendered);
    if (!rendered.success || !qaReport.passed) {
      return {
        success: false,
        error: 'Slide rendering or QA did not pass.',
        reasonCode: 'SLIDE_QA_FAILED',
        schema,
        qaReport,
        renderError: rendered.error || null
      };
    }

    this._ensureDir();
    const stem = safeSlug(topic) + '-' + Date.now();
    const svgPath = path.join(this.artifactsDir, stem + '.svg');
    const previewPath = path.join(this.artifactsDir, stem + '.png');
    const pptxPath = path.join(this.artifactsDir, stem + '.pptx');
    fs.writeFileSync(svgPath, rendered.svg, 'utf8');
    fs.writeFileSync(previewPath, rendered.previewBuffer);
    fs.writeFileSync(pptxPath, rendered.pptxBuffer);

    const files = {
      svg: { path: svgPath, length: Buffer.byteLength(rendered.svg, 'utf8') },
      preview: { path: previewPath, length: rendered.previewBuffer.length },
      pptx: { path: pptxPath, length: rendered.pptxBuffer.length }
    };
    const slideNumber = Number(options.context?.slideNumber || 1);
    const pptxArtifact = {
      artifactType: 'PRESENTATION',
      format: 'pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      path: pptxPath,
      fileName: path.basename(pptxPath),
      sizeBytes: rendered.pptxBuffer.length
    };
    return {
      success: true,
      slideType,
      title: schema.header.title,
      subtitle: schema.header.subtitle,
      schema,
      svg: rendered.svg,
      previewBuffer: rendered.previewBuffer,
      pptxBuffer: rendered.pptxBuffer,
      files,
      pptxArtifact,
      qaReport,
      executionMs: 0,
      slideNumber,
      artifactType: 'PRESENTATION_SLIDE',
      approvalStatus: 'DRAFT'
    };
  }

  async exportDeck(session = {}) {
    const projectTitle = plain(session?.projectTitle || session?.project?.title || 'Corporate Presentation');
    const total = Math.min(60, Math.max(1, Number(session?.totalSlides || session?.slides?.total || session?.requestedSlideCount || 20)));
    const plan = Array.isArray(session?.slidePlan) && session.slidePlan.length
      ? session.slidePlan.slice(0, total)
      : slidePlannerInstance.createCanonicalDeckPlan(projectTitle, total);
    const schemas = plan.map((item, index) => {
      const title = plain(item.title || item.objective || ('Slide ' + (index + 1)));
      return uniqueSlideSchema(title, item.archetype || 'framework_slide', {
        context: {
          slideNumber: index + 1,
          audience: 'Corporate / Enterprise Stakeholders',
          requestId: 'deck-' + safeSlug(projectTitle) + '-' + (index + 1)
        }
      });
    });
    const pptxBuffer = typeof this.renderer.renderDeckPptx === 'function'
      ? await this.renderer.renderDeckPptx(schemas)
      : await this.renderer.renderPptx(schemas[0]);
    const filePath = path.join(this.artifactsDir, safeSlug(projectTitle) + '-' + Date.now() + '.pptx');
    fs.writeFileSync(filePath, pptxBuffer);
    return {
      success: true,
      topic: projectTitle,
      slideCount: schemas.length,
      pptxPath: filePath,
      sizeBytes: pptxBuffer.length,
      approvalStatus: 'DRAFT'
    };
  }
}

export const slideStudioInstance = new SlideStudio();
export default slideStudioInstance;
