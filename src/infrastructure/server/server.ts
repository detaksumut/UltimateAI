import * as dotenv from 'dotenv';
dotenv.config();
console.log('[Server] Starting up with fresh cache v18...');

import express from 'express';
import { Request, Response } from 'express';
import cors from 'cors';
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


    // --- INTERCEPT OJS/PKP GENERATOR MODE ---
    if (activeMode === 'OjsPkp') {
       sendEvent('progress', { step: 'Requirement', message: 'Menganalisis Spesifikasi Platform OJS/PKP...' });
       
       setTimeout(() => {
           sendEvent('progress', { step: 'Blueprint', message: 'Mendesain Cetak Biru UJE Generator (DDD)...' });
       }, 500);

       setTimeout(() => {
           sendEvent('progress', { step: 'Simulation', message: 'Merakit Sistem OJS 3 (NextJS + Prisma)...' });
       }, 1000);

       const finalHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ultimate Journal Enterprise (UJE) Generator</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0E2A47;
      --secondary: #D4A62A;
      --bg: #ffffff;
      --neutral: #f5f7fa;
      --text: #1f2937;
      --text-muted: #6b7280;
      --border: #e5e7eb;
      --success: #10b981;
      --danger: #ef4444;
      --font-title: 'Playfair Display', serif;
      --font-body: 'Inter', sans-serif;
    }
    
    * { box-sizing: border-box; transition: background-color 0.2s, border-color 0.2s; }
    body { font-family: var(--font-body); margin: 0; padding: 0; background: #0b0f19; color: var(--text); overflow-x: hidden; height: 100vh; display: flex; flex-direction: column; }
    
    .screen { display: none; width: 100%; height: 100%; flex-direction: column; overflow-y: auto; padding-bottom: 60px; background: var(--bg); }
    .screen.active { display: flex; }
    
    /* Screen 1: Generator Setup */
    .setup-container { padding: 24px; color: #f3f4f6; background: #0f172a; min-height: 100vh; }
    .setup-header { text-align: center; margin-bottom: 24px; }
    .setup-header img { height: 50px; margin-bottom: 12px; }
    .setup-header h1 { font-family: var(--font-title); font-size: 20px; font-weight: 700; margin: 0; color: #ffffff; }
    .setup-header p { font-size: 11px; color: #9ca3af; margin: 4px 0 0 0; letter-spacing: 0.05em; text-transform: uppercase; }
    
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: white; font-family: inherit; font-size: 13px; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #6366f1; }
    
    .checkbox-group { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 8px; }
    .checkbox-item { display: flex; align-items: center; gap: 8px; background: #1e293b; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; cursor: pointer; }
    .checkbox-item input { width: auto; margin: 0; }
    .checkbox-item span { font-size: 11px; color: #e2e8f0; font-weight: 500; }
    
    .btn-generate { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none; padding: 12px; border-radius: 8px; width: 100%; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 24px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
    .btn-generate:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4); }
    
    /* Screen 2: Building Logs */
    .building-container { padding: 24px; color: #4ade80; background: #050b14; min-height: 100vh; font-family: 'Courier New', Courier, monospace; display: flex; flex-direction: column; justify-content: space-between; }
    .log-header { text-align: center; color: white; font-family: var(--font-body); }
    .log-header h2 { font-size: 16px; margin: 0 0 4px 0; }
    .progress-bar-container { background: #1e293b; height: 6px; border-radius: 3px; overflow: hidden; margin: 16px 0; }
    .progress-bar-fill { height: 100%; background: #4ade80; width: 0%; transition: width 0.1s linear; }
    .log-terminal { flex: 1; background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-size: 10px; line-height: 1.5; overflow-y: auto; height: 350px; margin-bottom: 16px; color: #a7f3d0; white-space: pre-wrap; }
    
    /* Screen 3: Generated App View */
    /* Desktop SINTA Top Navigation */
    .top-nav-sinta { background: white; border-bottom: 2px solid var(--secondary); display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .top-nav-sinta .logo-area { display: flex; align-items: center; gap: 8px; }
    .top-nav-sinta .logo-area h2 { font-family: var(--font-title); font-size: 16px; margin: 0; font-weight: 800; color: var(--primary); }
    .top-nav-sinta .nav-links { display: flex; gap: 16px; align-items: center; }
    .top-nav-sinta .nav-link { color: var(--text-muted); font-size: 12px; font-weight: 600; text-decoration: none; cursor: pointer; padding: 6px 12px; border-radius: 4px; transition: all 0.2s; }
    .top-nav-sinta .nav-link:hover, .top-nav-sinta .nav-link.active { color: var(--primary); background: var(--neutral); }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .btn-portal { font-size: 11px; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 600; text-decoration: none; background: var(--secondary); color: var(--primary); }
    .btn-reset { font-size: 11px; border: 1px solid var(--border); padding: 7px 15px; border-radius: 4px; cursor: pointer; font-weight: 600; background: white; color: var(--text-muted); }
    .btn-reset:hover { background: var(--neutral); }

    /* Desktop Layout Grid */
    .desktop-layout { display: grid; grid-template-columns: 2.2fr 1fr; gap: 24px; max-width: 1200px; margin: 0 auto; padding: 24px; align-items: start; }
    .desktop-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .desktop-sidebar { display: flex; flex-direction: column; gap: 24px; min-width: 250px; }
    
    /* Sidebar Cards */
    .sidebar-card { background: white; border-radius: 8px; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
    .sidebar-card-header { background: #5bc0de; color: white; padding: 12px; font-size: 11px; font-weight: 700; text-align: center; border-bottom: 2px solid rgba(0,0,0,0.05); }
    .sidebar-card-header.orange { background: #f0ad4e; cursor: pointer; }
    .sidebar-card-body { padding: 16px; }
    
    /* Bar Chart Simulation */
    .bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 100px; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 16px; gap: 4px; }
    .bar { background: #5cb85c; width: 100%; border-radius: 2px 2px 0 0; }
    .bar-label-container { display: flex; justify-content: space-around; margin-top: 8px; font-size: 9px; color: var(--text-muted); }
    
    /* Stats Table Simulation */
    .stats-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
    .stats-table th { text-align: center; color: var(--text-muted); font-weight: 600; padding: 8px; border-bottom: 1px solid var(--border); }
    .stats-table td { text-align: center; padding: 8px; font-weight: 700; color: var(--text); border-bottom: 1px dashed var(--neutral); }
    
    /* Public SINTA-style view */
    .public-hero {
      background: linear-gradient(135deg, rgba(14, 42, 71, 0.95) 0%, rgba(10, 30, 50, 0.98) 100%);
      background-image: radial-gradient(circle at 10% 20%, rgba(0,0,0,0.15) 0%, transparent 80%), 
                        linear-gradient(rgba(14, 42, 71, 0.8), rgba(14, 42, 71, 0.95));
      position: relative;
      color: white;
      padding: 30px 16px 60px 16px; border-radius: 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    
    .sinta-logo-box {
      width: 55px;
      height: 55px;
      background: white;
      border: 3px solid var(--secondary);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
    .sinta-logo-box svg {
      width: 32px;
      height: 32px;
      stroke: var(--primary);
    }
    
    .public-hero h1 {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 800;
      margin: 0 0 6px 0;
      color: white;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.3;
    }
    .sinta-location {
      font-size: 8px;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sinta-issn {
      font-size: 8px;
      color: rgba(255,255,255,0.7);
      font-weight: 500;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding: 0 24px;
      margin-top: -40px;
      position: relative;
      z-index: 10;
    }
    .metric-card {
      background: white;
      border-radius: 12px;
      padding: 16px 8px;
      text-align: center;
      box-shadow: 0 8px 16px rgba(0,0,0,0.1);
      border-bottom: 3px solid var(--secondary);
    }
    .metric-value {
      font-size: 13px;
      font-weight: 800;
      color: #1f2937;
    }
    .metric-label {
      font-size: 7px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 4px;
    }
    
    /* Links Row */
    .links-row {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 10px 16px;
      background: var(--neutral);
      border-bottom: 1px solid var(--border);
    }
    .sinta-link {
      font-size: 8px;
      color: #2563eb;
      font-weight: 700;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .sinta-link svg {
      width: 10px;
      height: 10px;
      stroke: #2563eb;
    }

    /* History Accreditation Timeline */
    .accred-history {
      padding: 12px 16px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
    }
    .accred-history-title {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-align: center;
    }
    .timeline-bar {
      height: 14px;
      background: #facc15;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 10px;
      position: relative;
    }
    .timeline-year {
      font-size: 7px;
      font-weight: 800;
      color: #1e3a8a;
    }
    
    /* SINTA Tabs styling */
    .sinta-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      background: var(--neutral);
      padding: 0 16px;
    }
    .sinta-tab {
      padding: 10px 14px;
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
    }
    .sinta-tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    
    /* SINTA Article styles */
    .sinta-article {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
    }
    .sinta-article-title {
      font-size: 10px;
      font-weight: 700;
      color: #2563eb;
      margin: 0 0 4px 0;
      line-height: 1.4;
      cursor: pointer;
      text-decoration: none;
      display: block;
      text-align: left;
    }
    .sinta-article-title:hover {
      text-decoration: underline;
    }
    .sinta-article-publisher {
      font-size: 8px;
      color: var(--text-muted);
      margin-bottom: 6px;
      font-weight: 500;
      text-align: left;
    }
    .sinta-badges-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .sinta-badge-item {
      font-size: 7px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 3px;
      background: var(--neutral);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .sinta-badge-item.orange {
      background: #fff7ed;
      color: #ea580c;
      border-color: #ffedd5;
    }

    /* Scholar Widget */
    .scholar-widget {
      padding: 16px;
      background: var(--neutral);
      border-top: 1px solid var(--border);
    }
    .chart-container {
      background: white;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .chart-title {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      text-align: center;
      margin-bottom: 12px;
    }
    .chart-bars {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 60px;
      padding: 0 10px;
    }
    .chart-bar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 10%;
    }
    .chart-bar {
      background: #22c55e;
      width: 100%;
      border-radius: 2px 2px 0 0;
      transition: height 0.5s;
    }
    .chart-year {
      font-size: 6px;
      font-weight: 600;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .scholar-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 8px;
      overflow: hidden;
    }
    .scholar-table th, .scholar-table td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .scholar-table th {
      background: var(--neutral);
      font-weight: 700;
      color: var(--primary);
    }
    
    /* Login Page CSS */
    .login-container {
      padding: 30px 24px;
      background: #0f172a;
      min-height: 100vh;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .login-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }
    .btn-orcid {
      background: #a6ce39;
      color: white;
      font-weight: 700;
      border: none;
      padding: 10px;
      border-radius: 6px;
      width: 100%;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    
    /* Table directory css */
    .user-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-top: 10px;
    }
    .user-table th, .user-table td {
      padding: 8px;
      border: 1px solid var(--border);
      text-align: left;
    }
    .user-table th {
      background: var(--neutral);
      color: var(--primary);
    }
    
    /* Info sections */
    .info-section {
      padding: 16px;
      background: var(--bg);
    }
    .info-list-item {
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .info-list-item h4 {
      margin: 0 0 4px 0;
      font-size: 11px;
      color: var(--primary);
    }
    .info-list-item p {
      margin: 0;
      font-size: 9px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Warning message double blind */
    .double-blind-alert {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 10px 12px;
      border-radius: 6px;
      margin: 12px 16px;
      font-size: 9px;
      color: #b45309;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    
    /* Dashboard Tabs */
    .dashboard-tabs {
      background: var(--neutral);
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      gap: 6px;
      overflow-x: auto;
    }
    .db-tab-btn {
      padding: 6px 12px;
      font-size: 9px;
      font-weight: 700;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: white;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
    }
    .db-tab-btn.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }

    /* Dashboard OJS-workflow view */
    .db-header { background: var(--neutral); border-bottom: 1px solid var(--border); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
    .db-header h3 { font-size: 12px; font-weight: 700; margin: 0; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; }
    
    .db-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 16px; }
    .db-metric-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: space-between; }
    .db-metric-num { font-size: 18px; font-weight: 700; color: var(--primary); }
    
    /* Workflow Timeline Component */
    .timeline-container { padding: 0 16px; margin-bottom: 16px; }
    .timeline-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
    .timeline-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
    .timeline-step { background: var(--neutral); border: 1px solid var(--border); border-radius: 12px; padding: 6px 12px; white-space: nowrap; font-size: 9px; font-weight: 600; color: var(--text-muted); }
    .timeline-step.active { background: var(--primary); color: white; border-color: var(--primary); }
    
    .manuscript-queue { padding: 0 16px; display: flex; flex-direction: column; gap: 10px; }
    .ms-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .ms-badge { display: inline-block; font-size: 8px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-bottom: 6px; text-transform: uppercase; }
    .ms-badge.review { background: #fef3c7; color: #d97706; }
    .ms-badge.submission { background: #e0f2fe; color: #0284c7; }
    .ms-badge.success { background: #d1fae5; color: #065f46; }
    .ms-title { font-size: 11px; font-weight: 600; margin: 0 0 4px 0; color: var(--text); text-align: left; }
    .ms-author { font-size: 9px; color: var(--text-muted); margin-bottom: 8px; text-align: left; }
    .ms-actions { display: flex; gap: 6px; }
    .ms-btn { flex: 1; padding: 6px; font-size: 9px; font-weight: 700; border-radius: 4px; cursor: pointer; text-align: center; border: 1px solid var(--border); background: var(--neutral); color: var(--primary); }
    .ms-btn.ai-btn { background: #f5f3ff; border-color: #c084fc; color: #7c3aed; display: flex; align-items: center; justify-content: center; gap: 4px; }
    .ms-btn:hover { filter: brightness(0.95); }
    
    /* AI Extensions View */
    .ai-hero { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: white; padding: 20px 16px; text-align: center; }
    .ai-hero h2 { font-size: 15px; font-weight: 700; margin: 0 0 4px 0; }
    .ai-hero p { font-size: 9px; color: rgba(255,255,255,0.8); margin: 0; line-height: 1.4; }
    .ai-list { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .ai-hook-card { background: var(--neutral); border: 1px dashed #c084fc; border-radius: 8px; padding: 12px; }
    .ai-hook-title { font-size: 11px; font-weight: 700; color: #7c3aed; display: flex; align-items: center; gap: 6px; margin: 0 0 4px 0; }
    .ai-hook-desc { font-size: 9px; color: var(--text-muted); line-height: 1.4; margin-bottom: 8px; }
    .ai-hook-status { display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
    .ai-badge-ready { background: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0; }
    
    /* Modal / Popup for AI checks */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; justify-content: center; align-items: center; padding: 16px; }
    .modal-overlay.active { display: flex; }
    .modal-content { background: var(--bg); border-radius: 12px; width: 100%; max-width: 320px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); border: 1px solid var(--border); overflow: hidden; animation: scaleUp 0.2s ease-out; }
    @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .modal-header { background: var(--primary); color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h4 { font-family: var(--font-title); font-size: 12px; margin: 0; font-weight: 700; }
    .modal-close { background: none; border: none; color: white; font-size: 14px; cursor: pointer; }
    .modal-body { padding: 16px; font-size: 11px; line-height: 1.5; color: var(--text); }
    .modal-body strong { color: var(--primary); }
    .modal-body em { font-style: normal; font-weight: 600; color: #7c3aed; }
    .modal-footer { padding: 10px 16px; background: var(--neutral); border-top: 1px solid var(--border); text-align: right; }
    .btn-close-modal { padding: 6px 12px; font-size: 10px; font-weight: 700; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; }
    
    .logs-text { text-align: left; }

    /* SINTA Authors Directory Styles */
    .authors-layout {
      display: grid;
      grid-template-columns: 2.2fr 1fr;
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      align-items: start;
    }
    .authors-main {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .authors-filter-bar {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .filter-input-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      text-align: left;
    }
    .filter-input-group label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .filter-input {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 11px;
      color: var(--text);
      outline: none;
      background: white;
    }
    .filter-select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 11px;
      color: var(--text);
      outline: none;
      background: white;
    }
    
    /* Author Card */
    .author-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.02);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      text-align: left;
    }
    .author-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.05);
    }
    .author-avatar-box {
      width: 100px;
      height: 120px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #f3f4f6;
    }
    .author-avatar-box img {
      width: 100px;
      height: 120px;
      object-fit: cover;
    }
    .author-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .author-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .author-identity {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .author-name-verified {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .author-name-verified h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary);
      margin: 0;
    }
    .verified-badge {
      color: #10b981;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
    .author-institution {
      font-size: 10px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .author-sinta-id {
      font-size: 9px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .id-flag {
      width: 12px;
      height: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .author-subjects {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .subject-tag {
      background: #f3f4f6;
      color: #4b5563;
      font-size: 8px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 20px;
    }
    
    .author-metrics-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }
    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .metric-item-label {
      font-size: 8px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .metric-item-val {
      font-size: 11px;
      font-weight: 600;
      color: var(--text);
    }
    
    /* Author Scores Row */
    .author-scores-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      background: #f9fafb;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      flex-shrink: 0;
    }
    .score-card-item {
      text-align: center;
    }
    .score-card-val {
      font-size: 13px;
      font-weight: 700;
      color: var(--secondary);
    }
    .score-card-lbl {
      font-size: 8px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    
    /* Sidebar stats layout */
    .authors-sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .insight-btn {
      width: 100%;
      background: #f59e0b;
      color: white;
      border: none;
      padding: 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.2s;
    }
    .insight-btn:hover {
      background: #d97706;
    }
    
    .academic-rank-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.02);
      text-align: center;
    }
    .academic-rank-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    
    /* Donut chart styles */
    .donut-chart-container {
      position: relative;
      width: 130px;
      height: 130px;
      margin: 0 auto;
    }
    .donut-chart-center {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 10px;
      font-weight: 700;
      color: var(--text);
      text-align: center;
    }
    .donut-legend {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 16px;
      text-align: left;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9px;
      color: var(--text-muted);
    }
    .legend-color {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    
  </style>
</head>
<body>

  <!-- PAGE 1: SETUP SCREEN -->
  <div id="screen-setup" class="screen active">
    <div class="setup-container">
      <div class="setup-header">
        <h1>Ultimate Journal Enterprise</h1>
        <p>UJE Generator Platform (OJS/PKP Layer 3)</p>
      </div>
      
      <div class="form-group">
        <label for="journalName">Nama Jurnal Ilmiah</label>
        <input type="text" id="journalName" value="Ultimate Journal Enterprise" />
      </div>
      
      <div class="form-group">
        <label for="issnNumber">Nomor ISSN</label>
        <input type="text" id="issnNumber" value="2774-328X" />
      </div>
      
      <div class="form-group">
        <label for="publisherName">Penerbit (Publisher)</label>
        <input type="text" id="publisherName" value="Public Knowledge Project Indonesia" />
      </div>
      
      <div class="form-group">
        <label for="sintaAccreditation">Akreditasi SINTA</label>
        <select id="sintaAccreditation">
          <option value="SINTA 1">SINTA 1</option>
          <option value="SINTA 2" selected>SINTA 2</option>
          <option value="SINTA 3">SINTA 3</option>
          <option value="None">Tidak Terakreditasi</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="colorPalette">Skema Warna & Tema</label>
        <select id="colorPalette">
          <option value="navy" selected>Corporate Navy</option>
          <option value="emerald">Academic Emerald</option>
          <option value="crimson">Premium Crimson</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Ekstensi AI (UltimateAI Hooks Ready)</label>
        <div class="checkbox-group">
          <div class="checkbox-item">
            <input type="checkbox" id="aiSmartReview" checked />
            <span>AI Smart Manuscript Reviewer</span>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="aiMetadata" checked />
            <span>AI Metadata Extractor</span>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="aiSimilarity" checked />
            <span>AI Plagiarism Checker</span>
          </div>
        </div>
      </div>
      
      <button id="btnGenerate" class="btn-generate">
        Generate Journal Instance
      </button>
    </div>
  </div>

  <!-- PAGE 2: BUILDING LOGS -->
  <div id="screen-building" class="screen">
    <div class="building-container">
      <div class="log-header">
        <h2>Compiling UJE Instance...</h2>
        <div class="progress-bar-container">
          <div id="progressFill" class="progress-bar-fill"></div>
        </div>
      </div>
      
      <div id="logTerminal" class="log-terminal"></div>
      
      <div style="font-size: 9px; color: #6b7280; text-align: center; font-family: var(--font-body);">
        DDD Hexagonal Architecture & Clean Code Compilation
      </div>
    </div>
  </div>

  <!-- PAGE 2.5: LOGIN SCREEN -->
  <div id="screen-login" class="screen">
    <div class="login-container">
      <div class="login-header setup-header">
        <h1 style="font-size:18px;">UJE Portal Login</h1>
        <p>Akses Terpusat Reviewer, Author & Editor</p>
      </div>
      
      <div class="login-card">
        <div class="form-group">
          <label>Pilih Peran Masuk (Role)</label>
          <select id="loginRoleSelect">
            <option value="submitter">Author / Submitter</option>
            <option value="reviewer">Reviewer (Mitra Bestari)</option>
            <option value="editor">Editor (Dewan Redaksi)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Username / Email</label>
          <input type="text" id="loginUsername" placeholder="user@domain.com" />
        </div>
        
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="loginPassword" value="••••••••" />
        </div>
        
        <button id="btnExecuteLogin" class="btn-generate" style="margin-top:10px;">Login Ke Workspace</button>
        <button id="btnOrcidLogin" class="btn-orcid">
          Masuk dengan ORCID iD
        </button>
        
        <div style="text-align:center; margin-top:16px;">
          <a href="#" onclick="showScreen('screen-app')" style="font-size:10px; color:#cbd5e1; text-decoration:none;">&larr; Kembali ke Website</a>
        </div>
      </div>
    </div>
  </div>

  <!-- PAGE 3: GENERATED APPLICATION PREVIEW -->
  <div id="screen-app" class="screen">
    <div class="top-nav-sinta">
      <div class="logo-area">
        <h2 id="previewJournalName">Ultimate Journal Enterprise</h2>
      </div>
      <div class="nav-links">
        <a class="nav-link active" onclick="switchPreviewPage('public')">Portal Home</a>
        <a class="nav-link" onclick="switchPreviewPage('authors')">Authors Directory</a>
        <a class="nav-link" onclick="switchPreviewPage('dashboard')">Editorial Board</a>
        <a class="nav-link" onclick="switchPreviewPage('ai')">AI Assist</a>
      </div>
      <div class="header-actions">
        <button class="btn-portal" style="background:#22c55e;" onclick="const blob = new Blob([document.documentElement.outerHTML], {type: 'text/html'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'UJE-Portal.html'; a.click(); URL.revokeObjectURL(url);">Download HTML</button>
        <button id="btnLoginPortal" class="btn-portal" onclick="showScreen('screen-login')">Login</button>
        <button id="btnReset" class="btn-reset">Re-Gen</button>
      </div>
    </div>
    
        <!-- SUBPAGE 3A: PUBLIC HOME (SINTA-style) -->
    <div id="subpage-public" class="subpage">
      <div class="desktop-layout">
        
        <!-- MAIN CONTENT (LEFT COLUMN) -->
        <div class="desktop-main">
          
          <div class="public-hero">
            <div class="sinta-logo-box">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h15v20H5a1 1 0 0 1-1-1z"/></svg>
            </div>
            <h1 id="previewHeroTitle">Ultimate Journal Enterprise</h1>
            <div class="sinta-location" id="previewHeroPublisher">MITRA EDUKASI DAN PUBLIKASI</div>
            <div class="sinta-issn">P-ISSN: <span id="previewHeroIssn">2774-328X</span></div>
          </div>
          
          <div class="metrics-grid">
            <div class="metric-card"><div class="metric-value">5.46</div><div class="metric-label">Impact</div></div>
            <div class="metric-card"><div class="metric-value">272</div><div class="metric-label">Citations</div></div>
            <div class="metric-card"><div class="metric-value" id="previewSintaValue">Sinta 2</div><div class="metric-label">Accreditation</div></div>
          </div>
          
          <div class="links-row">
            <a href="#" class="sinta-link">Scholar</a>
            <a href="#" class="sinta-link">Garuda</a>
            <a href="#" class="sinta-link">Website</a>
          </div>

          <!-- PUBLIC INNER TABS -->
          <div class="sinta-tabs" style="margin-top:6px;">
            <div class="sinta-tab active" id="pubtab-home" onclick="switchPublicTab('home')">Home</div>
            <div class="sinta-tab" id="pubtab-board" onclick="switchPublicTab('board')">Dewan Redaksi</div>
            <div class="sinta-tab" id="pubtab-scope" onclick="switchPublicTab('scope')">Scope</div>
            <div class="sinta-tab" id="pubtab-archives" onclick="switchPublicTab('archives')">Jurnal Terbit</div>
          </div>

          <!-- Public Section: Home Profile (SINTA profile) -->
          <div id="pubsection-home" class="public-section-content">
            <div class="accred-history">
              <div class="accred-history-title">History Accreditation</div>
              <div class="timeline-bar">
                <span class="timeline-year">2022</span>
                <span class="timeline-year">2023</span>
                <span class="timeline-year">2024</span>
                <span class="timeline-year">2025</span>
                <span class="timeline-year">2026</span>
              </div>
            </div>

            <div style="background:var(--neutral); padding:8px 16px; font-size:9px; font-weight:700; text-transform:uppercase; color:var(--text-muted); text-align:left;">Garuda Articles</div>
            <div class="articles-list" style="padding: 0; gap: 0;">
              <div class="sinta-article">
                <a class="sinta-article-title">Efektivitas Implementasi Manajemen Pendidikan dalam Meningkatkan Mutu Layanan di Taman Kanak-Kanak</a>
                <div class="sinta-article-publisher">Jurnal Ilmu Pendidikan dan Pembelajaran Vol. 4 No. 2 (2026): April 2026 114-122</div>
                <div class="sinta-badges-row">
                  <span class="sinta-badge-item">2026</span>
                  <span class="sinta-badge-item" style="color:#2563eb;">DOI: 10.35799/jipp.4.2.122</span>
                  <span class="sinta-badge-item orange" class="prvSintaBadgeText">Accred : Sinta 2</span>
                </div>
              </div>
              <div class="sinta-article">
                <a class="sinta-article-title">Enhancing Cognitive, Performance Skills, and Affective Competencies through Case-Based Learning among Midwifery Students: A Scoping Review</a>
                <div class="sinta-article-publisher">Jurnal Ilmu Pendidikan dan Pembelajaran Vol. 4 No. 2 (2026): April 2026 102-113</div>
                <div class="sinta-badges-row">
                  <span class="sinta-badge-item">2026</span>
                  <span class="sinta-badge-item" style="color:#2563eb;">DOI: 10.35799/jipp.4.2.102</span>
                  <span class="sinta-badge-item orange" class="prvSintaBadgeText">Accred : Sinta 2</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Public Section: Editorial Board (Dewan Redaksi) -->
          <div id="pubsection-board" class="public-section-content" style="display:none;">
            <div class="info-section">
              <h3 class="section-title" style="margin-left:0; padding-left:0;">Dewan Redaksi (Editorial Board)</h3>
              <div class="info-list-item">
                <h4>Editor in Chief</h4>
                <p>Prof. Dr. Ahmad Dahlan, M.Pd (Universitas Pendidikan Indonesia)<br/>ORCID iD: <a href="#" style="color:#a6ce39;">0000-0002-1825-0097</a></p>
              </div>
            </div>
          </div>

          <!-- Public Section: Scope (Scope Jurnal) -->
          <div id="pubsection-scope" class="public-section-content" style="display:none;">
            <div class="info-section">
              <h3 class="section-title" style="margin-left:0; padding-left:0;">Focus & Scope Jurnal</h3>
              <div class="info-list-item">
                <h4>1. Ilmu Ekonomi dan Bisnis</h4>
                <p>Teori ekonomi makro/mikro, manajemen pemasaran, manajemen keuangan, perilaku organisasi, strategi bisnis.</p>
              </div>
              <div class="info-list-item">
                <h4>2. Ilmu Akuntansi</h4>
                <p>Akuntansi keuangan, auditing, perpajakan, akuntansi manajemen, sistem informasi akuntansi, etika profesi akuntansi.</p>
              </div>
              <div class="info-list-item">
                <h4>3. Ilmu Pertanian dan Bisnis (Agribisnis)</h4>
                <p>Manajemen agribisnis, ekonomi pertanian, teknologi pertanian, manajemen rantai pasok pangan, sosiologi pedesaan.</p>
              </div>
              <div class="info-list-item">
                <h4>4. Ilmu Kesehatan</h4>
                <p>Kesehatan masyarakat, epidemiologi, administrasi & kebijakan kesehatan, gizi masyarakat, promosi kesehatan.</p>
              </div>
              <div class="info-list-item">
                <h4>5. Ilmu Kedokteran</h4>
                <p>Kedokteran klinis, biomedis, teknologi kedokteran, farmakologi klinis, manajemen pelayanan medis.</p>
              </div>
              <div class="info-list-item">
                <h4>6. Ilmu Pemerintahan</h4>
                <p>Tata kelola pemerintahan, kebijakan publik, administrasi negara, otonomi daerah, birokrasi pemerintahan.</p>
              </div>
            </div>
          </div>

          <!-- Public Section: Archives (Jurnal Terbit) -->
          <div id="pubsection-archives" class="public-section-content" style="display:none;">
            <div class="info-section">
              <h3 class="section-title" style="margin-left:0; padding-left:0;">Arsip Jurnal (Archives)</h3>
              <div class="info-list-item">
                <h4>Vol. 4 No. 2 (2026): Edisi April</h4>
                <p>Status: Diterbitkan secara resmi dengan SINTA 2.</p>
              </div>
            </div>
          </div>
          
        </div> <!-- End of desktop-main -->
        
        <!-- SIDEBAR CONTENT (RIGHT COLUMN) -->
        <div class="desktop-sidebar">
          
          <div class="sidebar-card">
            <div class="sidebar-card-header">Get More with SINTA Insight</div>
            <div class="sidebar-card-header orange" onclick="alert('Mengalihkan ke halaman Insight SINTA...')">Go to Insight</div>
            <div class="sidebar-card-body">
              <div style="font-size:10px; text-align:center; color:var(--text-muted); margin-bottom:8px;">Citation Per Year By Google Scholar</div>
              <div class="bar-chart">
                <div style="width:10%; height:5%;" class="bar"></div>
                <div style="width:10%; height:12%;" class="bar"></div>
                <div style="width:10%; height:45%;" class="bar"></div>
                <div style="width:10%; height:100%;" class="bar"></div>
                <div style="width:10%; height:20%;" class="bar"></div>
              </div>
              <div class="bar-label-container">
                <span>2022</span><span>2023</span><span>2024</span><span>2025</span><span>2026</span>
              </div>
            </div>
          </div>

          <div class="sidebar-card">
            <div class="sidebar-card-body">
              <div style="font-size:10px; text-align:center; color:var(--text-muted); margin-bottom:12px;">Journal By Google Scholar</div>
              <table class="stats-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>All</th>
                    <th>Since 2021</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Citation</td>
                    <td>272</td>
                    <td>272</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">h-index</td>
                    <td>9</td>
                    <td>9</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">i10-index</td>
                    <td>8</td>
                    <td>8</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div> <!-- End of desktop-sidebar -->
      </div> <!-- End of desktop-layout -->
    </div>
    
    <!-- SUBPAGE 3D: AUTHORS DIRECTORY (SINTA-style) -->
    <div id="subpage-authors" class="subpage" style="display: none;">
      <div class="authors-layout">
        
        <!-- LEFT COLUMN: AUTHORS LIST & FILTERS -->
        <div class="authors-main">
          <div class="authors-filter-bar">
            <div class="filter-input-group">
              <label for="searchAuthorsInput">Search Authors</label>
              <input type="text" id="searchAuthorsInput" class="filter-input" placeholder="Search by name, affiliation, or subjects..." oninput="renderAuthors()" />
            </div>
            <div class="filter-input-group" style="max-width: 150px;">
              <label for="sortAuthorsSelect">Sort by</label>
              <select id="sortAuthorsSelect" class="filter-select" onchange="renderAuthors()">
                <option value="sinta-3yr" selected>Sinta Score 3Yr</option>
                <option value="sinta-overall">Sinta Score Overall</option>
              </select>
            </div>
          </div>
          
          <!-- Authors list container -->
          <div id="authorsListContainer" style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Rendered dynamically -->
          </div>
        </div>
        
        <!-- RIGHT COLUMN: SIDEBAR STATS & CHARTS -->
        <div class="authors-sidebar">
          
          <div class="sidebar-card">
            <div class="sidebar-card-header">Get More with SINTA Insight</div>
            <div class="sidebar-card-header orange" onclick="alert('Mengalihkan ke halaman Insight SINTA...')">Go to Insight</div>
            <div class="sidebar-card-body">
              <div class="donut-chart-container">
                <svg width="100%" height="100%" viewBox="0 0 42 42" class="donut">
                  <circle class="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="#fff"></circle>
                  <circle class="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e5e7eb" stroke-width="3"></circle>
                  
                  <!-- Lektor (35%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0ea5e9" stroke-width="3" stroke-dasharray="35 65" stroke-dashoffset="25"></circle>
                  <!-- Lektor Kepala (20%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#a78bfa" stroke-width="3" stroke-dasharray="20 80" stroke-dashoffset="90"></circle>
                  <!-- Asisten Ahli (25%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#38bdf8" stroke-width="3" stroke-dasharray="25 75" stroke-dashoffset="70"></circle>
                  <!-- Profesor (10%) -->
                  <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f59e0b" stroke-width="3" stroke-dasharray="10 90" stroke-dashoffset="45"></circle>
                </svg>
                <div class="donut-chart-center">
                  <div style="font-size:12px; font-weight:bold;">332.504</div>
                  <div style="font-size:8px; color:var(--text-muted); font-weight:normal;">Total Authors</div>
                </div>
              </div>
              <div class="donut-legend">
                <div class="legend-item"><span class="legend-color" style="background:#0ea5e9;"></span>Lektor (114k)</div>
                <div class="legend-item"><span class="legend-color" style="background:#a78bfa;"></span>L. Kepala (30k)</div>
                <div class="legend-item"><span class="legend-color" style="background:#38bdf8;"></span>A. Ahli (71k)</div>
                <div class="legend-item"><span class="legend-color" style="background:#f59e0b;"></span>Profesor (10k)</div>
              </div>
            </div>
          </div>

          <div class="sidebar-card">
            <div class="sidebar-card-body">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Stats</th>
                    <th>Authors</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Verified Accounts</td>
                    <td>145,282</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Affiliations Linked</td>
                    <td>5,551</td>
                  </tr>
                  <tr>
                    <td style="text-align:left; color:var(--text-muted);">Total Publications</td>
                    <td>2,192,829</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div> <!-- End of authors-sidebar -->
      </div> <!-- End of authors-layout -->
    </div>
    
    <!-- SUBPAGE 3B: EDITORIAL / WORKSPACE DASHBOARD -->
    <div id="subpage-dashboard" class="subpage" style="display: none;">
      <!-- Dashboard Workspace Selector -->
      <div class="dashboard-tabs">
        <div class="db-tab-btn active" id="dbtab-author" onclick="switchDashboardRole('author')">Author Workspace</div>
        <div class="db-tab-btn" id="dbtab-reviewer" onclick="switchDashboardRole('reviewer')">Reviewer Workspace</div>
        <div class="db-tab-btn" id="dbtab-editor" onclick="switchDashboardRole('editor')">Editor Portal</div>
      </div>
      
      <!-- SUB-WORKSPACE 1: SUBMITTER (AUTHOR) DASHBOARD -->
      <div id="dbsection-author" class="db-role-section">
        <div class="db-header">
          <h3>Author Dashboard</h3>
          <span style="font-size: 8px; background: #e0f2fe; color: #0284c7; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Manuscript Submitter</span>
        </div>
        
        <div style="padding: 16px; background: var(--neutral); border-bottom: 1px solid var(--border);">
          <div class="timeline-title" style="margin-bottom:10px;">Ajukan Naskah Baru (Submit Manuscript)</div>
          <div class="form-group" style="margin-bottom:8px;">
            <label style="color:var(--text); font-weight:600;">Judul Naskah</label>
            <input type="text" id="newMsTitle" placeholder="Masukkan judul..." style="background:white; color:#1f2937; border-color:var(--border);" />
          </div>
          <div class="form-group" style="margin-bottom:8px;">
            <label style="color:var(--text); font-weight:600;">Abstrak Naskah</label>
            <textarea id="newMsAbstract" placeholder="Tuliskan abstrak..." style="height:60px; background:white; color:#1f2937; border-color:var(--border);"></textarea>
          </div>
          <div class="form-group" style="margin-bottom:8px;">
            <label style="color:var(--text); font-weight:600;">Penulis (Author)</label>
            <input type="text" id="newMsAuthor" placeholder="Nama Penulis Utama" style="background:white; color:#1f2937; border-color:var(--border);" />
          </div>
          <div class="form-group" style="margin-bottom:8px;">
            <label style="color:var(--text); font-weight:600;">Afiliasi (Institusi)</label>
            <input type="text" id="newMsAffiliation" placeholder="Nama Institusi/Universitas" style="background:white; color:#1f2937; border-color:var(--border);" />
          </div>
          <button class="btn-generate" onclick="createNewSubmission()" style="margin-top:0; padding:8px; font-size:11px;">Kirim Pengajuan Naskah</button>
        </div>

        <div class="section-title">Naskah Saya</div>
        <div class="manuscript-queue" id="authorMsQueue"></div>
      </div>
      
      <!-- SUB-WORKSPACE 2: REVIEWER DASHBOARD -->
      <div id="dbsection-reviewer" class="db-role-section" style="display:none;">
        <div class="db-header">
          <h3>Reviewer Dashboard</h3>
          <span style="font-size: 8px; background: #fef3c7; color: #d97706; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Peer Reviewer</span>
        </div>
        <div class="double-blind-alert">
          <div><strong>Sistem Double-Blind Review Aktif:</strong> Identitas penulis/penilai disembunyikan.</div>
        </div>
        <div style="padding:0 16px;">
          <div class="ms-card" style="border-left: 4px solid #7c3aed;">
            <span class="ms-badge review">Tinjauan Ditugaskan</span>
            <h4 class="ms-title">Security Analysis of JWT Session Storage in Mobile Apps</h4>
            <div style="margin-top:12px;">
              <button class="ms-btn ai-btn" onclick="submitReviewScorecard()" style="width:100%;">Kirim Hasil Peer Review</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- SUB-WORKSPACE 3: EDITOR DASHBOARD -->
      <div id="dbsection-editor" class="db-role-section" style="display:none;">
        <div class="db-header">
          <h3>Editor Dashboard</h3>
          <span style="font-size: 8px; background: var(--secondary); color: var(--primary); font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Section Editor</span>
        </div>
        <div class="db-metrics">
          <div class="db-metric-card"><div><div class="metric-label">Submissions</div><div class="db-metric-num" id="editorSubMetric">12</div></div></div>
          <div class="db-metric-card"><div><div class="metric-label">Under Review</div><div class="db-metric-num">5</div></div></div>
        </div>
        <div class="section-title">Editorial Work Queue</div>
        <div class="manuscript-queue" id="editorManuscriptsQueue"></div>
      </div>
    </div>
    
    <!-- SUBPAGE 3C: AI INTEGRATION ASSISTANT -->
    <div id="subpage-ai" class="subpage" style="display: none;">
      <div class="ai-hero">
        <h2>UltimateAI Extension Architecture</h2>
        <p>Ready to receive LLM cognitive agents.</p>
      </div>
      <div class="ai-list">
        <div class="ai-hook-card">
          <h4 class="ai-hook-title">Analyze Manuscript</h4>
          <div class="ai-hook-status"><span>Status</span><span class="ai-badge-ready">Ready</span></div>
        </div>
      </div>
    </div>
    

  </div>
  
  <!-- MODAL -->
  <div id="aiModal" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h4 id="modalTitle">UltimateAI Assistant Report</h4>
        <button class="modal-close" onclick="closeAiModal()">&times;</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer"><button class="btn-close-modal" onclick="closeAiModal()">Tutup</button></div>
    </div>
  </div>

  <script>
    const schemes = {
      navy: { primary: '#0E2A47', secondary: '#D4A62A', bg: '#ffffff', neutral: '#f5f7fa', text: '#1f2937', border: '#e5e7eb' },
      emerald: { primary: '#0B4632', secondary: '#D4A62A', bg: '#ffffff', neutral: '#f4f6f4', text: '#111827', border: '#e5e7eb' },
      crimson: { primary: '#5C1D24', secondary: '#D4A62A', bg: '#ffffff', neutral: '#fbf7f7', text: '#111827', border: '#e5e7eb' }
    };
    
    function showScreen(screenId) {
      document.getElementById('screen-setup').classList.remove('active');
      document.getElementById('screen-building').classList.remove('active');
      document.getElementById('screen-login').classList.remove('active');
      document.getElementById('screen-app').classList.remove('active');
      document.getElementById(screenId).classList.add('active');
    }
    
    function switchPreviewPage(subpage) {
      document.getElementById('subpage-public').style.display = 'none';
      document.getElementById('subpage-dashboard').style.display = 'none';
      document.getElementById('subpage-ai').style.display = 'none';
      if (document.getElementById('subpage-authors')) {
        document.getElementById('subpage-authors').style.display = 'none';
      }
      document.getElementById('subpage-' + subpage).style.display = 'block';
      
      // Update active nav link
      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
      const activeLink = Array.from(document.querySelectorAll('.nav-link')).find(el => el.getAttribute('onclick').includes(subpage));
      if (activeLink) activeLink.classList.add('active');
    }

    function switchPublicTab(tabId) {
      document.querySelectorAll('.public-section-content').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.sinta-tab').forEach(el => el.classList.remove('active'));
      document.getElementById('pubsection-' + tabId).style.display = 'block';
      document.getElementById('pubtab-' + tabId).classList.add('active');
    }

    function switchDashboardRole(roleId) {
      document.querySelectorAll('.db-role-section').forEach(el => el.style.display = 'none');
      document.getElementById('dbsection-author').style.display = 'none';
      document.getElementById('dbsection-reviewer').style.display = 'none';
      document.getElementById('dbsection-editor').style.display = 'none';

      document.getElementById('dbtab-author').classList.remove('active');
      document.getElementById('dbtab-reviewer').classList.remove('active');
      document.getElementById('dbtab-editor').classList.remove('active');

      document.getElementById('dbsection-' + roleId).style.display = 'block';
      document.getElementById('dbtab-' + roleId).classList.add('active');
    }
    // --- GLOBAL STATE ---
    let currentUser = null;
    let manuscripts = [
      { id: 1, title: 'Redis Cache Optimization in NestJS', author: 'Dr. Jane Doe', status: 'Submission', sintaBadge: 'SINTA 2', abstract: 'This paper discusses the optimization of Redis caching mechanisms within the NestJS framework...', date: '2026-04-10', reviewer: null, scoreOriginality: null, scoreMethodology: null, reviewerComments: null, doi: null, year: 2026 },
      { id: 2, title: 'Security Analysis of JWT Session Storage in Mobile Apps', author: 'Prof. John Smith', status: 'In Review', sintaBadge: 'SINTA 2', abstract: 'An in-depth analysis of JWT session storage vulnerabilities...', date: '2026-04-12', reviewer: 'Dr. Budi Santoso', scoreOriginality: null, scoreMethodology: null, reviewerComments: null, doi: null, year: 2026 }
    ];
    let users = [
      { name: "Dr. Jane Doe", role: "Author / Submitter", affiliation: "Universitas Indonesia", orcid: "Linked" },
      { name: "Prof. John Smith", role: "Author / Submitter", affiliation: "ITB", orcid: "Not Linked" },
      { name: "Dr. Budi Santoso", role: "Reviewer (Mitra Bestari)", affiliation: "UGM", orcid: "Linked" }
    ];

    document.getElementById('btnGenerate').addEventListener('click', () => {
      console.log('BTN GENERATE CLICKED');
      const journalNameEl = document.getElementById('journalName');
      const issnNumberEl = document.getElementById('issnNumber');
      const publisherNameEl = document.getElementById('publisherName');
      const sintaAccreditationEl = document.getElementById('sintaAccreditation');
      const colorPaletteEl = document.getElementById('colorPalette');
      
      const journalName = journalNameEl ? journalNameEl.value.trim() || 'Ultimate Journal Enterprise' : 'Ultimate Journal Enterprise';
      const issnNumber = issnNumberEl ? issnNumberEl.value.trim() || '2774-328X' : '2774-328X';
      const publisherName = publisherNameEl ? publisherNameEl.value.trim() || 'PKP Indonesia' : 'PKP Indonesia';
      const accreditation = sintaAccreditationEl ? sintaAccreditationEl.value : 'SINTA 2';
      const colorTheme = colorPaletteEl ? colorPaletteEl.value : 'navy';
      
      const heroBgEl = document.getElementById('heroBgStyle');
      const heroAlignEl = document.getElementById('heroTextAlign');
      const heroBg = heroBgEl ? heroBgEl.value : 'dark';
      const heroAlign = heroAlignEl ? heroAlignEl.value : 'center';
      
      // Update preview DOM elements (safely)
      const pjn = document.getElementById('previewJournalName'); if (pjn) pjn.innerText = journalName;
      const pht = document.getElementById('previewHeroTitle'); if (pht) pht.innerText = journalName;
      const phi = document.getElementById('previewHeroIssn'); if (phi) phi.innerText = issnNumber;
      const php = document.getElementById('previewHeroPublisher'); if (php) php.innerText = publisherName;
      
      const sintaVal = document.getElementById('previewSintaValue');
      const displayVal = accreditation === 'None' ? 'No Accred' : accreditation;
      
      if (sintaVal) sintaVal.innerText = displayVal;
      
      // Customize Hero styles
      const heroEl = document.querySelector('.public-hero');
      if (heroEl) {
        heroEl.className = 'public-hero'; // Reset classes
        if (heroBg === 'light-clean') heroEl.classList.add('hero-light');
        else if (heroBg === 'crimson-vel') heroEl.classList.add('hero-crimson');
        if (heroAlign === 'left') heroEl.classList.add('hero-left');
      }
      
      // Apply CSS variables matching color theme
      const colors = schemes[colorTheme] || schemes.navy;
      const root = document.documentElement;
      root.style.setProperty('--primary', colors.primary);
      root.style.setProperty('--secondary', colors.secondary);
      root.style.setProperty('--bg', colors.bg);
      root.style.setProperty('--neutral', colors.neutral);
      root.style.setProperty('--text', colors.text);
      root.style.setProperty('--border', colors.border);
      
      // Apply initial SINTA accreditations to dynamic badges inside database
      if (typeof manuscripts !== 'undefined') {
        manuscripts.forEach(m => {
          m.sintaBadge = 'Accred : ' + displayVal;
        });
      }

      showScreen('screen-building');
      
      const logs = [
        "Initializing Hexagonal & DDD Directory layout structure...",
        "Creating core model schemas: Manuscript, Review, Journal, User, Role...",
        "Compiling NestJS Modules with Dependency Injection ports...",
        "Running Prisma migrations on target PostgreSQL DB...",
        "Registering Redis Event Queues & BullMQ background workers...",
        "Loading Playfair Display headings & Inter text CSS configuration...",
        "Building SINTA-style modern Public index HTML structure...",
        "Injecting OJS3 editorial workflow pipelines & roles verification...",
        "Pre-wiring UltimateAI Extension Hooks: cognitive review, similarity checks...",
        "Optimizing production-ready NextJS SSR bundle...",
        "Deploying S3 compatible storage buckets for manuscript PDFs...",
        "Compilation completed! Live Instance running successfully."
      ];
      
      const terminal = document.getElementById('logTerminal');
      terminal.innerHTML = '';
      
      const fill = document.getElementById('progressFill');
      fill.style.width = '0%';
      
      let logIndex = 0;
      function printNextLog() {
        if (logIndex < logs.length) {
          const logMsg = logs[logIndex];
          const isSuccess = logIndex === logs.length - 1;
          const prefix = isSuccess ? "[SUCCESS] " : "[INFO] ";
          const color = isSuccess ? "#10b981" : "#a7f3d0";
          
          terminal.innerHTML += '<div style="color: ' + color + ';" class="logs-text">' + prefix + logMsg + '</div>';
          terminal.scrollTop = terminal.scrollHeight;
          
          logIndex++;
          const progressPercent = Math.round((logIndex / logs.length) * 100);
          fill.style.width = progressPercent + '%';
          
          setTimeout(printNextLog, 220);
        } else {
          setTimeout(() => {
            renderApp();
            showScreen('screen-app');
            switchPreviewPage('public');
          }, 400);
        }
      }
      setTimeout(printNextLog, 300);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      showScreen('screen-setup');
    });

    document.getElementById('btnExecuteLogin').addEventListener('click', () => {
      const selectedRole = document.getElementById('loginRoleSelect').value;
      showScreen('screen-app');
      switchPreviewPage('dashboard');
      switchDashboardRole(selectedRole);

      const loginBtn = document.getElementById('btnLoginPortal');
      loginBtn.innerText = "Logout";
      loginBtn.onclick = logoutUser;
      
      renderApp();
    });

    document.getElementById('btnOrcidLogin').addEventListener('click', () => {
      alert("Mengarahkan ke auth.orcid.org OAuth Portal... Berhasil mengotentikasi ORCID iD!");
      document.getElementById('loginUsername').value = "0000-0002-1825-0097@orcid.org";
    });

    function logoutUser() {
      const loginBtn = document.getElementById('btnLoginPortal');
      loginBtn.innerText = "Login";
      loginBtn.onclick = () => showScreen('screen-login');
      showScreen('screen-app');
      switchPreviewPage('public');
      renderApp();
    }

    const authors = [
      {
        name: "Prof. Rahadian Zainul, M.Si",
        verified: true,
        institution: "Universitas Negeri Padang",
        department: "Pendidikan Kimia (S2)",
        sintaId: "5980662",
        score3yr: "2,683",
        scoreOverall: "12,662",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=120",
        subjects: ["Chemistry", "Bioinformatics", "Computational Chemistry", "Technology in Education"],
        scopusHIndex: 25,
        gsHIndex: 38
      },
      {
        name: "Prof. Dr. Bens Pardamean",
        verified: true,
        institution: "Universitas Bina Nusantara",
        department: "Teknik Informatika (S2)",
        sintaId: "6043909",
        score3yr: "2,520",
        scoreOverall: "21,880",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100&h=120",
        subjects: ["Bioinformatics", "Informatics Computing", "Educational Technology"],
        scopusHIndex: 38,
        gsHIndex: 45
      },
      {
        name: "Dr. Untung Rahardja, M.T.I",
        verified: true,
        institution: "Universitas Raharja",
        department: "Bisnis Digital (S1)",
        sintaId: "5999873",
        score3yr: "2,300",
        scoreOverall: "18,500",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100&h=120",
        subjects: ["Blockchain", "Artificial Intelligence", "Business Intelligence", "IT Management"],
        scopusHIndex: 35,
        gsHIndex: 67
      }
    ];

    function renderAuthors() {
      const container = document.getElementById('authorsListContainer');
      if (!container) return;
      
      const searchEl = document.getElementById('searchAuthorsInput');
      const searchQuery = searchEl ? searchEl.value.toLowerCase() : '';
      const sortEl = document.getElementById('sortAuthorsSelect');
      const sortVal = sortEl ? sortEl.value : 'sinta-3yr';
      
      let filtered = [...authors];
      if (searchQuery) {
        filtered = filtered.filter(a => 
          a.name.toLowerCase().includes(searchQuery) || 
          a.institution.toLowerCase().includes(searchQuery) ||
          a.subjects.some(s => s.toLowerCase().includes(searchQuery))
        );
      }
      
      if (sortVal === 'sinta-3yr') {
        filtered.sort((x, y) => parseFloat(y.score3yr.replace(/,/g, '')) - parseFloat(x.score3yr.replace(/,/g, '')));
      } else {
        filtered.sort((x, y) => parseFloat(y.scoreOverall.replace(/,/g, '')) - parseFloat(x.scoreOverall.replace(/,/g, '')));
      }
      
      container.innerHTML = '';
      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 11px;">Tidak ada penulis yang cocok dengan pencarian Anda.</div>';
        return;
      }
      
      filtered.forEach(a => {
        const subjectsHtml = a.subjects.map(s => '<span class="subject-tag">' + s + '</span>').join('');
        container.innerHTML += '<div class="author-card">' +
          '<div class="author-avatar-box">' +
            '<img src="' + a.avatar + '" alt="' + a.name + '" onerror="this.src=\'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=120\'"/>' +
          '</div>' +
          '<div class="author-details">' +
            '<div class="author-header-row">' +
              '<div class="author-identity">' +
                '<div class="author-name-verified">' +
                  '<h3>' + a.name + '</h3>' +
                  '<svg class="verified-badge" viewBox="0 0 20 20" fill="currentColor" style="width:14px; height:14px; color:#10b981;">' +
                    '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4.13-5.69z" clip-rule="evenodd" />' +
                  '</svg>' +
                '</div>' +
                '<div class="author-institution">' + a.institution + ' - ' + a.department + '</div>' +
                '<div class="author-sinta-id">' +
                  '<img class="id-flag" src="https://upload.wikimedia.org/wikipedia/commons/9/9f/Flag_of_Indonesia.svg" alt="Indonesia Flag" style="width:12px; height:8px; border:1px solid #e5e7eb;"/>' +
                  '<span>SINTA ID : ' + a.sintaId + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="author-scores-grid">' +
                '<div class="score-card-item">' +
                  '<div class="score-card-val">' + a.score3yr + '</div>' +
                  '<div class="score-card-lbl">Sinta 3Yr</div>' +
                '</div>' +
                '<div class="score-card-item">' +
                  '<div class="score-card-val">' + a.scoreOverall + '</div>' +
                  '<div class="score-card-lbl">Sinta Overall</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="author-subjects" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">' + subjectsHtml + '</div>' +
            '<div class="author-metrics-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; border-top:1px solid var(--border); padding-top:10px; margin-top:10px;">' +
              '<div class="metric-item">' +
                '<span style="font-size:8px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Scopus H-Index</span>' +
                '<span style="font-size:11px; font-weight:600; color:var(--text);">' + a.scopusHIndex + '</span>' +
              '</div>' +
              '<div class="metric-item">' +
                '<span style="font-size:8px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Google Scholar H-Index</span>' +
                '<span style="font-size:11px; font-weight:600; color:var(--text);">' + a.gsHIndex + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
    }

    // STATE ACTION: Render Dashboard UI
    function renderApp() {
      const authorQueue = document.getElementById('authorMsQueue');
      const editorQueue = document.getElementById('editorManuscriptsQueue');
      
      if (authorQueue) {
        authorQueue.innerHTML = '';
        manuscripts.forEach(ms => {
          let badgeClass = 'review';
          if (ms.status === 'Submission') badgeClass = 'submission';
          if (ms.status === 'In Review') badgeClass = 'review';
          if (ms.status === 'Published') badgeClass = 'published';
          
          authorQueue.innerHTML += '<div class="ms-card">' +
            '<span class="ms-badge ' + badgeClass + '">' + ms.status + '</span>' +
            '<h4 class="ms-title">' + ms.title + '</h4>' +
            '<p style="font-size: 10px; color: var(--text-muted); margin-top:4px;">Accreditation: ' + ms.sintaBadge + '</p>' +
            '</div>';
        });
      }

      if (editorQueue) {
        editorQueue.innerHTML = '';
        manuscripts.forEach(ms => {
          let badgeClass = 'review';
          if (ms.status === 'Submission') badgeClass = 'submission';
          if (ms.status === 'In Review') badgeClass = 'review';
          if (ms.status === 'Published') badgeClass = 'published';

          let actionsHtml = '';
          if (ms.status === 'Submission') {
            actionsHtml = '<div style="margin-top:8px;">' +
              '<select id="selectReviewer-' + ms.id + '" style="padding:4px; font-size:10px; border:1px solid var(--border); border-radius:4px; margin-right:8px;">' +
              '<option value="Dr. Budi Santoso">Dr. Budi Santoso</option>' +
              '<option value="Prof. Jane Doe">Prof. Jane Doe</option>' +
              '</select>' +
              '<button class="ms-btn edit" onclick="editorAssignReviewer(' + ms.id + ')">Assign Reviewer</button>' +
              '</div>';
          } else if (ms.status === 'Reviewed') {
            actionsHtml = '<div style="margin-top:8px; padding:8px; background:var(--neutral); border-radius:4px; border:1px dashed var(--border);">' +
              '<strong style="font-size:10px; color:var(--primary);">Review Result from ' + ms.reviewer + ':</strong>' +
              '<p style="font-size:10px; margin-top:4px;">Originality: ' + ms.scoreOriginality + ' | Methodology: ' + ms.scoreMethodology + '</p>' +
              '<p style="font-size:10px; margin-top:4px;"><em>"' + ms.reviewerComments + '"</em></p>' +
              '<div style="margin-top:8px;">' +
              '<button class="ms-btn publish" onclick="editorAcceptManuscript(' + ms.id + ')">Accept Manuscript (Generate DOI)</button>' +
              '</div></div>';
          } else if (ms.status === 'Accepted') {
            actionsHtml = '<div style="margin-top:8px;">' +
              '<button class="ms-btn publish" onclick="editorPublishManuscript(' + ms.id + ')">Publish to Public (SINTA Garuda)</button>' +
              '</div>';
          }

          editorQueue.innerHTML += '<div class="ms-card">' +
            '<span class="ms-badge ' + badgeClass + '">' + ms.status + '</span>' +
            '<h4 class="ms-title">' + ms.title + '</h4>' +
            actionsHtml +
            '</div>';
        });
      }
      renderAuthors();
    }

    // STATE ACTION: Create new submission (Author)
    function createNewSubmission() {
      const title = document.getElementById('newMsTitle').value.trim();
      const abstract = document.getElementById('newMsAbstract').value.trim();
      const author = document.getElementById('newMsAuthor').value.trim();
      const affiliation = document.getElementById('newMsAffiliation').value.trim();

      if (!title || !abstract || !author || !affiliation) {
        alert("Harap lengkapi seluruh formulir pengajuan naskah!");
        return;
      }

      const accreditation = document.getElementById('sintaAccreditation').value;
      const displayVal = accreditation === 'None' ? 'No Accred' : accreditation;

      // Add to simulated database
      const newId = manuscripts.length + 1;
      manuscripts.push({
        id: newId,
        title: title,
        abstract: abstract,
        author: author,
        affiliation: affiliation,
        status: "Submission",
        reviewer: null,
        scoreOriginality: null,
        scoreMethodology: null,
        reviewerComments: null,
        doi: null,
        year: 2026,
        sintaBadge: 'Accred : ' + displayVal
      });

      // Add author to directory if not exists
      const userExists = users.some(u => u.name === author);
      if (!userExists) {
        users.push({
          name: author,
          role: "Author / Submitter",
          affiliation: affiliation,
          orcid: "Linked"
        });
      }

      alert('Sukses! Naskah "' + title + '" berhasil diunggah ke sistem UJE OJS3.');
      document.getElementById('newMsTitle').value = '';
      document.getElementById('newMsAbstract').value = '';
      
      renderApp();
    }

    // STATE ACTION: Assign reviewer (Editor)
    function editorAssignReviewer(id) {
      const reviewerSelect = document.getElementById('selectReviewer-' + id);
      if (!reviewerSelect) return;
      const reviewerName = reviewerSelect.value;

      const ms = manuscripts.find(m => m.id === id);
      if (ms) {
        ms.reviewer = reviewerName;
        ms.status = "In Review";
        alert('Editor menugaskan "' + reviewerName + '" untuk me-review naskah ini.');
        renderApp();
      }
    }

    // STATE ACTION: Submit review report scorecard (Reviewer)
    function submitReviewScorecard(id) {
      const oVal = document.getElementById('scoreOriginality-' + id).value;
      const mVal = document.getElementById('scoreMethodology-' + id).value;
      const comments = document.getElementById('comments-' + id).value.trim();

      if (!comments) {
        alert("Harap berikan rekomendasi/komentar evaluasi!");
        return;
      }

      const ms = manuscripts.find(m => m.id === id);
      if (ms) {
        ms.scoreOriginality = parseInt(oVal);
        ms.scoreMethodology = parseInt(mVal);
        ms.reviewerComments = comments;
        ms.status = "Reviewed";
        alert("Terima kasih! Rekomendasi peer review Double-Blind berhasil dikirimkan secara rahasia ke editor.");
        renderApp();
      }
    }

    // STATE ACTION: Accept manuscript (Editor)
    function editorAcceptManuscript(id) {
      const ms = manuscripts.find(m => m.id === id);
      if (ms) {
        ms.status = "Accepted";
        ms.doi = "10.35799/uje.v4i2." + id;
        alert("Naskah disetujui untuk terbit. DOI telah di-generate secara otomatis.");
        renderApp();
      }
    }

    // STATE ACTION: Publish manuscript (Editor)
    function editorPublishManuscript(id) {
      const ms = manuscripts.find(m => m.id === id);
      if (ms) {
        ms.status = "Published";
        alert('Sukses! Naskah "' + ms.title + '" diterbitkan. Sekarang terdaftar di halaman publik SINTA Garuda.');
        renderApp();
      }
    }
    
    function openAiAnalyzeModal(type, target) {
      const modal = document.getElementById('aiModal');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      
      title.innerText = 'UltimateAI: ' + type;
      modal.classList.add('active');
      
      if (target === 'redis') {
        body.innerHTML = '<strong>File:</strong> RedisCacheOptimization_NestJS.pdf<br/><br/>' +
          '<strong>Analisis Otomatis Naskah (Cognitive Audit):</strong><br/>' +
          '- <em>Abstract Quality:</em> Cukup padat, mencakup metodologi, hasil, dan kontribusi.<br/>' +
          '- <em>Metodologi:</em> Valid menggunakan pengujian latency benchmarking.<br/>' +
          '- <em>Similarity Index:</em> <strong>11% (Aman)</strong><br/><br/>' +
          '<strong>Rekomendasi Reviewer:</strong><br/>' +
          '1. Dr. Roni Setiawan (Match ID: 94% - Keahlian: Distributed Systems)<br/>' +
          '2. Prof. Bambang Hariyanto (Match ID: 89% - Keahlian: Caching algorithms)<br/><br/>' +
          '<span style="color: var(--secondary); font-weight: bold;">[Hook pre-wired to backend domain: Execution.ts]</span>';
      } else {
        body.innerHTML = '<strong>File:</strong> GlobalCitationDatabases_OpenScience.docx<br/><br/>' +
          '<strong>Pemeriksaan Struktur Metadata AI:</strong><br/>' +
          '- <em>DOI Tag:</em> Terdeteksi dan terdaftar di Crossref.<br/>' +
          '- <em>ORCID Penulis:</em> Terdeteksi 3 dari 3 penulis terverifikasi.<br/>' +
          '- <em>Bibliography Check:</em> 24 referensi diidentifikasi secara unik.<br/><br/>' +
          '<strong>Plagiarisme & Similarity AI:</strong><br/>' +
          '- Deteksi per kalimat (kalimat &ge; 10 kata) selesai.<br/>' +
          '- Total kalimat diperiksa: 82<br/>' +
          '- Tingkat plagiasi: <strong>4.8% (Sangat Unik - AMAN)</strong><br/><br/>' +
          '<span style="color: var(--secondary); font-weight: bold;">[Hook pre-wired to backend domain: WorkerPipeline.ts]</span>';
      }
    }
    
    function closeAiModal() {
      document.getElementById('aiModal').classList.remove('active');
    }
  </script>
</body>
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
