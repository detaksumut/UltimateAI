/**
 * ConversationController.js
 * New clean conversation controller for JIN Ticker Response.
 * Manages conversation lifecycle, state machine, and streaming deltas.
 * ZERO fake typing, ZERO dummy fallbacks, ZERO synthetic delays.
 */

import { localRouterClient } from '../router/LocalRouterClient.js';
import { memoryAdapterInstance } from './MemoryAdapter.js';
import { voiceControllerInstance } from '../voice/VoiceController.js';
import { displaySpeechSeparationEngineInstance } from '../voice/DisplaySpeechSeparationEngine.js';
import { jinAvatarControllerInstance } from '../avatar/JinAvatarController.js';
import { AVATAR_EVENTS } from '../avatar/JinAvatarStates.js';
export class ConversationController {
  constructor() {
    this.messages = [];
    this.status = 'idle'; // 'idle' | 'sending' | 'streaming' | 'completed' | 'error'
    this.listeners = new Set();
    this.activeStreamingId = null;
    this.requestSequence = 0;
    this.activeGeneration = null;
    this.currentError = null;

    this.systemPrompt = `You are JIN, an autonomous, highly capable, deeply thoughtful, and articulate AI partner in UltimateAI.
You are fully bilingual in English and Indonesian.
LANGUAGE ADAPTATION RULE:
- If the user asks you to speak in English (e.g. "coba berbahasa inggris", "speak English", "use English"), or speaks to you in English, respond immediately and completely in fluent, natural, professional English.
- If the user speaks in Indonesian, respond naturally in Indonesian.

PRINSIP KOGNISI & ANALISIS DOKUMEN:
1. DOKUMEN & NASKAH TERLAMPIR:
   - Ketika dokumen (PDF, DOCX, TXT, CSV, regulasi, berkas kerja) dilampirkan atau disajikan dalam percakapan, Anda WAJIB membaca seluruh teks secara menyeluruh dan memahaminya secara mendalam.
   - Jawab pertanyaan pengguna berdasarkan isi dokumen tersebut dengan cerdas, objektif, dan terstruktur.
   - Sediakan rangkuman eksekutif, analisis substansi, pembedahan pasal/klausa, evaluasi kelebihan & kelemahan, serta kesimpulan strategis yang tajam.
   - JANGAN PERNAH menolak dengan alasan "tidak bisa membaca dokumen", "tidak memiliki akses", atau menanyakan kembali konteks yang sudah jelas ada di dalam dokumen.
2. PEMIKIRAN STRATEGIS & KEMITRAAN PROFESIONAL:
   - Bertindaklah sebagai mitra berpikir tingkat tinggi (strategic advisor).
   - Jawaban harus terstruktur rapi, menggunakan format markdown yang bersih, poin-poin analitis, dan argumentasi berbobot.
   - Hindari klise, basa-basi kosong, atau menu fitur yang tidak diminta.
3. KONTINUITAS KONTEKS:
   - Jaga kesinambungan percakapan dari putaran sebelumnya tanpa melompat topik secara tiba-tiba.
4. PROTOKOL PENYUSUNAN MATERI & DRAFT PRESENTASI (SKILL PRESENTASI TINGKAT TINGGI):
   - Ketika pengguna meminta draft presentasi, poin-poin presentasi, materi slide, atau outline dari dokumen/topik:
     a. BAGI MENJADI STRUKTUR SLIDE JELAS: Susun secara presisi ke dalam jumlah slide yang diminta (misal: Slide 1 s/d Slide 5).
     b. FORMAT SETIAP SLIDE WAJIB MEMILIKI:
        * **SLIDE [Nomor]: [Judul Slide Ringkas & Tajam]**
        * **Headline / Key Takeaway:** 1 kalimat pesan inti yang berbobot.
        * **Poin Kunci (3-4 butir):** Sajikan fakta empiris, data kuantitatif, rumus, persentase, atau argumen substansi naskah.
        * **Rekomendasi Visual:** Rekomendasi tata letak visual/infografis (misal: Kartu Perbandingan, Diagram Alur, Tabel Metrik, Badge Keamanan).
   - JANGAN PERNAH menghasilkan poin yang dangkal, malas, atau hanya mengulang judul.
   - JANGAN LANGSUNG memicu pembuatan visual/gambar secara serampangan sebelum draft poin teks ini disajikan secara lengkap kepada pengguna.`;

    // Load initial history from localStorage if available
    this._loadInitialHistory();
  }

  _loadInitialHistory() {
    try {
      const stored = localStorage.getItem('jin_ticker_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.messages = parsed.map(m => ({ ...m, isStreaming: false }));
        }
      }
    } catch {
      this.messages = [];
    }
  }

  _sanitizeMessageForStorage(m, isDeepClean = false) {
    let safeImageUrl = null;
    if (m.imageUrl && typeof m.imageUrl === 'string') {
      // Exclude large base64 dataUrls completely from localStorage
      if (!m.imageUrl.startsWith('data:') || m.imageUrl.length < 2048) {
        safeImageUrl = isDeepClean ? null : m.imageUrl;
      }
    }

    return {
      id: m.id,
      role: m.role,
      content: typeof m.content === 'string' && isDeepClean ? m.content.slice(0, 4000) : m.content,
      timestamp: m.timestamp,
      error: Boolean(m.error),
      imageUrl: safeImageUrl,
      artifactType: m.artifactType || null,
      presentation: isDeepClean ? null : (m.presentation || null),
      visualIntent: isDeepClean ? null : (m.visualIntent || null),
      musicPlayer: isDeepClean ? null : (m.musicPlayer || null),
      // docContexts wajib persist agar re-inject lintas giliran selamat
      // dari reload (dipotong saat deep-clean agar localStorage tak jebol).
      docContexts: typeof m.docContexts === 'string'
        ? (isDeepClean ? m.docContexts.slice(0, 4000) : m.docContexts.slice(0, 60000))
        : undefined,
      files: Array.isArray(m.files)
        ? m.files.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            isImage: f.isImage,
            isPdf: f.isPdf,
            // content teks (bukan dataUrl biner) aman & wajib disimpan
            // agar konteks dokumen tidak hilang saat reload.
            content: typeof f.content === 'string' ? f.content.slice(0, 60000) : '',
            dataUrl: null // Never store raw dataUrl into localStorage
          }))
        : undefined
    };
  }

  _saveHistory() {
    // Progressive save with graceful eviction on QuotaExceededError
    const sliceCounts = [20, 10, 5, 2];

    for (let attempt = 0; attempt < sliceCounts.length; attempt++) {
      const count = sliceCounts[attempt];
      const isDeepClean = attempt > 0;
      try {
        const safeSlice = this.messages.slice(-count).map(m => this._sanitizeMessageForStorage(m, isDeepClean));
        localStorage.setItem('jin_ticker_history', JSON.stringify(safeSlice));
        return;
      } catch (err) {
        console.warn(`[ConversationController] LocalStorage write failed at slice=${count} (deep=${isDeepClean}):`, err.name);
        try { localStorage.removeItem('jin_ticker_history'); } catch (_) {}
      }
    }
  }

  getMessages() {
    return this.messages;
  }

  getStatus() {
    return this.status;
  }

  getActiveStreamingId() {
    return this.activeStreamingId;
  }

  getCurrentError() {
    return this.currentError;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener({
          messages: this.messages,
          status: this.status,
          activeStreamingId: this.activeStreamingId,
          currentError: this.currentError
        });
      } catch (err) {
        console.error('[ConversationController] Listener notification error:', err);
      }
    }
  }

  getSnapshot() {
    return {
      messages: [...this.messages],
      status: this.status,
      activeStreamingId: this.activeStreamingId,
      error: this.currentError
    };
  }

  clearHistory() {
    // Abort active stream if any
    if (this.activeGeneration?.controller) {
      this.activeGeneration.controller.abort();
    }
    this.messages = [];
    this.status = 'idle';
    this.activeStreamingId = null;
    this.currentError = null;
    try {
      localStorage.removeItem('jin_ticker_history');
    } catch (_) {}
    this._notify();
  }

  stopGeneration() {
    if (this.activeGeneration?.controller) {
      this.activeGeneration.controller.abort();
    }
    this.status = 'idle';
    this.activeStreamingId = null;
    this._notify();
  }

  async sendMessage(text, mediaOrFiles = null, optionalFiles = []) {
    let media = null;
    let attachedFiles = [];
    if (Array.isArray(mediaOrFiles)) {
      attachedFiles = mediaOrFiles;
    } else if (mediaOrFiles && typeof mediaOrFiles === 'object') {
      media = mediaOrFiles;
      attachedFiles = Array.isArray(optionalFiles) ? optionalFiles : [];
    }

    if ((!text || !text.trim()) && !media && (!attachedFiles || attachedFiles.length === 0)) return;

    // Instant Human Barge-in: Mute active speech if user speaks or sends new message
    try {
      voiceControllerInstance.handleUserBargeIn();
    } catch (_) {}

    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `jin_${Date.now() + 1}`;
    const generationId = `gen_${Date.now()}_${++this.requestSequence}`;
    if (this.activeGeneration?.controller && !this.activeGeneration.committed) {
      this.activeGeneration.controller.abort();
    }
    const generationController = new AbortController();
    this.activeGeneration = {
      generationId,
      assistantMessageId,
      controller: generationController,
      committed: false
    };

    const mediaFiles = attachedFiles.filter(f => f.dataUrl) || [];

    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: text || '',
      timestamp: Date.now(),
      imageUrl: media?.dataUrl || null,
      files: Array.isArray(attachedFiles) && attachedFiles.length > 0
        ? attachedFiles.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            isImage: Boolean(f.isImage),
            isPdf: Boolean(f.isPdf),
            content: typeof f.content === 'string' ? f.content : '',
            dataUrl: f.dataUrl || null
          }))
        : undefined
    };

    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      isStreaming: true,
      generationId
    };

    // Append to in-memory state
    this.messages.push(userMsg, assistantMessage);
    this.status = 'sending';
    this.activeStreamingId = assistantMessageId;
    this.currentError = null;

    // Trigger Avatar Analytical/Processing Reaction (Purple Hologram Hue & Accelerated Orbit)
    try {
      jinAvatarControllerInstance.dispatch({ type: AVATAR_EVENTS.REQUEST_STARTED });
    } catch (avatarErr) {
      console.warn('[ConversationController] Failed to dispatch avatar REQUEST_STARTED:', avatarErr);
    }

    this._notify();

    // Prepare context payload for router
    let currentUserContent = text || '';
    const pastHistory = this.messages
      .slice(0, -2) // exclude current turn
      .slice(-10)   // last 5 pairs
      .map(m => {
        // Collect any images or PDF documents from past messages
        const pastImages = (m.files || []).filter(f => (f.isImage || f.isPdf) && f.dataUrl);
        if (m.imageUrl || pastImages.length > 0) {
          const parts = [
            { type: 'text', text: m.content || 'Gambar/Dokumen terlampir' }
          ];
          if (m.imageUrl) {
            parts.push({ type: 'image_url', image_url: { url: m.imageUrl } });
          }
          for (const img of pastImages) {
            parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
          }
          return {
            role: m.role,
            content: parts,
            imageUrl: m.imageUrl || null
          };
        }
        return {
          role: m.role,
          content: m.content || ''
        };
      });

    // ── MULTI-FILE & MULTIMODAL INGESTION PIPELINE ──
    // Process all attached files (Images, PDFs, Word docs, Text, Code)
    const mediaParts = [];
    let docContexts = '';

    // A. Handle legacy single media object if provided
    if (media && media.dataUrl) {
      mediaParts.push({
        type: 'image_url',
        image_url: { url: media.dataUrl }
      });
    }

    // B. Handle multi-file attachments from UI
    if (Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      for (const f of attachedFiles) {
        if (!f) continue;
        
        // B1. Multimodal Vision Assets: ONLY REAL IMAGES (NOT PDFs!)
        const isRealImage = f.isImage || (typeof f.dataUrl === 'string' && f.dataUrl.startsWith('data:image/'));
        if (isRealImage && f.dataUrl) {
          mediaParts.push({
            type: 'image_url',
            image_url: { url: f.dataUrl }
          });
        }

        // B2. Textual Documents & Extracted PDF/Docx/Doc/Code
        if (f.content && typeof f.content === 'string' && f.content.trim()) {
          docContexts += `\n\n--- [BERKAS DOKUMEN TERLAMPIR: ${f.name || 'Dokumen'}] ---\n${f.content.trim()}\n--- [AKHIR DOKUMEN: ${f.name || 'Dokumen'}] ---`;
        } else if (!isRealImage && f.dataUrl && typeof f.dataUrl === 'string' && f.dataUrl.startsWith('data:')) {
          // Parse gagal/sunyi: jangan kirim marker kosong ("belum terlampir").
          // Ekstrak ulang otomatis di sini via backend; bila backend diam,
          // teruskan status FAILED yang jujur agar JINI tidak buta.
          try {
            const { RouterConfig } = await import('../router/RouterConfig.js');
            const parseRes = await fetch(RouterConfig.api('/api/files/parse'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: f.name || 'Dokumen', dataUrl: f.dataUrl }),
              signal: AbortSignal.timeout(30000)
            }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
            const reText = (parseRes?.text || parseRes?.content || '').trim();
            if (reText) {
              docContexts += `\n\n--- [BERKAS DOKUMEN TERLAMPIR: ${f.name || 'Dokumen'}] ---\n${reText}\n--- [AKHIR DOKUMEN: ${f.name || 'Dokumen'}] ---\n(diekstrak ulang otomatis dari lampiran giliran sebelumnya)`;
            } else {
              docContexts += `\n\n--- [STATUS DOKUMEN: ${f.name || 'Dokumen'}] ---\nendpoint /api/files/parse tidak merespons — dokumen belum terbaca (FAILED). Minta pengguna memastikan LocalRouter :20200 aktif lalu kirim ulang.\n--- [AKHIR STATUS] ---`;
            }
          } catch (_) {
            docContexts += `\n\n--- [STATUS DOKUMEN: ${f.name || 'Dokumen'}] ---\nendpoint /api/files/parse tidak merespons — dokumen belum terbaca (FAILED). Minta pengguna memastikan LocalRouter :20200 aktif lalu kirim ulang.\n--- [AKHIR STATUS] ---`;
          }
        } else if (!isRealImage && f.name) {
          docContexts += `\n\n--- [BERKAS DOKUMEN TERLAMPIR: ${f.name}] ---\n(Dokumen ${f.name} terlampir oleh pengguna. Analisis berdasarkan judul dan konteks dokumen ini)\n--- [AKHIR DOKUMEN: ${f.name}] ---`;
        }
      }
    }

    // Merge textual user prompt with extracted document texts
    let mergedTextPrompt = (text || '').trim();
    if (docContexts) {
      mergedTextPrompt = mergedTextPrompt 
        ? `${mergedTextPrompt}${docContexts}` 
        : `Tolong baca, pahami, dan jelaskan isi dokumen yang saya lampirkan berikut:${docContexts}`;
    }

    // ── KONTINUITAS LINTAS GILIRAN (anti "baca tapi buta") ──
    // Pola nyata: giliran-1 upload PDF, giliran-2 "buat analisa kamu" tanpa
    // lampiran. Tanpa ini backend hanya menerima "buat analisa kamu" dan
    // menjawab "belum terlampir". Re-inject konteks dokumen terakhir.
    // currentTurnDocContexts = lampiran eksplisit giliran BERJALAN saja —
    // konteks riwayat TIDAK boleh dihitung agar guard harvest tetap benar.
    const currentTurnDocContexts = docContexts || '';
    if (!currentTurnDocContexts) {
      for (let i = this.messages.length - 1; i >= 0; i--) {
        const prev = this.messages[i];
        if (prev && typeof prev.docContexts === 'string' && prev.docContexts.trim()) {
          const followupRe = /(buat|buatkan|bikin)\s+(analisa|analisis|kesimpulan|rangkuman|ringkasan)|analisa\s+kamu|analisis\s+ini|rangkum|ringkas|jelaskan|simpulkan|kesimpul\w*/i;
          if (followupRe.test(text || '')) {
            docContexts = `\n\n--- [Konteks Dokumen (diekstrak ulang otomatis dari lampiran giliran sebelumnya)] ---${prev.docContexts}\n--- [Akhir Konteks Dokumen] ---`;
            mergedTextPrompt = `${(text || '').trim()}${docContexts}`;
          }
          break;
        }
      }
    }
    // Simpan konteks dokumen (asli giliran ini) ke riwayat untuk giliran berikut.
    userMsg.docContexts = (currentTurnDocContexts || docContexts) || undefined;

    // Assemble currentUserContent: Multimodal Parts Array if media is present, or clean string
    if (mediaParts.length > 0) {
      currentUserContent = [
        { 
          type: 'text', 
          text: mergedTextPrompt || 'Tolong baca dan analisis gambar atau dokumen yang saya lampirkan ini secara mendalam.' 
        },
        ...mediaParts
      ];
    } else {
      currentUserContent = mergedTextPrompt;
    }

    // --- AUTONOMOUS PHYSICAL FOLDER & TAVILY HARVEST INTENT ---
    const isFolderHarvestIntent = (() => {
      if (!text || typeof text !== 'string') return false;
      if (currentTurnDocContexts) return false; // Never hijack if user attached an explicit file!
      const p = text.toLowerCase();
      
      // Exclude document inquiries/analysis/presentation
      const isDocumentInquiry = /\b(berdasarkan\s+dokumen|jelaskan|apa\s+isi|rangkum|ringkas|baca\s+dokumen|presentasi|slide)\b/i.test(p);
      if (isDocumentInquiry) return false;

      // 1. Explicit folder creation / population
      if (/\b(buat|buatkan|bikin|create)\s+(?:sebuah\s+)?(folder|direktori)\b/i.test(p)) return true;
      if (/\b(isi\s+folder|isikan\s+folder|masukkan\s+ke\s+folder)\b/i.test(p)) return true;

      // 2. Physical drive destination (Drive F: or F:\...) with storage/action verbs
      if (/[a-zA-Z]:[\\\/]/.test(text) && /\b(simpan|unduh|download|taruh|masukkan|isikan|panen|harvest|save)\b/i.test(p)) return true;
      if (/\b(drive\s+[a-zA-Z])\b/i.test(p) && /\b(simpan|unduh|download|taruh|masukkan|isikan|save)\b/i.test(p)) return true;

      // 3. Action + destination keywords ("carikan ... simpan ke ...", "download ... ke ...", "simpan di ...")
      if (/\b(simpan|taruh|unduh|download)\s+(?:ke|di)\s+[a-zA-Z0-9_\-\\\/]+/i.test(p)) return true;

      return false;
    })();

    let executedHarvestResult = null;

    if (isFolderHarvestIntent) {
      console.log(`[ConversationController] Autonomous Folder & Harvest Intent triggered: "${text}"`);
      
      // Extract target folder name intelligently
      let targetFolderName = 'data';
      const driveMatch = text.match(/(?:[a-zA-Z]:[\\\/]|drive\s+[a-zA-Z]:?[\\\/]?)([a-zA-Z0-9_\-]+)/i);
      const folderMatch = text.match(/(?:folder|direktori)\s+([a-zA-Z0-9_:\\\/\-]+)/i);
      const toPathMatch = text.match(/(?:ke|di)\s+(?:drive\s+)?([a-zA-Z]:[\\\/]?[a-zA-Z0-9_\-]*)/i);

      if (driveMatch && driveMatch[1]) {
        targetFolderName = driveMatch[1].replace(/^[a-zA-Z]:[\\\/]+/i, '').trim();
      } else if (folderMatch && folderMatch[1]) {
        targetFolderName = folderMatch[1].replace(/^[a-zA-Z]:[\\\/]+/i, '').trim();
      } else if (toPathMatch && toPathMatch[1]) {
        targetFolderName = toPathMatch[1].replace(/^[a-zA-Z]:[\\\/]+/i, '').trim() || 'data';
      } else if (/\buu\b/i.test(text)) {
        targetFolderName = 'UU_RI_Terbaru';
      } else if (/\bkuhp\b/i.test(text)) {
        targetFolderName = 'KUHP_RI_Terbaru';
      } else if (/\bperaturan\b/i.test(text)) {
        targetFolderName = 'Peraturan_Pemerintah_Terbaru';
      } else if (/\b(musik|lagu|mp3|lofi|pop|barat|dangdut|audio)\b/i.test(text)) {
        targetFolderName = 'musik';
      }

      const isAudio = /\b(musik|lagu|audio|mp3|soundtrack|lofi|synthwave|pop|barat|dangdut|jazz|rock|tembang|album|singel|single|playlist)\b/i.test(text);

      // Clean topic extract for Tavily deep harvest
      let cleanTopic = text;
      cleanTopic = cleanTopic.replace(/^jin\s*[\,\:\-]?\s*/i, '');
      cleanTopic = cleanTopic.replace(/\b(tolong|coba|bisakah|anda|kamu)\s+/gi, '');
      cleanTopic = cleanTopic.replace(/\b(carikan|cari|unduh|download|ambilkan)\s+/gi, '');
      cleanTopic = cleanTopic.replace(/\b(di\s+internet|dari\s+internet)\b/gi, '');
      cleanTopic = cleanTopic.replace(/\b(kamu\s+)?(simpan|taruh|masukkan|unduh)\s+(ke|di)\s+(drive\s+)?[a-zA-Z0-9_:\\\/\-]+/gi, '');
      cleanTopic = cleanTopic.replace(/\b(buat|buatkan|bikin)\s+(folder|direktori)\s+[a-zA-Z0-9_:\\\/\-]+/gi, '');
      cleanTopic = cleanTopic.replace(/\b(dan\s+isikan|dan\s+isi|isikan|isi)\b/gi, '');
      cleanTopic = cleanTopic.replace(/[\?\,\!]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleanTopic || cleanTopic.length < 3) cleanTopic = text;

      try {
        const actionRes = await fetch('/api/fs/autonomous-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderName: targetFolderName,
            topic: cleanTopic,
            resourceType: isAudio ? 'audio' : 'document'
          })
        }).then(r => r.json()).catch(() => null);

        if (actionRes?.success) {
          executedHarvestResult = actionRes;
          console.log('[ConversationController] Autonomous action executed successfully:', actionRes);

          // Broadcast to Tavily Grounding & Drive F: monitor panels
          if (typeof window !== 'undefined' && actionRes.harvest) {
            const h = actionRes.harvest;
            window.dispatchEvent(new CustomEvent('tavily-grounding-update', {
              detail: {
                topic: cleanTopic,
                sources: [{ title: h.fileName, domain: 'Autonomous Harvester', score: 0.99 }],
                lastSavedFile: {
                  fileName: h.fileName,
                  filePath: h.filePath,
                  sizeKb: h.fileSize,
                  indexStatus: 'DISK_COMMITTED',
                  timestamp: new Date().toISOString()
                }
              }
            }));
          }

          // If harvested resource is audio, attach interactive player loaded from Drive F:
          if (isAudio && actionRes.harvest?.filePath) {
            assistantMessage.musicPlayer = {
              active: true,
              autoPlay: true,
              customUrl: actionRes.harvest.audioStreamUrl || `/api/media/stream?file=${encodeURIComponent(actionRes.harvest.filePath)}`,
              initialTrackIndex: 0,
              trackTitle: actionRes.harvest.fileName,
              artist: 'Drive F:\\ Musik'
            };
          }

          // Objective execution notice without scripted directives
          const executionNotice = `\n\n[Sistem: Folder ${actionRes.folder} disiapkan. Berkas: ${actionRes.harvest?.fileName || 'berkas'} (${actionRes.harvest?.fileSize || 'OK'}) tersimpan di ${actionRes.harvest?.filePath || actionRes.folder}]`;

          if (typeof currentUserContent === 'string') {
            currentUserContent += executionNotice;
          } else if (Array.isArray(currentUserContent)) {
            currentUserContent.push({ type: 'text', text: executionNotice });
          }
        }
      } catch (err) {
        console.warn('[ConversationController] Autonomous action failed:', err);
      }
    }

    // --- AUTONOMOUS LOCAL DOCUMENT READING / RAG INQUIRY ---
    const isDocInquiry = (() => {
      if (!text || typeof text !== 'string') return false;
      // If user uploaded attached files, NEVER hijack with Drive F:
      if (Array.isArray(attachedFiles) && attachedFiles.length > 0) return false;
      const p = text.toLowerCase();
      const mentionsFolderOrDrive = /(?:[a-zA-Z]:[\\\/]|folder\s+[a-zA-Z0-9_\-]+|drive\s+[a-zA-Z])/i.test(p);
      return mentionsFolderOrDrive && /\b(jelaskan|rangkum|analisis|bedah|ulas|baca|isi)\b/i.test(p) && !isFolderHarvestIntent;
    })();

    if (isDocInquiry) {
      const folderMatch = text.match(/(?:[a-zA-Z]:[\\\/]|folder\s+|drive\s+[a-zA-Z]:?[\\\/]?)([a-zA-Z0-9_\-]+)/i);
      let docFolder = folderMatch && folderMatch[1] ? folderMatch[1].replace(/^[a-zA-Z]:[\\\/]+/i, '').trim() : null;
      if (!docFolder) {
        if (/\buu\b/i.test(text)) docFolder = 'UU_RI_Terbaru';
        else if (/\bkuhp\b/i.test(text)) docFolder = 'KUHP_RI_Terbaru';
      }

      if (docFolder) {
      try {
        console.log(`[ConversationController] Reading physical docs from Drive F:\\${docFolder}...`);
        const docRes = await fetch(`/api/fs/read-folder-docs?folder=${encodeURIComponent(docFolder)}`)
          .then(r => r.json())
          .catch(() => null);

        if (docRes?.success && docRes.content) {
          const docContext = `\n\n--- [Konteks Dokumen: Drive F:\\${docFolder}] ---\n` +
            `${docRes.content}\n` +
            `--- [Akhir Dokumen] ---`;

          if (typeof currentUserContent === 'string') {
            currentUserContent += docContext;
          } else if (Array.isArray(currentUserContent)) {
            currentUserContent.push({ type: 'text', text: docContext });
          }
        }
      } catch (docErr) {
        console.warn('[ConversationController] Failed to read local folder docs:', docErr);
      }
      }
    }

    // Web search and intelligence grounding are handled strictly and centrally by LocalRouter backend (:20200).
    // Zero client-side duplicate calls, zero API key exposure, single clean pipeline.

    const payloadMessages = [
      { role: 'system', content: this.systemPrompt },
      ...pastHistory,
      { role: 'user', content: currentUserContent }
    ];

    // Execution handlers for streaming response
    const handleDelta = (delta, fullText) => {
      if (this.status !== 'streaming') {
        this.status = 'streaming';
      }
      assistantMessage.content = fullText;
      this._notify();
    };

    const handleComplete = (fullText, agentMetadata) => {
      if (this.activeGeneration?.generationId !== generationId) return;
      if (agentMetadata?.generationId && agentMetadata.generationId !== generationId) return;
      if (this.activeGeneration) this.activeGeneration.committed = true;
      // Resolve agent-delivered image artifact URL so the generated image
      // renders directly in the conversation canvas (no separate "studio").
      if (agentMetadata?.imageUrl) {
        const rawUrl = String(agentMetadata.imageUrl).trim();
        const base = String(localRouterClient.endpoint || 'http://127.0.0.1:20200').replace(/\/+$/, '');
        // Preserve absolute http(s) AND base64 data URLs; only relativize other paths.
        assistantMessage.imageUrl = (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('data:'))
          ? rawUrl
          : `${base}${rawUrl}`;
      }
      assistantMessage.slideTitle = agentMetadata?.slideTitle || (agentMetadata?.slideData?.header?.title ? `SLIDE MASTER: ${agentMetadata.slideData.header.title.toUpperCase()}` : null);
      if (agentMetadata?.pptxUrl) {
        const rawPptx = String(agentMetadata.pptxUrl).trim();
        const base = String(localRouterClient.endpoint || 'http://127.0.0.1:20200').replace(/\/+$/, '');
        assistantMessage.pptxUrl = /^https?:\/\//i.test(rawPptx) ? rawPptx : `${base}${rawPptx}`;
      }
      assistantMessage.artifactType = agentMetadata?.artifactType || (assistantMessage.imageUrl ? 'IMAGE' : null);
      assistantMessage.project = agentMetadata?.project || null;
      assistantMessage.studio = agentMetadata?.studio || null;
      assistantMessage.slides = agentMetadata?.slides || null;
      assistantMessage.presentation = agentMetadata?.presentation || null;
      assistantMessage.visualIntent = agentMetadata?.visualIntent || null;
      assistantMessage.generationId = agentMetadata?.generationId || generationId;
      assistantMessage.messageId = agentMetadata?.messageId || userMessageId;

      this.status = 'completed';
      assistantMessage.content = fullText;
      assistantMessage.isStreaming = false;
      this.activeStreamingId = null;
      console.log('[STREAM_DEBUG] final_message_committed');
      this._saveHistory();

      // Persist to Memory backend safely
      try {
        if (memoryAdapterInstance?.addFact) {
          memoryAdapterInstance.addFact({
            category: 'CONVERSATION',
            key: text.slice(0, 40),
            value: fullText.slice(0, 100),
            source: 'ticker_stream'
          });
        }
      } catch (memErr) {
        console.warn('[ConversationController] Memory save warning:', memErr.message);
      }

      // Display-Speech Separation & TTS Voice Synthesis (Speaker Toggle aware)
      // MEDIA PLAYBACK responses (YouTube/iframe autoplays its own audio) must
      // NEVER be TTS-spoken — otherwise two players (TTS + video) speak at once.
      let speechTriggered = false;
      const isMediaPlayback =
        (agentMetadata && (agentMetadata.intent === 'MEDIA_PLAYBACK' || agentMetadata.videoId)) ||
        (agentMetadata && Array.isArray(agentMetadata.toolsUsed) && agentMetadata.toolsUsed.includes('youtube.search'));
      try {
        if (voiceControllerInstance.isSpeakerEnabled() && !isMediaPlayback) {
          const separationResult = displaySpeechSeparationEngineInstance.separate(fullText, text);
          const speechContent = separationResult?.speechContent || '';
          if (speechContent) {
            speechTriggered = true;
            voiceControllerInstance.speak(speechContent, { userPrompt: text });
          }
        }
      } catch (voiceErr) {
        console.warn('[ConversationController] Voice synthesis warning:', voiceErr.message);
      }

      // If speaker is OFF or no speech was dispatched, gracefully return avatar to IDLE
      if (!speechTriggered) {
        try {
          jinAvatarControllerInstance.dispatch({ type: AVATAR_EVENTS.RESPONSE_TEXT_ONLY });
        } catch (_) {
          try {
            jinAvatarControllerInstance.dispatch({ type: AVATAR_EVENTS.RESET });
          } catch {}
        }
      }

      this._notify();

      setTimeout(() => {
        if (this.status === 'completed') {
          this.status = 'idle';
          this._notify();
        }
      }, 1200);
    };

    const handleError = (err) => {
      if (this.activeGeneration?.generationId !== generationId) return;
      if (generationController.signal.aborted) return;
      this.status = 'error';
      this.currentError = err.message;
      assistantMessage.isStreaming = false;
      assistantMessage.error = true;
      if (!assistantMessage.content) {
        assistantMessage.content = `[SYSTEM ERROR] ${err.message}`;
      } else {
        assistantMessage.content += `\n\n[SYSTEM ERROR: Stream interrupted - ${err.message}]`;
      }
      this.activeStreamingId = null;
      this._saveHistory();

      try {
        jinAvatarControllerInstance.dispatch({ type: AVATAR_EVENTS.FAILURE });
      } catch (_) {}

      this._notify();

      setTimeout(() => {
        if (this.status === 'error') {
          this.status = 'idle';
          try {
            jinAvatarControllerInstance.dispatch({ type: AVATAR_EVENTS.RESET });
          } catch (_) {}
          this._notify();
        }
      }, 4000);
    };
    // Unified Execution Pipeline: All multimodal, document, and chat requests
    // stream cleanly and authoritatively through LocalRouter backend (:20200).

    try {
      await localRouterClient.streamChat(
        {
          messages: payloadMessages,
          model: 'auto',
          temperature: 0.7,
          signal: generationController.signal,
          generationId,
          messageId: userMessageId
        },
        {
          onDelta: (delta, fullText) => {
            if (this.activeGeneration?.generationId === generationId) handleDelta(delta, fullText);
          },
          onComplete: (fullText, metadata) => {
            if (this.activeGeneration?.generationId !== generationId) return;
            this.activeGeneration.committed = true;
            if (metadata?.generationId && metadata.generationId !== generationId) return;
            // Mark pipeline as completed before handing off
            assistantMessage.docPipelineStage = 'completed';
            this._notify();
            handleComplete(fullText, metadata);
          },
          onError: async (err) => {
            if (this.activeGeneration?.generationId !== generationId) return;
            if (generationController.signal.aborted) return;
            console.warn('[ConversationController] LocalRouter error:', err.message);
            // tryGeminiDirect() belum diimplementasi — langsung surface error
            // agar user tahu backend tidak tersedia, bukan crash diam-diam.
            handleError(err);
          },
          // ── CANVAS STATUS BRIDGE ──
          // Backend events are the source of truth. No timer, no fake progress.
          onDocStage: (stageKey) => {
            if (this.activeGeneration?.generationId !== generationId) return;
            assistantMessage.docPipelineStage = stageKey;
            console.log(`[CANVAS_STATUS_BRIDGE] assistantMessage.docPipelineStage="${stageKey}"`);
            this._notify();
          }
        }
      );

      return assistantMessage.content;
    } catch (err) {
      // Handled via callbacks
      return assistantMessage.content;
    }
  }
}

export const conversationControllerInstance = new ConversationController();
export default conversationControllerInstance;
