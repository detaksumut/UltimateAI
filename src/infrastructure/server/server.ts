import dotenv from 'dotenv';
dotenv.config();
console.log('[Server] Starting up with fresh cache v18...');

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

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
    
    // --- INTERCEPT IMAGE / VIDEO MODES ---
    if (activeMode === 'Image' || activeMode === 'Video') {
       sendEvent('progress', { step: 'Requirement', message: `Memproses permintaan ${activeMode}...` });
       
       let finalHtml = '';
       let imageUrl = attachedImage || '';

       // ─── VIDEO MODE: AI TALKING HEAD (VISION + HEYGEN) ───
       if (activeMode === 'Video' && attachedImage && process.env.HEYGEN_API_KEY) {
           sendEvent('progress', { step: 'Context', message: 'Vision AI sedang menganalisis gambar Anda...' });
           
           // 1. Analyze Image with Gemini Vision (Copywriting)
           let scriptText = "Halo, selamat datang di layanan kami."; // Fallback
           try {
               const base64Data = attachedImage.split(',')[1];
               const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY_1}`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                       contents: [{
                           parts: [
                               { text: "Buatkan naskah promosi super singkat (maksimal 15 kata, durasi 5 detik) berdasarkan teks/tokoh di gambar ini. Gunakan gaya bahasa profesional namun santai. Balas langsung dengan naskahnya saja tanpa tanda kutip." },
                               { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                           ]
                       }]
                   })
               });
               const geminiData = await geminiResponse.json();
               if (geminiData.candidates && geminiData.candidates[0]) {
                   scriptText = geminiData.candidates[0].content.parts[0].text.trim();
               }
           } catch (e) {
               console.error("Vision AI Error:", e);
           }
           
           sendEvent('progress', { step: 'Generation', message: `Menyusun Naskah: "${scriptText}"` });
           
           // 2. HeyGen API Integration
           sendEvent('progress', { step: 'Generation', message: 'Terhubung ke HeyGen API untuk merender Talking Head (Estimasi 30-60 detik)...' });
           let heygenVideoUrl = '';
           
           try {
               const heygenHeaders = {
                   'x-api-key': process.env.HEYGEN_API_KEY,
                   'Content-Type': 'application/json'
               };
               
               // We will use standard Node.js fetch (v18+) with FormData
               const base64Data = attachedImage.split(',')[1];
               const buffer = Buffer.from(base64Data, 'base64');
               const blob = new Blob([buffer], { type: 'image/jpeg' });
               const formData = new FormData();
               formData.append('file', blob, 'image.jpg');
               
               sendEvent('progress', { step: 'Generation', message: 'Mengunggah gambar ke HeyGen (Asset API)...' });
               const assetRes = await fetch('https://api.heygen.com/v3/assets', {
                   method: 'POST',
                   headers: { 'x-api-key': process.env.HEYGEN_API_KEY },
                   body: formData
               });
               const assetData = await assetRes.json();
               const assetId = assetData.data?.asset_id;
               
               let avatarId = "josh_lite3_20230714"; // Fallback
               if (assetId) {
                   sendEvent('progress', { step: 'Generation', message: 'Membuat Photo Avatar...' });
                   const avatarRes = await fetch('https://api.heygen.com/v3/avatars', {
                       method: 'POST',
                       headers: heygenHeaders,
                       body: JSON.stringify({ type: "photo", file: { type: "asset_id", asset_id: assetId } })
                   });
                   const avatarData = await avatarRes.json();
                   if (avatarData.data?.avatar_id) {
                       avatarId = avatarData.data.avatar_id;
                   }
               }
               
               sendEvent('progress', { step: 'Generation', message: 'Merender Video (Bisa memakan waktu 1-2 menit)...' });
               const genRes = await fetch('https://api.heygen.com/v2/video/generate', {
                   method: 'POST',
                   headers: heygenHeaders,
                   body: JSON.stringify({
                       video_inputs: [{
                           character: { type: "talking_photo", talking_photo_id: avatarId },
                           voice: { type: "text", input_text: scriptText, voice_id: "0f5eb08f7f2b4c1fb3a1f87964dfb3cd" }
                       }],
                       dimension: { width: 720, height: 1280 }
                   })
               });
               const genData = await genRes.json();
               const videoId = genData.data?.video_id;
               
               if (videoId) {
                   // Polling for video completion
                   for (let i = 0; i < 20; i++) {
                       await new Promise(r => setTimeout(r, 6000));
                       sendEvent('progress', { step: 'Generation', message: `Menunggu render video... (${(i+1)*6}s)` });
                       const statusRes = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
                           headers: { 'x-api-key': process.env.HEYGEN_API_KEY }
                       });
                       const statusData = await statusRes.json();
                       if (statusData.data?.status === 'completed') {
                           heygenVideoUrl = statusData.data.video_url;
                           break;
                       } else if (statusData.data?.status === 'failed') {
                           console.error("HeyGen Video Failed:", statusData);
                           break;
                       }
                   }
               }
           } catch (e) {
               console.error("HeyGen API Error:", e);
           }

           if (heygenVideoUrl) {
               finalHtml = `
               <style>body{margin:0;padding:0;background:black;}</style>
               <video src="${heygenVideoUrl}" controls autoplay loop style="width:100vw; height:100vh; object-fit:contain;"></video>
               `;
           } else {
               // Fallback to simulated cinematic mode if HeyGen failed
               finalHtml = `
               <style>
                 body { margin: 0; padding: 0; background: black; font-family: sans-serif; user-select: none; }
                 @keyframes kenburns {
                   0% { transform: scale(1) translate(0, 0); }
                   50% { transform: scale(1.1) translate(-1%, 1%); filter: contrast(1.05) brightness(1.1); }
                   100% { transform: scale(1) translate(0, 0); }
                 }
                 @keyframes progress { 0% { width: 0%; } 100% { width: 100%; } }
                 .video-container { width: 100vw; height: 100vh; overflow: hidden; position: relative; cursor: pointer; }
                 .video-img { width: 100%; height: 100%; object-fit: cover; animation: kenburns 15s ease-in-out infinite alternate; }
                 .subtitle { 
                     position: absolute; bottom: 80px; left: 5%; right: 5%; 
                     text-align: center; color: white; font-size: 16px; font-weight: bold; 
                     text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                     background: rgba(0,0,0,0.5); padding: 10px; border-radius: 8px;
                 }
                 .controls {
                   position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; box-sizing: border-box;
                   background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
                   display: flex; align-items: center; gap: 10px; opacity: 0; transition: opacity 0.3s;
                 }
                 .video-container:hover .controls { opacity: 1; }
                 .play-btn { width: 24px; height: 24px; background: transparent; border: none; color: white; cursor: pointer; display: flex; justify-content: center; align-items: center; padding: 0; outline: none; }
                 .progress-bg { flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; }
                 .progress-bar { height: 100%; background: #6366f1; width: 0%; animation: progress 15s linear forwards; }
                 .paused .video-img, .paused .progress-bar { animation-play-state: paused !important; }
               </style>
               <div class="video-container" id="player" onclick="togglePlay()">
                 <img src="${imageUrl}" class="video-img" crossorigin="anonymous" />
                 <div class="subtitle">"${scriptText}"</div>
                 <div class="controls" onclick="event.stopPropagation(); togglePlay()">
                   <button class="play-btn" id="playBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg></button>
                   <div class="progress-bg"><div class="progress-bar"></div></div>
                 </div>
               </div>
               <script>
                 let isPlaying = true;
                 const player = document.getElementById('player');
                 const playBtn = document.getElementById('playBtn');
                 const pauseIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';
                 const playIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
                 function togglePlay() {
                   isPlaying = !isPlaying;
                   if (isPlaying) { player.classList.remove('paused'); playBtn.innerHTML = pauseIcon; } 
                   else { player.classList.add('paused'); playBtn.innerHTML = playIcon; }
                 }
               </script>
               `;
           }
       } 
       // ─── IMAGE MODE & TEXT-TO-IMAGE FALLBACK ───
       else {
           const prompt = encodeURIComponent(latestMessage.replace(/\[Gambar Terlampir:.*?\]/g, '').trim());
           if (!imageUrl) {
               imageUrl = activeMode === 'Image' 
                 ? `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1920&nologo=true`
                 : `https://image.pollinations.ai/prompt/${prompt}?width=1920&height=1080&nologo=true`;
           }
           
           if (activeMode === 'Image') {
             finalHtml = `
               <div style="width:100%; height:100%; background:black; display:flex; justify-content:center; align-items:center;">
                 <img src="${imageUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" />
               </div>
             `;
           } else {
             // Fallback Video UI
             finalHtml = `
               <style>
                 body { margin: 0; padding: 0; background: black; overflow: hidden; }
                 .video-img { width: 100vw; height: 100vh; object-fit: cover; animation: kenburns 30s ease-in-out infinite alternate; }
                 @keyframes kenburns { 0% { transform: scale(1); } 100% { transform: scale(1.15); } }
               </style>
               <img src="${imageUrl}" class="video-img" />
             `;
           }
       }
       
       sendEvent('progress', { step: 'Delivery', message: 'Selesai.' });
       sendEvent('asset', { html: finalHtml });
       return res.end();
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
    const asset = await generationEngine.generate(blueprint, 'WEB_PROTOTYPE', combinedRequirements);

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
