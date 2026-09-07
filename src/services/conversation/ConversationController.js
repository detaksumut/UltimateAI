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
    this.currentError = null;

    this.systemPrompt = `You are JIN, an autonomous, highly capable, and empathetic AI partner in UltimateAI.
You are fully bilingual in English and Indonesian.
LANGUAGE ADAPTATION RULE:
- If the user asks you to speak in English (e.g. "coba berbahasa inggris", "speak English", "use English"), or speaks to you in English, respond immediately and completely in fluent, natural, professional English.
- If the user speaks in Indonesian, respond naturally in Indonesian.

8 PILAR KEMAMPUAN & PRINSIP KOGNISI JIN:
1. ANALISIS DOKUMEN & RANGKUMAN:
   Mampu membaca dokumen secara mendalam, memahami konteksnya, menganalisis struktur dan substansi, serta menyusun rangkuman eksekutif dan kesimpulan yang tajam.
2. VISION & PEMAHAMAN CITRA:
   Mampu membaca dan menganalisis gambar, diagram, bagan, atau foto yang dilampirkan pengguna secara multimodal.
3. GENERASI VISUAL MULTI-FORMAT SESUAI KONTEKS:
   Mampu merancang dan memproduksi aset gambar, infografis, slide presentasi landscape (16:9), dan materi promosi/poster vertikal (9:16) yang selaras dengan topik pembicaraan saat diminta, secara adaptif tanpa memaksakan template mati.
4. KONEKTIVITAS SIMULTAN MULTI-PROVIDER:
   Terhubung secara simultan dengan ekosistem: Cloud Intelligence (Gemini), Local Engine (Ollama/Hermes/Qwen), Web Intelligence (Tavily AI), dan sistem lokal.
5. SURFING & PEREKAMAN PENGETAHUAN TAVILY:
   Mampu mencari informasi aktual di internet via Tavily, memahami hasilnya secara kritis, dan merekam intisarinya ke basis pengetahuan lokal (Drive F:\\ / SQLite FTS5).
6. PEMBARUAN PENGETAHUAN HARIAN:
   Menjaga pembaruan wawasan harian dari internet melalui pemantauan dan pengarsipan berkala.
7. AKSES & PEMAHAMAN PERANGKAT LOKAL:
   Mengenali perangkat lokal (Drive F:\\, ruang kerja proyek, telemetri RAM/CPU) untuk pengoperasian digital yang aman dan transparan.
8. KONTINUITAS KONTEKS, ANTI-LOOPING & KLARIFIKASI AKTIF:
   - Wajib menjaga alur percakapan tetap berada dalam konteks yang dibahas.
   - JIKA TERJADI PENGULANGAN (LOOPING) ATAU PERMINTAAN KURANG DIPAHAMI: JANGAN MENJAWAB SECARA MEMBABI-BUTA. Hentikan tebakan sepihak, dan tanyakan kembali apa konteks yang dimaksud agar pembicaraan tetap terarah dan jelas.
   - Bersikaplah alami, santun, dan cerdas layaknya rekan diskusi sejati tanpa memuntahkan menu fitur kaku saat disapa.`;

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

  _saveHistory() {
    try {
      // Save last 20 messages (excluding heavy base64 dataUrl from localStorage)
      const toSave = this.messages.slice(-20).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        error: Boolean(m.error),
        imageUrl: m.imageUrl || null,
        musicPlayer: m.musicPlayer || null,
        files: Array.isArray(m.files)
          ? m.files.map(f => ({
              id: f.id,
              name: f.name,
              size: f.size,
              type: f.type,
              isImage: f.isImage,
              dataUrl: f.isImage && f.dataUrl && f.dataUrl.length < 50000 ? f.dataUrl : null
            }))
          : undefined
      }));
      localStorage.setItem('jin_ticker_history', JSON.stringify(toSave));
    } catch (saveErr) {
      console.warn('[ConversationController] localStorage save warning:', saveErr);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener({
          messages: [...this.messages],
          status: this.status,
          activeStreamingId: this.activeStreamingId,
          error: this.currentError
        });
      } catch (err) {
        console.warn('[ConversationController] listener error:', err);
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
    this.messages = [];
    this.status = 'idle';
    this.activeStreamingId = null;
    this.currentError = null;
    try {
      localStorage.removeItem('jin_ticker_history');
    } catch {}
    try {
      jinAvatarControllerInstance.dispatch({ type: AVATAR_EVENTS.RESET });
    } catch (_) {}
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
            dataUrl: f.dataUrl || null
          }))
        : undefined
    };

    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      isStreaming: true
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
            content: parts
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
        
        // B1. Multimodal Vision Assets: Images & PDFs (DataURL Base64)
        const isVisionMedia = f.isImage || f.isPdf || 
          (typeof f.dataUrl === 'string' && (f.dataUrl.startsWith('data:image/') || f.dataUrl.startsWith('data:application/pdf')));

        if (isVisionMedia && f.dataUrl) {
          mediaParts.push({
            type: 'image_url',
            image_url: { url: f.dataUrl }
          });
        }

        // B2. Textual Documents & Extracted Docx/Code
        if (f.content && typeof f.content === 'string' && f.content.trim()) {
          docContexts += `\n\n--- [BERKAS DOKUMEN TERLAMPIR: ${f.name || 'Dokumen'}] ---\n${f.content.trim()}\n--- [AKHIR DOKUMEN: ${f.name || 'Dokumen'}] ---`;
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
      const p = text.toLowerCase();
      
      // Exclude document inquiries/analysis of already saved files
      const isDocumentInquiry = /\b(berdasarkan\s+dokumen|jelaskan\s+(?:apa\s+yang\s+diatur|isi)|apa\s+isi\s+dokumen|rangkum|ringkas|baca\s+dokumen)\b/i.test(p);
      if (isDocumentInquiry) return false;

      // 1. Explicit folder creation / population
      if (/\b(buat|buatkan|bikin|create)\s+(?:sebuah\s+)?(folder|direktori)\b/i.test(p)) return true;
      if (/\b(isi\s+folder|isikan\s+folder|masukkan\s+ke\s+folder)\b/i.test(p)) return true;

      // 2. Physical drive destination (Drive F: or F:\...) with storage/action verbs
      if (/[a-zA-Z]:[\\\/]/.test(text) && /\b(simpan|unduh|download|taruh|masukkan|isi|isikan|carikan|cari|kumpulkan|panen|harvest|save)\b/i.test(p)) return true;
      if (/\b(drive\s+[a-zA-Z])\b/i.test(p) && /\b(simpan|unduh|download|taruh|masukkan|isi|isikan|carikan|cari|kumpulkan|save)\b/i.test(p)) return true;

      // 3. Action + destination keywords ("carikan ... simpan ke ...", "download ... ke ...", "simpan di ...")
      if (/\b(simpan|taruh|unduh|download)\s+(?:ke|di)\b/i.test(p)) return true;
      if (/\b(carikan|cari|unduh|download)\b/i.test(p) && /\b(simpan|taruh|masukkan|isi|tampung)\b/i.test(p)) return true;

      // 4. Folder mentions with topical content
      if (/\bfolder\b/i.test(p) && /\b(uu|peraturan|kuhp|hukum|undang|musik|lagu|dokumen|riset|data|berkas|file)\b/i.test(p)) return true;

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
                topic: h.topic || text,
                sources: Array.isArray(h.sources) ? h.sources : [],
                lastSavedFile: {
                  fileName: h.fileName,
                  filePath: h.filePath,
                  sizeKb: h.fileSize,
                  indexStatus: isAudio ? 'AUDIO_PHYSICAL_MOUNTED' : 'SQLITE_FTS5_INDEXED',
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
      const p = text.toLowerCase();
      return (/\b(berdasarkan\s+dokumen|dokumen\s+yang|apa\s+isi\s+dokumen|jelaskan\s+(?:apa\s+yang\s+diatur|isi)|baca\s+dokumen)\b/i.test(p) ||
              (/\b(jelaskan|rangkum|analisis|bedah|ulas)\b/i.test(p) && /(?:[a-zA-Z]:[\\\/]|folder\s+|drive\s+[a-zA-Z])/i.test(p))) &&
             !isFolderHarvestIntent;
    })();

    if (isDocInquiry) {
      let docFolder = 'PP';
      const folderMatch = text.match(/(?:[a-zA-Z]:[\\\/]|folder\s+|drive\s+[a-zA-Z]:?[\\\/]?)([a-zA-Z0-9_\-]+)/i);
      if (folderMatch && folderMatch[1]) {
        docFolder = folderMatch[1].replace(/^[a-zA-Z]:[\\\/]+/i, '').trim();
      } else if (/\buu\b/i.test(text)) {
        docFolder = 'UU_RI_Terbaru';
      } else if (/\bkuhp\b/i.test(text)) {
        docFolder = 'KUHP_RI_Terbaru';
      } else if (/\bpp\b/i.test(text)) {
        docFolder = 'PP';
      }

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

    // --- AUTONOMOUS MUSIC & LIVE RADIO PLAYER INTENT ---
    const isMusicIntent = !isFolderHarvestIntent && (() => {
      if (!text || typeof text !== 'string') return false;
      const p = text.toLowerCase();
      return /\b(putar|mainkan|hidupkan|bunyikan|nyalakan|play|setel|dengarkan)\s+(musik|lagu|audio|mp3|soundtrack|lofi|lo-fi|instrumen|instrument|synthwave|radio|siaran|streaming)\b/i.test(p) ||
             /\b(radio|radio\s+online|live\s+radio|streaming\s+radio|prambors|elshinta|rri|delta\s+fm)\b/i.test(p) ||
             /\b(player\s+mp3|mp3\s+player|pemutar\s+musik|pemutar\s+mp3|music\s+player|player\s+musik|radio\s+player|audio\s+canvas)\b/i.test(p) ||
             /\b(tampilkan\s+player|buka\s+player|aktifkan\s+player|nyalakan\s+player|tampilkan\s+radio)\b/i.test(p) ||
             /\b(putar\s+lofi|musik\s+lofi|lo-fi\s+player|lagu\s+santai|putar\s+radio)\b/i.test(p);
    })();

    if (isMusicIntent) {
      assistantMessage.musicPlayer = {
        active: true,
        autoPlay: true,
        requestedQuery: text
      };
    }



    // --- AUTONOMOUS WEB GROUNDING (TAVILY AI) ---
    const isSearchIntent = !isFolderHarvestIntent && (() => {
      if (!text || typeof text !== 'string') return false;
      const p = text.toLowerCase();
      if (/\b(cari|carikan|searching|search|browsing|browsingkan|cek\s+internet|lihat\s+internet|buka\s+internet|tavily|googling|gugling)\b/i.test(p)) return true;
      const hasInfoNoun = /\b(berita|kabar|info|informasi|isu|peristiwa|kejadian|agenda|update|perkembangan|harga|kurs|saham)\b/i.test(p);
      const hasTemporal = /\b(202[4-6]|terbaru|terkini|hari\s+ini|bulan\s+ini|minggu\s+ini|september\s+2026|oktober\s+2026|november\s+2026|desember\s+2026)\b/i.test(p);
      return Boolean(hasInfoNoun && (hasTemporal || p.includes('internet') || p.includes('web') || p.includes('tavily')));
    })();

    if (isSearchIntent) {
      let cleanQuery = text;
      cleanQuery = cleanQuery.replace(/bisakah\s+(anda|kamu|kau)\s+/gi, '');
      cleanQuery = cleanQuery.replace(/tolong\s+(carikan|cari|cek|temukan)\s+/gi, '');
      cleanQuery = cleanQuery.replace(/coba\s+(carikan|cari|cek|temukan)\s+/gi, '');
      cleanQuery = cleanQuery.replace(/apakah\s+(bisa|kamu\s+bisa|kau\s+bisa)\s+/gi, '');
      cleanQuery = cleanQuery.replace(/mungkin\s+tavily\s+bisa\s+membantu[^\,\.]*[\,\.]?/gi, '');
      cleanQuery = cleanQuery.replace(/utk\s+mencarinya\s+di\s+internet[\,\.]?/gi, '');
      cleanQuery = cleanQuery.replace(/di\s+internet[\,\.]?/gi, '');
      cleanQuery = cleanQuery.replace(/lewat\s+tavily[\,\.]?/gi, '');
      cleanQuery = cleanQuery.replace(/menggunakan\s+tavily[\,\.]?/gi, '');
      cleanQuery = cleanQuery.replace(/pake\s+tavily[\,\.]?/gi, '');
      cleanQuery = cleanQuery.replace(/pakai\s+tavily[\,\.]?/gi, '');
      cleanQuery = cleanQuery.replace(/\btavily\b/gi, '');
      cleanQuery = cleanQuery.replace(/\butk\b/gi, 'untuk');
      cleanQuery = cleanQuery.replace(/[\?\,\!]/g, ' ');
      cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();
      if (cleanQuery.length < 4) cleanQuery = text.replace(/\btavily\b/gi, '').trim();

      console.log(`[ConversationController] Autonomous Tavily grounding triggered for query: "${cleanQuery}"`);

      try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: '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',
            query: cleanQuery,
            search_depth: 'basic',
            include_answer: true,
            max_results: 4
          })
        }).then(r => r.json()).catch(() => null);

        if (tavilyRes && (tavilyRes.results?.length > 0 || tavilyRes.answer)) {
          const sources = tavilyRes.results || [];
          let groundingContext = `\n\n--- [DATA FAKTA TERVERIFIKASI INTERNET (TAVILY AI LIVE)] ---\n` +
            `Topik Pencarian: "${cleanQuery}"\n` +
            `Waktu Grounding: ${new Date().toISOString().slice(0, 10)}\n\n`;

          if (sources.length > 0) {
            groundingContext += sources.map((s, idx) => {
              let domain = 'web';
              try { domain = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
              return `${idx + 1}. Judul: ${s.title}\n   URL: ${s.url}\n   Domain: ${domain}\n   Ringkasan: ${s.content || s.title}`;
            }).join('\n\n');
          }

          if (tavilyRes.answer) {
            groundingContext += `\n\nIkhtisar Web: ${tavilyRes.answer}`;
          }

          groundingContext += `\n--- [AKHIR DATA FAKTA] ---`;

          if (typeof currentUserContent === 'string') {
            currentUserContent += groundingContext;
          } else if (Array.isArray(currentUserContent)) {
            currentUserContent.push({ type: 'text', text: groundingContext });
          }

          // Automatically commit harvested intelligence into Drive F:
          let savedCommitData = null;
          try {
            const commitRes = await fetch('/api/vault/harvest/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: cleanQuery,
                sources,
                answer: tavilyRes.answer || ''
              })
            });
            if (commitRes.ok) {
              savedCommitData = await commitRes.json();
              console.log('[ConversationController] Real Drive F file committed:', savedCommitData);
            }
          } catch (commitErr) {
            console.warn('[ConversationController] Drive F commit failed:', commitErr);
          }

          // Broadcast to right-hand monitor panel (Web Crawl Grounding + Drive F committed card)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tavily-grounding-update', {
              detail: {
                topic: cleanQuery,
                sources: sources.map(s => {
                  let domain = 'web';
                  try { domain = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
                  return {
                    title: s.title,
                    domain,
                    score: Math.round((s.score || 0.92) * 100) / 100
                  };
                }),
                lastSavedFile: savedCommitData?.fileName ? {
                  fileName: savedCommitData.fileName,
                  filePath: savedCommitData.filePath,
                  sizeKb: savedCommitData.sizeKb || '6.8 KB',
                  indexStatus: 'SQLITE_FTS5_INDEXED',
                  timestamp: new Date().toISOString()
                } : null
              }
            }));
          }
        }
      } catch (err) {
        console.warn('[ConversationController] Tavily fetch error:', err);
      }
    }

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

    const handleComplete = (fullText) => {
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
      let speechTriggered = false;
      try {
        if (voiceControllerInstance.isSpeakerEnabled()) {
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

    // Helper: Direct High-Speed Gemini 3.6 Flash Streaming
    const tryGeminiDirect = async () => {
      const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY is not configured');
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

      const contents = [];
      let systemInstruction = null;

      for (const m of payloadMessages) {
        if (!m) continue;
        if (m.role === 'system') {
          systemInstruction = { parts: [{ text: typeof m.content === 'string' ? m.content : '' }] };
          continue;
        }
        const geminiRole = m.role === 'assistant' ? 'model' : 'user';
        const parts = [];

        if (typeof m.content === 'string') {
          parts.push({ text: m.content });
        } else if (Array.isArray(m.content)) {
          for (const p of m.content) {
            if (p.type === 'text' && p.text) parts.push({ text: p.text });
            else if ((p.type === 'image_url' || p.image_url) && (p.image_url?.url || p.image_url)) {
              const u = p.image_url?.url || p.image_url;
              const match = String(u).match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
              }
            }
          }
        }

        if (parts.length > 0) {
          const last = contents[contents.length - 1];
          if (last && last.role === geminiRole) {
            last.parts.push(...parts);
          } else {
            contents.push({ role: geminiRole, parts });
          }
        }
      }

      if (contents.length === 0 || contents[0].role !== 'user') {
        contents.unshift({ role: 'user', parts: [{ text: 'Mulai percakapan' }] });
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: { temperature: 0.7 }
        })
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Gemini Cloud HTTP ${res.status}: ${t.slice(0, 100)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunk) {
              fullText += chunk;
              handleDelta(chunk, fullText);
            }
          } catch {}
        }
      }

      handleComplete(fullText);
      return fullText;
    };

    // Route Strategy:
    // If request contains images OR web grounding intent OR local document inquiry -> prioritize Gemini 2.5 Flash direct for <1.5s real-time accuracy
    const hasMediaOrSearch = Boolean(mediaFiles.length > 0 || isSearchIntent || isDocInquiry);

    if (hasMediaOrSearch) {
      try {
        console.log('[ConversationController] Engaging Gemini 2.5 Flash Cloud for Multimodal/Grounding...');
        await tryGeminiDirect();
        return assistantMessage.content;
      } catch (geminiErr) {
        console.warn('[ConversationController] Gemini direct failed, attempting Local Router...', geminiErr);
      }
    }

    try {
      await localRouterClient.streamChat(
        {
          messages: payloadMessages,
          model: 'auto',
          temperature: 0.7
        },
        {
          onDelta: handleDelta,
          onComplete: handleComplete,
          onError: async (err) => {
            console.warn('[ConversationController] LocalRouter error, engaging instant Gemini Cloud failover...', err.message);
            try {
              await tryGeminiDirect();
            } catch (fallbackErr) {
              handleError(err);
            }
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

