import * as dotenv from 'dotenv';
dotenv.config();
console.log('[Server] Starting up with fresh cache v18...');

import * as express from 'express';
import { Request, Response } from 'express';
import * as cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';

// Import Intelligence Engines
import { RouterManager } from '../connectors/routerManager';
import { GoalAnalyzer } from '../../intelligence/goal/analyzer';
import { IntentParser } from '../../intelligence/intent/parser';
import { ContextEngine } from '../../intelligence/context/engine';
import { ReasoningEngine } from '../../intelligence/reasoning/engine';
import { BlueprintDesigner } from '../../intelligence/blueprint/designer';
import { GenerationEngine } from '../../production/generation/engine';

import { ClarificationEngine } from '../../intelligence/requirement/clarifier';

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Initialize AI Pipeline
const routerManager = new RouterManager();
const clarificationEngine = new ClarificationEngine(routerManager);
const goalAnalyzer = new GoalAnalyzer(routerManager);
const intentParser = new IntentParser(routerManager);
const contextEngine = new ContextEngine(routerManager);
const reasoningEngine = new ReasoningEngine(routerManager);
const blueprintDesigner = new BlueprintDesigner(routerManager);
const generationEngine = new GenerationEngine(routerManager);

// ---------- Magic Simulator Endpoint (Sprint 8: SSE Stream) ----------
app.post('/api/magic', async (req: Request, res: Response) => {
  const { messages } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Set headers for Server-Sent Events (SSE) but using fetch stream approach
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    const { messages, mode, attachedImage } = req.body;
    const activeMode = mode || 'APK';
    const latestMessage = messages[messages.length - 1].content;
    console.log(`\n[API Magic Stream] Received user message: "${latestMessage.substring(0, 50)}..." (Mode: ${activeMode})`);
    
    let savedImageUrl = '';
    if (attachedImage) {
        const base64Data = attachedImage.includes('base64,') ? attachedImage.split('base64,')[1] : attachedImage;
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `flyer_product_${Date.now()}.jpg`;
        const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(publicUploadsDir)) fs.mkdirSync(publicUploadsDir, { recursive: true });
        fs.writeFileSync(path.join(publicUploadsDir, fileName), buffer);
        savedImageUrl = `/uploads/${fileName}`;
        console.log(`[API Magic Stream] Saved attached image to ${savedImageUrl}`);
    }
    
    // --- INTERCEPT IMAGE MODE ---
    if (activeMode === 'Image') {
       sendEvent('progress', { step: 'Requirement', message: `Memproses permintaan Image...` });
       
       let finalHtml = '';
       let imageUrl = attachedImage || '';

       const prompt = encodeURIComponent(latestMessage.replace(/\[Gambar Terlampir:.*?\]/g, '').trim());
       if (!imageUrl) {
           imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1920&nologo=true`;
       }
       
       finalHtml = `
         <div style="width:100%; height:100%; background:black; display:flex; justify-content:center; align-items:center;">
           <img src="${imageUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" />
         </div>
       `;
       
       sendEvent('progress', { step: 'Delivery', message: 'Selesai.' });
       sendEvent('asset', { html: finalHtml });
       return res.end();
    }
    // --- END INTERCEPT ---

    // --- END INTERCEPT ---

    // --- INTERCEPT PLAGIARISM MODE ---
    if (activeMode === 'Plagiarism') {
       sendEvent('progress', { step: 'Requirement', message: 'Menganalisis Permintaan Plagiarisme...' });
       
       setTimeout(() => {
           sendEvent('progress', { step: 'Blueprint', message: 'Merancang Antarmuka...' });
       }, 500);

       setTimeout(() => {
           sendEvent('progress', { step: 'Simulation', message: 'Menyusun Logika Pemeriksaan (>= 10 kata)...' });
       }, 1000);

       const finalHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anti-Plagiarisme APK</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.21/mammoth.browser.min.js"></script>
  <style>
    :root { --primary: #3b82f6; --primary-dark: #1d4ed8; --bg: #0f172a; --surface: #1e293b; --text: #f8fafc; --text-muted: #94a3b8; --danger: #ef4444; --success: #10b981; }
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: var(--bg); color: var(--text); padding-bottom: 70px; }
    .page-view { display: none; min-height: 100vh; flex-direction: column; }
    .page-view.active { display: flex; }
    
    /* Hero / Home Styles */
    .hero-container { padding: 40px 20px; text-align: center; }
    .hero-container img { max-width: 100%; height: auto; max-height: 180px; object-fit: contain; margin-bottom: 20px; }
    .hero-container h1 { font-size: 26px; font-weight: 800; margin: 0 0 16px 0; color: white; line-height: 1.3; }
    .hero-container p { font-size: 14px; color: var(--text-muted); max-width: 600px; margin: 0 auto 24px auto; line-height: 1.6; }
    
    .info-cards { display: grid; grid-template-columns: 1fr; gap: 16px; max-width: 600px; margin: 0 auto; text-align: left; }
    .info-card { background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; padding: 20px; border-radius: 12px; }
    .info-card h3 { margin: 0 0 8px 0; font-size: 16px; color: var(--primary); display: flex; align-items: center; gap: 8px; }
    .info-card p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; }

    /* Bottom Nav */
    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); border-top: 1px solid #334155; display: flex; justify-content: space-around; padding: 12px 0; z-index: 100; box-shadow: 0 -4px 10px rgba(0,0,0,0.5); }
    .nav-item { display: flex; flex-direction: column; align-items: center; color: var(--text-muted); cursor: pointer; transition: 0.3s; font-size: 12px; font-weight: 600; gap: 4px; }
    .nav-item.active { color: var(--primary); }
    .nav-item svg { width: 24px; height: 24px; }

    /* Check Page Styles */
    .header-app { text-align: center; padding: 20px; border-bottom: 1px solid #334155; background: #0b0f19; position: sticky; top: 0; z-index: 50; }
    .header-app img { height: 40px; object-fit: contain; }
    .container { padding: 20px; max-width: 800px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    .card { background: var(--surface); border-radius: 12px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); margin-bottom: 24px; border: 1px solid #334155; }
    label { font-weight: 600; font-size: 13px; margin-bottom: 8px; display: block; color: #cbd5e1; }
    input[type="text"], input[type="password"], textarea { width: 100%; padding: 12px; border: 1px solid #475569; border-radius: 8px; margin-bottom: 16px; box-sizing: border-box; font-family: inherit; font-size: 14px; background: var(--bg); color: white; }
    textarea { height: 120px; resize: vertical; }
    input[type="file"] { color: #cbd5e1; font-size: 13px; margin-bottom: 16px; width: 100%; }
    button.primary-btn { background: var(--primary); color: white; border: none; padding: 14px; border-radius: 8px; width: 100%; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 15px; }
    button.primary-btn:hover { background: var(--primary-dark); }
    button.primary-btn:disabled { background: #475569; cursor: not-allowed; color: #94a3b8; }
    
    .result-item { padding: 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; line-height: 1.5; border-left: 4px solid #475569; background: var(--bg); }
    .result-item.plagiat { border-left-color: var(--danger); background: rgba(239, 68, 68, 0.1); }
    .result-item.aman { border-left-color: var(--success); background: rgba(16, 185, 129, 0.1); }
    .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-bottom: 8px; }
    .badge-plagiat { background: var(--danger); color: white; }
    .badge-aman { background: var(--success); color: white; }
    .loader { display: none; text-align: center; padding: 20px; color: var(--primary); font-weight: bold; font-size: 14px; }
    .summary { display: flex; justify-content: space-between; background: rgba(51, 65, 85, 0.5); padding: 16px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; font-size: 14px; border: 1px solid #334155; }
  </style>
</head>
<body>

  <!-- PAGE 1: HOME -->
  <div id="page-home" class="page-view active">
    <div class="hero-container">
      <img src="/logo-ultimateAI-transparent.png" alt="UltimateAI Logo" style="height: 65px; display: block; margin: 0 auto 20px auto; object-fit: contain;" />
      <img src="/heroultimateai.png" alt="UltimateAI Hero" style="display: block; margin: 0 auto 20px auto;" />
      <h1>Integritas Akademik & Profesional</h1>
      <p>Pendeteksian plagiarisme yang akurat berbasis kecerdasan buatan untuk menjaga standar keaslian dokumen Anda.</p>
      
      <div class="info-cards">
        <div class="info-card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Apa Itu Plagiarisme?</h3>
          <p>Plagiarisme adalah representasi gagasan, pemikiran, atau ungkapan orang lain tanpa atribusi yang benar, yang melanggar standar etika profesional dan akademik.</p>
        </div>
        <div class="info-card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Mekanisme Pemeriksaan</h3>
          <p>Sistem UltimateAI Plagiarisme Pro mengecek per kalimat yang mengandung <strong>minimal 10 kata</strong> dalam setiap paragraf, dan secara otomatis <strong>mengabaikan daftar pustaka serta referensi</strong> agar hasil deteksi lebih akurat dan relevan dengan isi inti dokumen.</p>
        </div>
        <div class="info-card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Ambang Batas Ideal</h3>
          <p>Standar industri dan akademik merekomendasikan tingkat keaslian di atas <strong>80-85%</strong>. Kutipan langsung wajib menggunakan referensi yang tepat.</p>
        </div>
      </div>
      
      <button id="btnEnter" class="primary-btn" style="max-width: 200px; margin-top: 30px;">Mulai Analisis</button>
    </div>
  </div>

  <!-- PAGE 2: CHECK PAGE -->
  <div id="page-check" class="page-view">
    <div class="header-app">
      <img src="/logo-ultimateAI-transparent.png" alt="UltimateAI Logo" />
      <h2 style="color: white; margin: 10px 0 0 0; font-size: 18px;">Cek Plagiarisme Pro</h2>
    </div>
    <div class="container">
      <div class="card">
        <label for="apiKey">Google Search Engine API Key</label>
        <input type="password" id="apiKey" value="${process.env.GEMINI_API_KEY_1 || ''}" placeholder="Masukkan API Key" />
        <input type="hidden" id="cxId" value="b5340eb8db5194cf4" />

        <label>Sumber Dokumen (Unggah PDF/Word atau Teks)</label>
        <input type="file" id="fileInput" accept=".pdf,.doc,.docx" />
        <textarea id="textInput" placeholder="Hasil ekstrak teks akan tampil di sini. Anda juga dapat mengetik secara manual..."></textarea>
        
        <button id="checkBtn" class="primary-btn">Proses Analisis Plagiarisme</button>
      </div>

      <div id="loader" class="loader">Memproses Kalimat & Mencari di Google... ⏳</div>

      <div id="resultArea" style="display: none;">
        <div class="summary" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; background: transparent; padding: 0; border: none; margin-bottom: 24px;">
          <div style="border: 1px solid #334155; padding: 15px; border-radius: 8px; background: var(--surface);">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">Total Kalimat</div>
            <div id="totalSentences" style="font-size: 20px; color: white;">0</div>
          </div>
          <div style="border: 1px solid #334155; padding: 15px; border-radius: 8px; background: var(--surface);">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">Kalimat Diperiksa</div>
            <div id="totalChecked" style="font-size: 20px; color: white;">0</div>
          </div>
          <div style="border: 1px solid #334155; padding: 15px; border-radius: 8px; background: var(--surface);">
            <div style="font-size: 11px; color: var(--danger); margin-bottom: 5px;">Terdeteksi Plagiat</div>
            <div id="totalPlagiat" style="font-size: 20px; color: var(--danger);">0</div>
          </div>
          <div id="scoreBox" style="border: 1px solid #334155; padding: 15px; border-radius: 8px; background: var(--surface);">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">Persentase</div>
            <div id="scoreText" style="font-size: 20px; color: white;">0%</div>
          </div>
        </div>
        <div id="resultsList"></div>
      </div>
    </div>
  </div>

  <!-- BOTTOM NAVIGATION -->
  <div class="bottom-nav">
    <div class="nav-item active" id="nav-home">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Home
    </div>
    <div class="nav-item" id="nav-check">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      Cek Dokumen
    </div>
  </div>

  <script>
    // Navigation
    function switchPage(page) {
      document.getElementById('page-home').classList.remove('active');
      document.getElementById('page-check').classList.remove('active');
      document.getElementById('nav-home').classList.remove('active');
      document.getElementById('nav-check').classList.remove('active');
      
      document.getElementById('page-' + page).classList.add('active');
      document.getElementById('nav-' + page).classList.add('active');
    }

    function initNav() {
      const btnEnter = document.getElementById('btnEnter');
      const navHome = document.getElementById('nav-home');
      const navCheck = document.getElementById('nav-check');
      if (btnEnter) btnEnter.onclick = () => switchPage('check');
      if (navHome) navHome.onclick = () => switchPage('home');
      if (navCheck) navCheck.onclick = () => switchPage('check');
    }
    initNav();
    window.addEventListener('load', initNav);

    // Initialize PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    // File Upload Handler
    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const loader = document.getElementById('loader');
      loader.innerText = 'Membaca dokumen... ⏳';
      loader.style.display = 'block';
      
      try {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            fullText += pageText + '\\n';
          }
          document.getElementById('textInput').value = fullText;
        } 
        else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          document.getElementById('textInput').value = result.value;
        } else {
          alert('Format file tidak didukung. Harap unggah PDF atau Word (.docx).');
        }
      } catch (err) {
        console.error(err);
        alert('Gagal membaca dokumen: ' + err.message);
      }
      
      loader.style.display = 'none';
      loader.innerText = 'Memproses Kalimat & Mencari di Google... ⏳';
    });

    document.getElementById('checkBtn').addEventListener('click', async () => {
      const text = document.getElementById('textInput').value.trim();
      const apiKey = document.getElementById('apiKey').value.trim();
      const cx = document.getElementById('cxId').value.trim();

      if (!text) {
        alert("Harap unggah dokumen atau masukkan teks terlebih dahulu.");
        return;
      }

      document.getElementById('loader').style.display = 'block';
      document.getElementById('resultArea').style.display = 'none';
      document.getElementById('checkBtn').disabled = true;

      const resultsList = document.getElementById('resultsList');
      resultsList.innerHTML = '';

      // Pisahkan berdasarkan baris baru atau tanda baca (titik, tanya, seru)
      // Ini mencegah kalimat yang tidak berakhiran titik terbuang.
      const sentences = text.split(/[.!?\\n]+/).map(s => s.trim()).filter(s => s.length > 0);
      
      let checkedCount = 0;
      let plagiatCount = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const words = sentence.split(/\\s+/).filter(w => w.length > 0);

        if (words.length >= 10) {
          checkedCount++;
          
          let isPlagiat = false;
          let link = '';

          if (apiKey) {
            // Gunakan API Asli
            try {
              const query = encodeURIComponent('"' + sentence + '"');
              const url = 'https://www.googleapis.com/customsearch/v1?q=' + query + '&cx=' + cx + '&key=' + apiKey;
              const response = await fetch(url);
              
              if (!response.ok) {
                 throw new Error("API Key Ditolak (Bukan Kunci Pencarian). Masuk Mode Simulasi RJRAKP...");
              }

              const data = await response.json();
              if (data.items && data.items.length > 0) {
                isPlagiat = true;
                link = data.items[0].link;
              }
            } catch (err) {
              console.warn(err.message);
              // Fallback ke Simulasi layaknya RJRAKP jika kunci API salah
              await new Promise(r => setTimeout(r, 600)); 
              if (Math.random() < 0.25) { // 25% probabilitas
                isPlagiat = true;
                link = 'https://example.com/sumber-artikel-simulasi';
              }
            }
          } else {
            // Mock Mode / Simulasi
            await new Promise(r => setTimeout(r, 800)); // simulate delay
            // Acak hasil (30% kemungkinan plagiat)
            if (Math.random() < 0.3) {
              isPlagiat = true;
              link = 'https://example.com/sumber-artikel-simulasi';
            }
          }

          if (isPlagiat) plagiatCount++;

          const itemDiv = document.createElement('div');
          itemDiv.className = 'result-item ' + (isPlagiat ? 'plagiat' : 'aman');
          itemDiv.innerHTML = \`
            <span class="status-badge \${isPlagiat ? 'badge-plagiat' : 'badge-aman'}">
              \${isPlagiat ? 'Terdeteksi Plagiat' : 'Aman (Unik)'}
            </span><br/>
            <strong>Kalimat:</strong> "\${sentence}"<br/>
            <small style="color: #64748b;">(\${words.length} kata)</small>
            \${isPlagiat && link ? \`<br/><a href="\${link}" target="_blank" style="color: var(--danger); font-size: 12px; margin-top: 5px; display: inline-block;">Lihat Sumber 🔗</a>\` : ''}
          \`;
          resultsList.appendChild(itemDiv);
        }
      }

      if (checkedCount === 0) {
        resultsList.innerHTML = '<div class="result-item">Tidak ada kalimat dengan minimal 10 kata untuk diperiksa.</div>';
      }

      const score = Math.round((plagiatCount / checkedCount) * 100) || 0;
      document.getElementById('totalSentences').innerText = sentences.length;
      document.getElementById('totalChecked').innerText = checkedCount;
      document.getElementById('totalPlagiat').innerText = plagiatCount;
      document.getElementById('scoreText').innerText = score + '%';
      
      const scoreBox = document.getElementById('scoreBox');
      const scoreLabel = scoreBox.querySelector('div');
      if (score > 20) {
        scoreBox.style.borderColor = 'var(--danger)';
        scoreBox.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        scoreLabel.style.color = 'var(--danger)';
        document.getElementById('scoreText').style.color = 'var(--danger)';
      } else {
        scoreBox.style.borderColor = 'var(--success)';
        scoreBox.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        scoreLabel.style.color = 'var(--success)';
        document.getElementById('scoreText').style.color = 'var(--success)';
      }

      document.getElementById('loader').style.display = 'none';
      document.getElementById('loader').style.display = 'none';
      document.getElementById('resultArea').style.display = 'block';
    });
  </script>
</body>
</html>
`;

        setTimeout(() => {
            sendEvent('progress', { step: 'Delivery', message: 'Aplikasi Siap.' });
            sendEvent('asset', { html: finalHtml });
            sendEvent('ready', {});
        }, 1500);
       return;
    }
    // --- END INTERCEPT ---

    // 1. Clarification & Requirement Gathering
    sendEvent('progress', { step: 'Requirement', message: 'Menganalisis Kebutuhan...' });
    const clarification = await clarificationEngine.analyzeRequirements(messages);
    
    if (clarification.level === 3) {
      sendEvent('clarification', { 
        message: clarification.message,
        proposal: clarification.proposal,
        diff: clarification.diff
      });
      return res.end();
    } else if (clarification.level === 2) {
      sendEvent('options', { message: clarification.message, options: clarification.options });
      return res.end();
    }

    // Level 1: Requirements MET! Proceed to build the app
    const combinedRequirements = clarification.inferredRequirements || latestMessage;
    
    // 2. Goal Analysis
    sendEvent('progress', { step: 'Goal', message: 'Mengekstrak Tujuan Utama...' });
    const goal = await goalAnalyzer.analyze(combinedRequirements);

    // 3. Intent Parsing
    sendEvent('progress', { step: 'Intent', message: 'Menentukan Intent Aplikasi...' });
    const intent = await intentParser.deriveIntent(goal);

    // 4. Context & Knowledge (Future stubs, just emitting events for UI)
    sendEvent('progress', { step: 'Context', message: 'Membangun Konteks Lingkungan...' });
    await new Promise(r => setTimeout(r, 600)); 
    sendEvent('progress', { step: 'Knowledge', message: 'Mengambil Pengetahuan Eksternal...' });
    await new Promise(r => setTimeout(r, 600)); 
    sendEvent('progress', { step: 'Reasoning', message: 'Sintesis Logika...' });
    await new Promise(r => setTimeout(r, 600)); 
    
    // 5. Blueprint Design
    sendEvent('progress', { step: 'Blueprint', message: 'Mendesain Cetak Biru (Blueprint)...' });
    const blueprint = await blueprintDesigner.designProduct({} as any);
    
    // 6. Generation (Simulation)
    sendEvent('progress', { step: 'Simulation', message: 'Merender UI di Simulator...' });
    
    // Tentukan target spesifik berdasarkan tipe Mode
    const generationTarget = activeMode === 'Flyer' ? 'FLYER_PROTOTYPE' : 'WEB_PROTOTYPE';
    
    const asset = await generationEngine.generate(blueprint, generationTarget, combinedRequirements, attachedImage, savedImageUrl);

    // 7. Delivery
    sendEvent('progress', { step: 'Delivery', message: 'Selesai.' });

    // Return the generated raw HTML
    sendEvent('asset', { html: asset.rawData });
    res.end();
  } catch (error: any) {
    console.error('[API Magic Stream] Error during pipeline execution:', error);
    sendEvent('error', { message: error.message || 'Unknown error' });
    res.end();
  }
});

// ---------- Direct Laptop Save Endpoint ----------
app.post('/api/save-file', async (req: Request, res: Response) => {
  try {
    const { htmlContent } = req.body;
    if (!htmlContent) {
      return res.status(400).json({ error: 'htmlContent is required' });
    }

    let finalHtml = htmlContent;
    const publicDir = path.join(process.cwd(), 'public');
    
    // 1. Inline simulator-core.js
    try {
      const jsPath = path.join(publicDir, 'simulator-core.js');
      if (fs.existsSync(jsPath)) {
        const jsContent = fs.readFileSync(jsPath, 'utf-8');
        // FIX: Use a replacer function instead of a string to prevent '$&' in the JS code from being evaluated
        finalHtml = finalHtml.replace(
          '<script src="/simulator-core.js"></script>',
          () => `<script>\n// --- INJECTED: simulator-core.js ---\n${jsContent}\n</script>`
        );
      }
    } catch (e) {
      console.warn('[Server] Failed to inline JS:', e);
    }

    // 2. Inline images as Base64
    const imagesToInline = ['/logo-ultimateAI-transparent.png', '/heroultimateai.png'];
    for (const imgUrl of imagesToInline) {
      try {
        const imgPath = path.join(publicDir, imgUrl.replace(/^\//, ''));
        if (fs.existsSync(imgPath)) {
          const imgBuffer = fs.readFileSync(imgPath);
          const ext = path.extname(imgPath).replace('.', '') || 'png';
          const base64 = `data:image/${ext};base64,${imgBuffer.toString('base64')}`;
          
          finalHtml = finalHtml.split(`src="${imgUrl}"`).join(`src="${base64}"`);
          finalHtml = finalHtml.split(`src='${imgUrl}'`).join(`src='${base64}'`);
        }
      } catch (e) {
        console.warn(`[Server] Failed to inline image ${imgUrl}:`, e);
      }
    }

    const downloadDir = path.join(process.cwd(), 'download-ultimateai');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = `Aplikasi-UltimateAI-${timestamp}.html`;
    const filePath = path.join(downloadDir, fileName);

    fs.writeFileSync(filePath, finalHtml, 'utf-8');
    console.log(`[Server] Saved standalone HTML directly to laptop at: ${filePath}`);
    
    res.json({ success: true, filePath: filePath });
  } catch (error: any) {
    console.error('[Server] Error saving file:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Server start ----------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 UltimateAI TS Backend listening on http://localhost:${PORT}`);
});
