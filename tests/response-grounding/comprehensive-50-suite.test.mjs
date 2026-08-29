/**
 * comprehensive-50-suite.test.mjs
 * Comprehensive 50-Test Suite for JIN Response Grounding, Capability Truth, UI Reality, and Anti-Hallucination.
 */

import { responseGroundingGuardInstance } from '../../server/grounding/ResponseGroundingGuard.mjs';
import { isCapabilityAvailable, getAvailableCapabilities, getUnavailableCapabilities } from '../../server/grounding/CapabilityRegistry.mjs';

console.log('\n========================================================================');
console.log('ðŸ§ª JIN RESPONSE GROUNDING & CAPABILITY TRUTH â€” 50 AUTOMATED TESTS');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function assertTest(testNum, title, condition, failureReason = '') {
  if (condition) {
    console.log(`âœ… [TEST ${String(testNum).padStart(2, '0')}] ${title}`);
    passCount++;
  } else {
    console.error(`âŒ [TEST ${String(testNum).padStart(2, '0')}] ${title} â€” FAILED: ${failureReason}`);
    failCount++;
  }
}

// =========================================================================
// CATEGORY 1: SIMPLE QUESTIONS & MINIMUM SUFFICIENT RESPONSE (Tests 01 - 08)
// =========================================================================

// Test 01
{
  const raw = `Siap, Rahman. Sistem JIN Audio Ingestion Pipeline aktif dan siap menerima berkas Anda. Karena kita berada dalam sesi antarmuka UltimateAI, Anda dapat memberikan file audio melalui beberapa cara... Lampirkan File... Tautan / URL Audio... Gunakan Modul SpeechSense Pro (HTML App di Atas)... Saya akan segera mengeksekusi transkripsi, diarization pembicara, serta ekstraksi poin penting.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Saya mau transkripsi audio');
  assertTest(1, 'Simple Audio Request: Strip 5-paragraph lecture into direct response',
    guarded.cleanedText.includes('Silakan upload file audionya') && !guarded.cleanedText.includes('Audio Ingestion Pipeline'),
    guarded.cleanedText
  );
}

// Test 02
{
  const raw = `Silakan upload berkas audio Anda melalui modul yang tersedia untuk diproses secara komprehensif.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Silakan upload audio');
  assertTest(2, 'Simple Upload Invitation: Normalized to concise prompt',
    guarded.cleanedText === 'Silakan upload file audionya.',
    guarded.cleanedText
  );
}

// Test 03
{
  const guarded = responseGroundingGuardInstance.guard('Halo! Ada yang bisa saya bantu hari ini?', 'Halo JIN');
  assertTest(3, 'Simple Greeting: Kept natural and concise',
    guarded.cleanedText.includes('Halo') && guarded.cleanedText.length < 100,
    guarded.cleanedText
  );
}

// Test 04
{
  const raw = `Tentu! Sistem JIN Multi-modal Cognition Subsystem siap membantu Anda.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Bisa bantu saya?');
  assertTest(4, 'Simple Assistance Request: Fabricated subsystem stripped',
    !guarded.cleanedText.includes('Cognition Subsystem'),
    guarded.cleanedText
  );
}

// Test 05
{
  const raw = `Baik, silakan kirimkan naskah yang ingin dirangkum.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Tolong rangkumkan teks ini');
  assertTest(5, 'Simple Summarize Request: Direct and grounded',
    guarded.cleanedText.includes('rangkum'),
    guarded.cleanedText
  );
}

// Test 06
{
  const raw = `Bisa. Silakan kirimkan dokumen yang ingin dianalisis.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Bisa baca file PDF?');
  assertTest(6, 'PDF Capability Query: Grounded direct answer',
    guarded.cleanedText.includes('dokumen') || guarded.cleanedText.includes('Bisa'),
    guarded.cleanedText
  );
}

// Test 07
{
  const raw = `Sama-sama! Senang bisa membantu Anda.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Terima kasih');
  assertTest(7, 'Gratitude Response: Friendly and grounded',
    guarded.cleanedText.includes('Sama-sama') || guarded.cleanedText.includes('membantu'),
    guarded.cleanedText
  );
}

// Test 08
{
  const raw = `Sampai jumpa! Hubungi saya kapan saja jika Anda membutuhkan bantuan riset.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Selamat tinggal');
  assertTest(8, 'Farewell Response: Clean and concise',
    guarded.cleanedText.includes('jumpa') || guarded.cleanedText.includes('bantuan'),
    guarded.cleanedText
  );
}

// =========================================================================
// CATEGORY 2: AUDIO INGESTION & TRANSCRIPTION REQUESTS (Tests 09 - 16)
// =========================================================================

// Test 09
{
  const raw = `Siap. JIN Audio Ingestion Pipeline telah aktif untuk menerima berkas MP3 Anda.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Ini file rekaman rapat saya');
  assertTest(9, 'Audio file upload: Fabricated pipeline name sanitized',
    !guarded.cleanedText.includes('Audio Ingestion Pipeline'),
    guarded.cleanedText
  );
}

// Test 10
{
  const raw = `Saya akan memproses audio Anda dan mengekstrak transkrip teks lengkap.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Tolong transkrip rekaman ini');
  assertTest(10, 'Audio transcription execution: Grounded in real capability',
    isCapabilityAvailable('audio_transcription') && guarded.cleanedText.includes('transkrip'),
    guarded.cleanedText
  );
}

// Test 11
{
  const raw = `Format berkas yang didukung antara lain MP3, WAV, M4A, AAC, dan OGG hingga 25MB.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Format audio apa saja yang bisa?');
  assertTest(11, 'Audio format query: Accurate supported formats',
    guarded.cleanedText.includes('MP3') && guarded.cleanedText.includes('WAV'),
    guarded.cleanedText
  );
}

// Test 12
{
  const raw = `Saya dapat mentranskripsikan audio berbahasa Indonesia dan Inggris.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Bisa transkrip bahasa apa?');
  assertTest(12, 'Language support query: Accurate language scope',
    guarded.cleanedText.includes('Indonesia'),
    guarded.cleanedText
  );
}

// Test 13
{
  const raw = `Silakan unggah audionya melalui opsi lampiran file.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Bagaimana cara kirim audionya?');
  assertTest(13, 'Upload instruction: Grounded in standard attachment',
    !guarded.cleanedText.includes('SpeechSense Pro'),
    guarded.cleanedText
  );
}

// Test 14
{
  const raw = `Transkripsi selesai. Berikut adalah isi percakapan dari audio Anda.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Hasil transkripsi');
  assertTest(14, 'Transcription output delivery: Clean and focused',
    guarded.cleanedText.includes('Transkripsi'),
    guarded.cleanedText
  );
}

// Test 15
{
  const raw = `Ukuran maksimal file audio yang dianjurkan adalah 25 MB.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Berapa batas ukuran file?');
  assertTest(15, 'File size limit query: Verified limit stated',
    guarded.cleanedText.includes('25'),
    guarded.cleanedText
  );
}

// Test 16
{
  const raw = `File audio terdeteksi kosong atau rusak. Silakan coba unggah kembali berkas yang valid.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Audio error');
  assertTest(16, 'Audio error response: Grounded and actionable',
    guarded.cleanedText.includes('unggah kembali'),
    guarded.cleanedText
  );
}

// =========================================================================
// CATEGORY 3: DOCUMENT & KNOWLEDGE PROCESSING (Tests 17 - 24)
// =========================================================================

// Test 17
{
  const raw = `Dokumen telah dibaca 100%. Berikut ringkasan eksekutif dan poin kuncinya.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Analisis jurnal ini');
  assertTest(17, 'Document analysis: Grounded capability execution',
    isCapabilityAvailable('document_analysis') && guarded.cleanedText.includes('ringkasan'),
    guarded.cleanedText
  );
}

// Test 18
{
  const raw = `Hasil riset ilmiah telah dianalisis dan direkam ke Drive F:\\.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Simpan hasil riset');
  assertTest(18, 'Research Lab: Record to Drive F: capability verified',
    isCapabilityAvailable('deep_research_lab'),
    'deep_research_lab not in registry'
  );
}

// Test 19
{
  const raw = `Dokumen SK Pemerintah telah dianalisis dan direkam ke Drive F:\\.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Analisis SK Bupati');
  assertTest(19, 'Non-Research Lab: Record to Drive F: capability verified',
    isCapabilityAvailable('non_research_lab'),
    'non_research_lab not in registry'
  );
}

// Test 20
{
  const raw = `Sistem Neural Document Engine telah membedah 50 halaman.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Analisis PDF tebal');
  assertTest(20, 'Document jargon: Neural Document Engine stripped',
    !guarded.cleanedText.includes('Neural Document Engine'),
    guarded.cleanedText
  );
}

// Test 21
{
  const raw = `Berikut adalah data statistik yang diekstrak dari tabel CSV.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Baca data CSV');
  assertTest(21, 'CSV table parsing: Grounded data output',
    guarded.cleanedText.includes('data'),
    guarded.cleanedText
  );
}

// Test 22
{
  const raw = `Saya dapat membaca dokumen berformat PDF, Word (.docx), TXT, dan spreadsheet CSV.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Dokumen apa yang didukung?');
  assertTest(22, 'Document formats query: Accurate supported formats',
    guarded.cleanedText.includes('PDF') && guarded.cleanedText.includes('docx'),
    guarded.cleanedText
  );
}

// Test 23
{
  const raw = `Saya tidak menemukan data statistik tersebut di dalam dokumen yang diunggah.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Berapa profit tahun 2010 di dokumen?');
  assertTest(23, 'Missing data query: Grounded Unknown-First response',
    guarded.cleanedText.includes('tidak menemukan'),
    guarded.cleanedText
  );
}

// Test 24
{
  const raw = `Poin-poin temuan utama dari berkas adalah sebagai berikut.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Ekstrak poin penting');
  assertTest(24, 'Key points extraction: Direct and clean',
    guarded.cleanedText.includes('Poin-poin'),
    guarded.cleanedText
  );
}

// =========================================================================
// CATEGORY 4: UI GROUNDING & REALITY GUARD (Tests 25 - 32)
// =========================================================================

// Test 25
{
  const raw = `Anda dapat menggunakan SpeechSense Pro (HTML App di Atas) untuk memulai.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Bagaimana caranya?', { activeApp: null, isSandboxRunning: false });
  assertTest(25, 'Phantom UI: SpeechSense Pro (HTML App di Atas) stripped when inactive',
    !guarded.cleanedText.includes('SpeechSense Pro') && !guarded.cleanedText.includes('HTML App di Atas'),
    guarded.cleanedText
  );
}

// Test 26
{
  const raw = `Silakan klik modul di atas untuk melihat hasilnya.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Di mana lihatnya?', { activeApp: null, isSandboxRunning: false });
  assertTest(26, 'Phantom UI: "modul di atas" stripped when no app is active',
    !guarded.cleanedText.includes('modul di atas'),
    guarded.cleanedText
  );
}

// Test 27
{
  const raw = `Silakan gunakan aplikasi di atas untuk menguji coba simulator.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Uji coba aplikasi', { activeApp: null, isSandboxRunning: false });
  assertTest(27, 'Phantom UI: "aplikasi di atas" stripped when sandbox empty',
    !guarded.cleanedText.includes('aplikasi di atas'),
    guarded.cleanedText
  );
}

// Test 28
{
  const raw = `Gunakan opsi upload berkas yang tersedia di antarmuka Anda.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Di mana tombol uploadnya?');
  assertTest(28, 'UI Location Query: General grounded guidance without hallucinated coordinates',
    !guarded.cleanedText.includes('SpeechSense Pro'),
    guarded.cleanedText
  );
}

// Test 29
{
  const raw = `Aplikasi kalkulator penelitian telah selesai dibuat dan siap diuji pada panel simulator di sebelah kanan.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Buat kalkulator riset', { activeApp: { title: 'Kalkulator Riset' }, isSandboxRunning: true });
  assertTest(29, 'Active UI Sandbox: Legitimate sandbox reference preserved when app is running',
    guarded.cleanedText.includes('simulator'),
    guarded.cleanedText
  );
}

// Test 30
{
  const raw = `Anda dapat membuka tab MEDIA di simulator HP untuk memutar audio dan video.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Di mana tab media?');
  assertTest(30, 'Verified UI Tab: Media tab reference valid',
    guarded.cleanedText.includes('MEDIA'),
    guarded.cleanedText
  );
}

// Test 31
{
  const raw = `Menu MEMORY VAULT di sidebar kiri dapat digunakan untuk melihat rekaman memori.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Di mana memory vault?');
  assertTest(31, 'Verified Sidebar Menu: Memory Vault reference valid',
    guarded.cleanedText.includes('MEMORY VAULT'),
    guarded.cleanedText
  );
}

// Test 32
{
  const raw = `Buka menu CONTROL CENTER di sidebar kiri untuk mengatur preferensi sistem.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Buka pengaturan');
  assertTest(32, 'Verified Sidebar Menu: Control Center reference valid',
    guarded.cleanedText.includes('CONTROL CENTER'),
    guarded.cleanedText
  );
}

// =========================================================================
// CATEGORY 5: UNAVAILABLE / UNVERIFIED FEATURES GUARD (Tests 33 - 40)
// =========================================================================

// Test 33
{
  assertTest(33, 'Capability Registry Truth: speaker_diarization is FALSE',
    isCapabilityAvailable('speaker_diarization') === false,
    'speaker_diarization should be false'
  );
}

// Test 34
{
  assertTest(34, 'Capability Registry Truth: url_audio_ingestion is FALSE',
    isCapabilityAvailable('url_audio_ingestion') === false,
    'url_audio_ingestion should be false'
  );
}

// Test 35
{
  assertTest(35, 'Capability Registry Truth: multi_speaker_count_detection is FALSE',
    isCapabilityAvailable('multi_speaker_count_detection') === false,
    'multi_speaker_count_detection should be false'
  );
}

// Test 36
{
  const guarded = responseGroundingGuardInstance.guard('Tentu, saya akan melakukan diarization pembicara.', 'Kamu bisa bedakan pembicara?');
  assertTest(36, 'Diarization Query: Falsely promised diarization replaced with unverified disclaimer',
    guarded.cleanedText.includes('belum dapat memastikan pemisahan pembicara'),
    guarded.cleanedText
  );
}

// Test 37
{
  const guarded = responseGroundingGuardInstance.guard('Tentu, diarization otomatis siap dieksekusi.', 'Bisa speaker diarization?');
  assertTest(37, 'Speaker Diarization Query: English-loan word query caught and disclaimed',
    guarded.cleanedText.includes('belum dapat memastikan pemisahan pembicara'),
    guarded.cleanedText
  );
}

// Test 38
{
  const raw = `Saya akan melakukan transkripsi, diarization pembicara, dan analisis teks.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Proses audio ini');
  assertTest(38, 'Unverified Diarization Claim in output: Automatically stripped',
    !guarded.cleanedText.includes('diarization pembicara'),
    guarded.cleanedText
  );
}

// Test 39
{
  const raw = `Saat ini tautan audio web eksternal belum dapat di-stream secara langsung. Silakan unduh dan unggah berkas audionya.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Bisa ambil audio dari link youtube?');
  assertTest(39, 'URL Audio Ingestion Query: Truthful disclaimer provided',
    guarded.cleanedText.includes('belum') || guarded.cleanedText.includes('unggah berkas'),
    guarded.cleanedText
  );
}

// Test 40
{
  const unavail = getUnavailableCapabilities().map(c => c.key);
  assertTest(40, 'Unavailable Capabilities Registry Check: Correct list returned',
    unavail.includes('speaker_diarization') && unavail.includes('url_audio_ingestion') && unavail.includes('multi_speaker_count_detection'),
    JSON.stringify(unavail)
  );
}

// =========================================================================
// CATEGORY 6: ACTIVE & VERIFIED FEATURES (Tests 41 - 45)
// =========================================================================

// Test 41
{
  assertTest(41, 'Verified Feature Check: audio_transcription is TRUE',
    isCapabilityAvailable('audio_transcription') === true,
    'audio_transcription should be true'
  );
}

// Test 42
{
  assertTest(42, 'Verified Feature Check: live_web_search is TRUE',
    isCapabilityAvailable('live_web_search') === true,
    'live_web_search should be true'
  );
}

// Test 43
{
  assertTest(43, 'Verified Feature Check: image_generation is TRUE',
    isCapabilityAvailable('image_generation') === true,
    'image_generation should be true'
  );
}

// Test 44
{
  assertTest(44, 'Verified Feature Check: html_app_generation is TRUE',
    isCapabilityAvailable('html_app_generation') === true,
    'html_app_generation should be true'
  );
}

// Test 45
{
  assertTest(45, 'Verified Feature Check: deep_research_lab is TRUE',
    isCapabilityAvailable('deep_research_lab') === true,
    'deep_research_lab should be true'
  );
}

// =========================================================================
// CATEGORY 7: ANTI-HALLUCINATION ON FABRICATED SYSTEM NAMES (Tests 46 - 50)
// =========================================================================

// Test 46
{
  const raw = `Sistem JIN Audio Ingestion Pipeline sedang mengolah data Anda.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Status audio');
  assertTest(46, 'System Name Check: "JIN Audio Ingestion Pipeline" eliminated',
    !guarded.cleanedText.includes('Audio Ingestion Pipeline'),
    guarded.cleanedText
  );
}

// Test 47
{
  const raw = `Cognitive Processing Matrix telah selesai menghitung korelasi.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Hitung korelasi');
  assertTest(47, 'System Name Check: "Cognitive Processing Matrix" eliminated',
    !guarded.cleanedText.includes('Cognitive Processing Matrix'),
    guarded.cleanedText
  );
}

// Test 48
{
  const raw = `Ultimate Analysis Core mendeteksi 3 outlier data statistik.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Cek outlier');
  assertTest(48, 'System Name Check: "Ultimate Analysis Core" eliminated',
    !guarded.cleanedText.includes('Ultimate Analysis Core'),
    guarded.cleanedText
  );
}

// Test 49
{
  const raw = `JIN Ingestion Matrix mengonfirmasi berkas siap diekstrak.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Cek berkas');
  assertTest(49, 'System Name Check: "JIN Ingestion Matrix" eliminated',
    !guarded.cleanedText.includes('JIN Ingestion Matrix'),
    guarded.cleanedText
  );
}

// Test 50
{
  const raw = `Modul SpeechSense Pro (HTML App di Atas) aktif bersama Audio Ingestion Pipeline.`;
  const guarded = responseGroundingGuardInstance.guard(raw, 'Mulai audio', { activeApp: null, isSandboxRunning: false });
  assertTest(50, 'Compound Hallucination Check: All fabricated names & fake UI stripped simultaneously',
    !guarded.cleanedText.includes('SpeechSense Pro') &&
    !guarded.cleanedText.includes('HTML App di Atas') &&
    !guarded.cleanedText.includes('Audio Ingestion Pipeline'),
    guarded.cleanedText
  );
}

// =========================================================================
// SUMMARY REPORT
// =========================================================================
console.log('\n========================================================================');
console.log(`ðŸ“Š TEST SUITE SUMMARY: ${passCount}/50 PASSED (${((passCount/50)*100).toFixed(0)}%) | ${failCount} FAILED`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
