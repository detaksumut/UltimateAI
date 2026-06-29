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
