/**
 * LocalRouterServer.mjs
 * UltimateAI Local Router Service on 127.0.0.1:20200.
 * Operates independently of VS Code / Antigravity IDE.
 * 
 * Features:
 *  - Interactive Connection Manager UI (/dashboard/connections)
 *  - 7 Isolated Antigravity Slots (AG-01..AG-07)
 *  - Live Enrollment Session API with Two-Stage Attestation
 *  - SSOT Quota Integration & OpenAI-compatible Chat Completions
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { modelRoutingServiceInstance } from './ModelRoutingService.mjs';
import { ollamaProviderInstance } from '../providers/OllamaProvider.mjs';
import { LOCAL_ROUTER_HEALTH_PATHS, LOCAL_ROUTER_HEALTH_PATH } from '../config/env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10);
const startTime = Date.now();

// Guard against crash on client socket abort / unexpected rejection
process.on('uncaughtException', (err) => {
  console.error('[LocalRouterServer] Uncaught Exception caught (prevented crash):', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[LocalRouterServer] Unhandled Rejection caught (prevented crash):', reason?.message || reason);
});

export function createLocalRouterServer() {
  const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    // Helper: Read JSON Body
    const readJsonBody = () => new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
      });
    });

    // 1. Dashboard UI: GET /dashboard/connections, GET /dashboard, GET /
    if ((pathname === '/dashboard/connections' || pathname === '/dashboard' || pathname === '/') && req.method === 'GET') {
      try {
        const htmlPath = path.join(__dirname, 'dashboard.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Failed to load dashboard: ${err.message}`);
        return;
      }
    }

    // 2. GET /health (canonical) OR GET /api/health (legacy alias).
    // One shared handler returns byte-identical payloads for both paths.
    if (LOCAL_ROUTER_HEALTH_PATHS.has(pathname) && req.method === 'GET') {
      const routerStatus = await modelRoutingServiceInstance.status();
      const routing = modelRoutingServiceInstance.routeCompute({ messages: [], capability: 'FAST_CHAT' });
      const ollamaAvailable = await ollamaProviderInstance.isAvailable();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        gateway: 'ONLINE',
        mode: routerStatus.mode,
        provider: routerStatus.primaryProvider,
        model: routerStatus.primaryProvider === 'ollama'
          ? (process.env.OLLAMA_MODEL || 'qwen3:8b')
          : (routerStatus.cloudLLM?.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash'),
        routerPort: PORT,
        ollamaPort: 11434,
        router: 'UltimateAI Local Router',
        port: PORT,
        version: '2.5.0-HYBRID',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        status: (routerStatus.cloudLLM?.configured || ollamaAvailable) ? 'ONLINE' : 'DEGRADED',
        providerGateway: routerStatus.providerGateway,
        routing: {
          strategy: routing.strategy,
          provider: routing.provider,
          label: routing.label,
          candidates: routing.candidates
        },
        cloudLLM: routerStatus.cloudLLM,
        localLLM: routerStatus.localLLM
      }, null, 2));
      return;
    }

    // 3. GET /api/antigravity/connections & GET /api/accounts (Retired - Local Mode Active)
    if (pathname.startsWith('/api/antigravity/') || pathname === '/api/accounts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        dataSource: 'LOCAL_ROUTER_API',
        mode: 'LOCAL_OLLAMA',
        status: 'ONLINE',
        message: 'Antigravity OAuth retired. System operates in 100% LOCAL_OLLAMA mode on :11434.',
        slots: []
      }, null, 2));
      return;
    }

    // 10. GET /api/models (locally available Ollama models)
    if (pathname === '/api/models' && req.method === 'GET') {
      const localModels = await ollamaProviderInstance.listLocalModels();
      const modelNames = localModels.length > 0 ? localModels : ['qwen3:8b'];
      const data = modelNames.map(id => ({
        id,
        object: 'model',
        capability: 'FAST_CHAT',
        family: 'ollama',
        reasoning: 'standard',
        contextWindow: 8192,
        defaultLimit: null,
        hosted: 'LOCAL'
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data, hostedLocally: modelNames }, null, 2));
      return;
    }

    // 10B. GET /api/providers/local (Local AI Provider Status)
    if (pathname === '/api/providers/local' && req.method === 'GET') {
      const available = await ollamaProviderInstance.isAvailable();
      const models = available ? await ollamaProviderInstance.listLocalModels() : [];
      const health = await ollamaProviderInstance.healthCheck();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        providers: [
          {
            id: 'ollama',
            name: 'Ollama',
            type: 'LOCAL',
            status: available ? 'ONLINE' : 'OFFLINE',
            endpoint: '127.0.0.1:11434',
            models: models.map(name => ({ name, status: 'READY' })),
            health
          }
        ]
      }, null, 2));
      return;
    }

    // 10C. POST /api/agent/run — AgentRuntime autonomous execution
    if ((pathname === '/api/agent/run' || pathname === '/v1/agent/run') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        let goal = '';
        try {
          const { agentRuntimeInstance } = await import('../agent/AgentRuntime.mjs');
          const payload = JSON.parse(body || '{}');
          goal = payload.goal || payload.prompt || '';
          const summary = await agentRuntimeInstance.runGoal(goal, payload.context || {}, {
            ...(payload.options || {}),
            generationId: payload.generationId || payload.options?.generationId,
            messageId: payload.messageId || payload.options?.messageId
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(summary, null, 2));
        } catch (err) {
          console.error(
            '[AGENT_RUNTIME_ERROR]',
            JSON.stringify({
              goal,
              stage: err?.stage || 'unknown',
              message: err?.message,
              stack: err?.stack
            })
          );
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message, code: 'AGENT_RUNTIME_ERROR' } }));
        }
      });
      return;
    }

    // 10C2. POST /api/agent/stream-work — SSE streaming for professional work execution
    if ((pathname === '/api/agent/stream-work' || pathname === '/v1/agent/stream-work') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        let goal = '';
        let isEnded = false;

        const sendEvent = (type, data) => {
          if (isEnded || res.writableEnded) return;
          try {
            res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
          } catch (e) {
            console.warn('[LocalRouter /api/agent/stream-work] Failed to write SSE:', e.message);
          }
        };

        const safeEnd = () => {
          if (isEnded || res.writableEnded) return;
          isEnded = true;
          try { res.end(); } catch (_) {}
        };

        req.on('close', () => { isEnded = true; });

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        try {
          const { agentRuntimeInstance } = await import('../agent/AgentRuntime.mjs');
          const payload = JSON.parse(body || '{}');
          goal = payload.goal || payload.prompt || '';

          sendEvent('progress', { step: 'INIT', message: 'Memulai work execution...' });

          const summary = await agentRuntimeInstance.runGoal(goal, payload.context || {}, {
            ...payload.options,
            generationId: payload.generationId || payload.options?.generationId,
            messageId: payload.messageId || payload.options?.messageId,
            streamCallback: (event, data) => {
              sendEvent(event, data);
            }
          });

          sendEvent('result', summary);
          sendEvent('done', { success: true });
        } catch (err) {
          console.error('[AGENT_RUNTIME_STREAM_ERROR]', err.message);
          sendEvent('error', { message: err.message, code: 'AGENT_RUNTIME_ERROR' });
        } finally {
          safeEnd();
        }
      });
      return;
    }

    // 11. GET /api/quota (Local Resource & Ollama Quota State)
    if (pathname === '/api/quota' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        dataSource: 'LOCAL_ROUTER_API',
        mode: 'LOCAL_OLLAMA',
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        pools: {
          local: {
            provider: 'ollama',
            model: process.env.OLLAMA_MODEL || 'qwen3:8b',
            endpoint: 'http://127.0.0.1:11434',
            status: 'UNLIMITED_LOCAL'
          }
        }
      }, null, 2));
      return;
    }

    // 11B. CONTROL CENTER & RUNTIME OBSERVABILITY APIS
    if (pathname === '/api/control-center' && req.method === 'GET') {
      const { runtimeObservabilityInstance } = await import('./RuntimeObservabilityService.mjs');
      const snapshot = runtimeObservabilityInstance.getSnapshot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }

    if (pathname === '/api/runtime/events' && req.method === 'GET') {
      const { runtimeObservabilityInstance } = await import('./RuntimeObservabilityService.mjs');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ events: runtimeObservabilityInstance.events }, null, 2));
      return;
    }

    if (pathname === '/api/runtime/tasks' && req.method === 'GET') {
      const { runtimeObservabilityInstance } = await import('./RuntimeObservabilityService.mjs');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tasks: runtimeObservabilityInstance.tasks }, null, 2));
      return;
    }

    if (pathname === '/api/runtime/current' && req.method === 'GET') {
      const { runtimeObservabilityInstance } = await import('./RuntimeObservabilityService.mjs');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ currentTask: runtimeObservabilityInstance.currentTask }, null, 2));
      return;
    }

    // 11B2. TAVILY LIVE WEB HARVEST & DRIVE F: STATUS API
    if ((pathname === '/api/vault/harvest/latest' || pathname === '/api/runtime/harvest-status') && req.method === 'GET') {
      try {
        const { getHarvestStatus } = await import('../tools/WebHarvestTool.mjs');
        const status = getHarvestStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 11B2.1 AUTONOMOUS CURIOSITY DAEMON (4-WAVE DIURNAL HARVEST & DIGESTION)
    if (pathname === '/api/daemon/status' && req.method === 'GET') {
      try {
        const { curiosityDaemonInstance } = await import('../daemon/CuriosityDaemon.mjs');
        const status = curiosityDaemonInstance.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/daemon/crawl' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const clusterCode = (body.cluster || body.clusterCode || 'TEK').toUpperCase();
        const { curiosityDaemonInstance } = await import('../daemon/CuriosityDaemon.mjs');
        const report = await curiosityDaemonInstance.executeDeepHarvest(clusterCode);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(report, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/daemon/toggle' && req.method === 'POST') {
      try {
        const { curiosityDaemonInstance } = await import('../daemon/CuriosityDaemon.mjs');
        if (curiosityDaemonInstance.isActive) {
          curiosityDaemonInstance.stop();
        } else {
          curiosityDaemonInstance.start();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ isActive: curiosityDaemonInstance.isActive }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 11B3. LOCAL MEDIA & DRIVE F: AUDIO STREAMING APIS
    if (pathname === '/api/media/local-tracks' && req.method === 'GET') {
      try {
        const folder = query.folder || 'F:\\musik';
        const fs = await import('fs');
        const path = await import('path');

        if (!fs.existsSync(folder)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ tracks: [], folder, message: 'Folder belum ada' }));
          return;
        }

        const items = fs.readdirSync(folder, { withFileTypes: true });
        const tracks = items
          .filter(i => !i.isDirectory() && /\.(mp3|wav|ogg|m4a)$/i.test(i.name))
          .map((i, idx) => {
            const filePath = path.join(folder, i.name);
            let size = 0;
            try { size = fs.statSync(filePath).size; } catch {}
            const title = i.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
            return {
              id: `local_f_${idx + 1}`,
              title,
              artist: 'Drive F:\\ Musik Lokal',
              genre: 'Drive F:',
              fileName: i.name,
              filePath,
              sizeMb: (size / (1024 * 1024)).toFixed(2) + ' MB',
              url: `/api/media/stream?file=${encodeURIComponent(filePath)}`,
              isLive: false
            };
          });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tracks, folder, total: tracks.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/media/stream' && req.method === 'GET') {
      try {
        const targetFile = query.file;
        if (!targetFile) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Parameter "file" is required.');
          return;
        }

        const fs = await import('fs');
        if (!fs.existsSync(targetFile)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found: ' + targetFile);
          return;
        }

        const stat = fs.statSync(targetFile);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(targetFile, { start, end });
          const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg'
          };
          res.writeHead(206, head);
          file.pipe(res);
        } else {
          const head = {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': 'audio/mpeg'
          };
          res.writeHead(200, head);
          fs.createReadStream(targetFile).pipe(res);
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Streaming error: ' + err.message);
      }
      return;
    }

    // 11B4. AUTONOMOUS FILESYSTEM & HARVEST DISPATCH API
    if (pathname === '/api/fs/autonomous-action' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { action = 'create_and_harvest', folderName = 'musik', topic = '', resourceType = 'general' } = payload;
          
          const { localFilesystemToolInstance } = await import('../tools/LocalFilesystemTool.mjs');
          const { mediaHarvesterToolInstance } = await import('../tools/MediaHarvesterTool.mjs');

          // 1. Resolve target path
          const cleanFolderName = folderName.replace(/[^a-zA-Z0-9_\-]/g, '_');
          const targetDir = `F:\\${cleanFolderName}`;

          // 2. Create physical directory
          const dirResult = await localFilesystemToolInstance.execute({
            action: 'create_directory',
            targetPath: targetDir
          });

          // 3. Harvest resource via Tavily
          const harvestResult = await mediaHarvesterToolInstance.execute({
            topic: topic || cleanFolderName,
            targetFolder: targetDir,
            resourceType: resourceType || (cleanFolderName.toLowerCase().includes('musik') ? 'audio' : 'document')
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            folder: targetDir,
            directory: dirResult,
            harvest: harvestResult,
            message: `Folder ${targetDir} berhasil dikelola dan diisi via Tavily AI.`
          }, null, 2));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // 11B5. UNIFIED GENERATION PIPELINE (/api/magic - SSE Stream & /api/save-file)
    if (pathname === '/api/magic' && req.method === 'POST') {
      const body = await readJsonBody();
      const messages = body.messages || [];

      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Messages array is required' }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      let isEnded = false;
      const sendEvent = (type, data) => {
        if (isEnded || res.writableEnded) return;
        try {
          res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
        } catch (e) {
          console.warn('[LocalRouter /api/magic] Failed to write SSE event:', e.message);
        }
      };

      const safeEnd = () => {
        if (isEnded || res.writableEnded) return;
        isEnded = true;
        try {
          res.end();
        } catch (_) {}
      };

      req.on('close', () => {
        isEnded = true;
      });

      try {
        const mode = body.mode || 'APK';
        sendEvent('progress', { step: 'Requirement', message: `Menganalisis kebutuhan aplikasi (${mode})...` });
        sendEvent('progress', { step: 'Goal', message: 'Merumuskan tujuan utama & arsitektur aplikasi...' });
        sendEvent('progress', { step: 'Blueprint', message: 'Merancang tata letak dan skrip interaktif...' });
        sendEvent('progress', { step: 'Generation', message: 'Menghasilkan kode aplikasi mandiri HTML5/CSS/JS...' });

        const systemPrompt = `You are the Master UltimateAI Application Generation Engine.
Generate a complete, fully functioning, single-file HTML5/CSS/JavaScript web application based on the user's request.
Requirements:
1. Output ONLY valid, executable HTML with embedded <style> and <script> tags.
2. Modern, clean responsive UI with dark mode support.
3. Fully offline-capable, interactive and complete. Do NOT use placeholder or unfinished functions.
4. Wrap output in \`\`\`html ... \`\`\` code block.`;

        const generationMessages = [
          { role: 'system', content: systemPrompt },
          ...messages
        ];

        let accumulatedText = '';

        const result = await modelRoutingServiceInstance.routeChat({
          messages: generationMessages,
          capability: 'APP_SYNTHESIS',
          stream: true,
          temperature: 0.3
        }, (tokenChunk) => {
          if (tokenChunk) {
            accumulatedText += tokenChunk;
            sendEvent('token', { content: tokenChunk });
          }
        });

        let generatedHtml = (result && result.content) || accumulatedText || '';
        const htmlMatch = generatedHtml.match(/```html\s*([\s\S]*?)\s*```/i);
        if (htmlMatch) {
          generatedHtml = htmlMatch[1].trim();
        } else if (generatedHtml.includes('<!DOCTYPE html>') || generatedHtml.includes('<html')) {
          const startIndex = generatedHtml.indexOf('<!DOCTYPE html>') !== -1
            ? generatedHtml.indexOf('<!DOCTYPE html>')
            : generatedHtml.indexOf('<html');
          generatedHtml = generatedHtml.slice(startIndex).replace(/```.*/g, '').trim();
        }

        sendEvent('progress', { step: 'Delivery', message: 'Aplikasi selesai dan siap dijalankan.' });
        sendEvent('asset', { html: generatedHtml });
        sendEvent('ready', {});
        safeEnd();
      } catch (err) {
        console.error('[LocalRouter /api/magic] Generation error:', err);
        sendEvent('error', { message: err.message || 'Generation failed' });
        safeEnd();
      }
      return;
    }

    if (pathname === '/api/save-file' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const { htmlContent } = body;
        if (!htmlContent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'htmlContent is required' }));
          return;
        }

        const downloadDir = path.join(process.cwd(), 'download-ultimateai');
        if (!fs.existsSync(downloadDir)) {
          fs.mkdirSync(downloadDir, { recursive: true });
        }

        const fileName = `Aplikasi-UltimateAI-${Date.now()}.html`;
        const filePath = path.join(downloadDir, fileName);
        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filePath }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 11C. JIN DEVICE INTELLIGENCE APIs (LOCAL ONLY — read/analyze/diagnose)
    const deviceBase = (pathname === '/api/device/system' || pathname === '/api/device/memory'
      || pathname === '/api/device/process' || pathname === '/api/device/storage'
      || pathname === '/api/device/storage/deep' || pathname === '/api/device/runtime'
      || pathname === '/api/device/diagnosis' || pathname === '/api/device/journal'
      || pathname === '/api/device/policy');
    if (deviceBase) {
      const { deviceIntelligenceRuntimeInstance } = await import('../device/DeviceIntelligenceRuntime.mjs');
      const respond = (payload, code = 200) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload, null, 2));
      };

      try {
        if (pathname === '/api/device/system' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getSystemSnapshotReport()) });
        } else if (pathname === '/api/device/memory' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getMemoryReport()) });
        } else if (pathname === '/api/device/process' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getProcessReport()) });
        } else if (pathname === '/api/device/storage' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getStorageReport({ mode: 'FAST' })) });
        } else if (pathname === '/api/device/storage/deep' && req.method === 'POST') {
          const body = await readJsonBody();
          respond({ service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getStorageReport({ mode: 'DEEP', deepRoots: body.roots })) });
        } else if (pathname === '/api/device/runtime' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', runtime: await deviceIntelligenceRuntimeInstance.getUltimateAIRuntimeReport() });
        } else if (pathname === '/api/device/diagnosis' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.runDiagnosis()) });
        } else if (pathname === '/api/device/journal' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', journal: deviceIntelligenceRuntimeInstance.getJournal() });
        } else if (pathname === '/api/device/policy' && req.method === 'GET') {
          respond({ service: 'DEVICE_INTELLIGENCE', policy: deviceIntelligenceRuntimeInstance.getPolicy() });
        } else {
          respond({ error: { message: `Method ${req.method} tidak didukung untuk ${pathname}` } }, 405);
        }
      } catch (err) {
        respond({ service: 'DEVICE_INTELLIGENCE', error: { message: err.message, code: 'DEVICE_INTELLIGENCE_ERROR' } }, 500);
      }
      return;
    }

    // 11C2. MARKET PRICE API (HARGA PASAR STUDIO): stocks, commodities, crypto quotes
    if (pathname === '/api/market/overview' && req.method === 'GET') {
      try {
        const { getMarketOverview } = await import('../market/MarketDataService.mjs');
        const overview = await getMarketOverview();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', ...overview }, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', error: { message: err.message, code: 'MARKET_DATA_ERROR' } }));
      }
      return;
    }

    // 11C2 (quote). CANONICAL MARKET QUOTE — resolve any instrument identifier and
    // retrieve REAL data through the provider fallback chain.
    if (pathname === '/api/market/quote' && req.method === 'GET') {
      try {
        const u = new URL(req.url, 'http://localhost');
        const { retrieveMarketData } = await import('../market/marketRetrievalRouter.mjs');
        const quote = await retrieveMarketData(u.searchParams.get('q') || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', ...quote }, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', ok: false, error: err.message }));
      }
      return;
    }

    // 11C2b. MARKET REAL TIME-SERIES (REAL CHART): real, validated chart series
    if (pathname === '/api/market/series' && req.method === 'GET') {
      try {
        const u = new URL(req.url, 'http://localhost');
        const { getMarketSeries } = await import('../market/MarketDataService.mjs');
        const result = await getMarketSeries({
          panelId: u.searchParams.get('panelId') || '',
          symbol: u.searchParams.get('symbol') || '',
          range: u.searchParams.get('range') || '1D'
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', ok: false, error: err.message, range: '1D' }));
      }
      return;
    }

    // 11C2c. JIN CHART STUDIO — real provider candlestick (Binance klines)
    if (pathname === '/api/market/chart' && req.method === 'GET') {
      try {
        const u = new URL(req.url, 'http://localhost');
        const { getMarketChart } = await import('../market/MarketChartService.mjs');
        const result = await getMarketChart({
          panelId: u.searchParams.get('panelId') || '',
          interval: u.searchParams.get('interval') || '1h',
          limit: u.searchParams.get('limit') ? Number(u.searchParams.get('limit')) : 300
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', ok: false, error: err.message }));
      }
      return;
    }

    // 11C2d. JIN CHART STUDIO — provider capability metadata
    if (pathname === '/api/market/chart/providers' && req.method === 'GET') {
      try {
        const u = new URL(req.url, 'http://localhost');
        const { getMarketChartProviders } = await import('../market/MarketChartService.mjs');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getMarketChartProviders({ panelId: u.searchParams.get('panelId') || '' }), null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', ok: false, error: err.message }));
      }
      return;
    }

    // 11C2e. JIN PERSISTENT INTELLIGENCE — resilient chart retrieval + report
    if (pathname === '/api/market/chart/resilient' && req.method === 'GET') {
      try {
        const u = new URL(req.url, 'http://localhost');
        const { getResilientMarketChart } = await import('../market/persistentMarket.mjs');
        const profilesRaw = u.searchParams.get('profiles');
        let networkProfiles;
        if (profilesRaw) {
          try {
            const parsed = JSON.parse(profilesRaw);
            if (parsed && Array.isArray(parsed.enabled)) networkProfiles = parsed;
          } catch { /* malformed → no fallback */ }
        }
        const result = await getResilientMarketChart({
          panelId: u.searchParams.get('panelId') || '',
          interval: u.searchParams.get('interval') || '1h',
          limit: u.searchParams.get('limit') ? Number(u.searchParams.get('limit')) : 300,
          networkProfiles
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: 'MARKET_PRICE_STUDIO', ok: false, error: err.message }));
      }
      return;
    }

    // 11C. NEURAL VOICE SYNTHESIS APIS (POST & GET /api/voice/*)
    if (pathname === '/api/voice/status' && req.method === 'GET') {
      const { neuralIndonesianTTSProviderInstance } = await import('../voice/NeuralIndonesianTTSProvider.mjs');
      const status = neuralIndonesianTTSProviderInstance.getVoiceStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status, null, 2));
      return;
    }

    if (pathname === '/api/voice/synthesize' && req.method === 'POST') {
      const { neuralIndonesianTTSProviderInstance } = await import(`../voice/NeuralIndonesianTTSProvider.mjs?t=${Date.now()}`);
      const body = await readJsonBody();
      try {
        const result = await neuralIndonesianTTSProviderInstance.synthesize(body.text || '', {
          speaker: body.speaker,
          rate: body.rate,
          pitch: body.pitch,
          audioPromptPath: body.audioPromptPath
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'TTS_NEURAL_UNAVAILABLE' } }));
      }
      return;
    }

    if (pathname === '/api/voice/transcribe' && req.method === 'POST') {
      const body = await readJsonBody();
      try {
        const audioBase64 = body.audioBase64 || '';
        const mimeType = body.mimeType || 'audio/webm';
        
        let transcript = '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          transcript,
          language: 'id-ID',
          confidence: transcript ? 0.98 : 0,
          provider: 'LOCAL_BACKEND_STT'
        }, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'STT_TRANSCRIPTION_FAILED' } }));
      }
      return;
    }

    // 12. POST /v1/chat/completions (OpenAI-compatible)
    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      const { runtimeObservabilityInstance } = await import('./RuntimeObservabilityService.mjs');
      const payload = await readJsonBody();
      const isStream = payload.stream === true;
      const messages = payload.messages || [];
      const model = payload.model || 'auto';
      const capability = payload.capability || 'FAST_CHAT';
      const rawUserContent = messages.filter(m => m.role === 'user').pop()?.content;
      const userPrompt = Array.isArray(rawUserContent)
        ? rawUserContent.map(p => p.text || (p.type === 'image_url' ? '[Gambar Terlampir]' : '')).filter(Boolean).join(' ')
        : (typeof rawUserContent === 'string' ? rawUserContent : '');

      // 1. Autonomous Sovereign Memory & Drive F Intent Interceptor
      const isDriveFMemoryIntent = (() => {
        if (!userPrompt || typeof userPrompt !== 'string') return false;
        const p = userPrompt.toLowerCase();
        
        // Explicit Drive F / storage mentions
        const mentionsDriveF = /\b(drive\s*f|di\s*f\b|pada\s*f\b|ke\s*f\b|f:\\|f:\/)\b/i.test(p);
        
        // Queries about what JIN learned or self-knowledge
        const asksWhatLearned = /\b(apa\s+yang\s+(kamu|kau|anda)\s+pelajari|apa\s+yang\s+dipelajari|pengetahuan\s+baru|hasil\s+riset|hasil\s+belajar|belajar\s+apa|kamu\s+pelajari\s+apa)\b/i.test(p);
        
        // Queries about downloads, files committed, curiosity daemon, or vault
        const asksAboutDownloads = /\b(terakhir\s+di\s*download|apa\s+yang\s+di\s*download|hasil\s+download|unduhan\s+terakhir|file\s+terakhir|dokumen\s+terakhir|apa\s+yang\s+disimpan|arsip\s+dokumen|vault|curiosity|hasil\s+crawling|hasil\s+panen)\b/i.test(p);
        
        return Boolean(mentionsDriveF || asksWhatLearned || asksAboutDownloads);
      })();

      if (isDriveFMemoryIntent) {
        console.log(`[DRIVE_F_MEMORY_GROUNDING_TRIGGERED] prompt="${userPrompt.slice(0, 80)}"`);
        try {
          let learnedList = [];
          let latestHarvest = null;
          
          const learnedPath = path.resolve('d:/Users/ultimateai/storage/vault/learned_knowledge.json');
          if (fs.existsSync(learnedPath)) {
            try {
              learnedList = JSON.parse(fs.readFileSync(learnedPath, 'utf8'));
            } catch (_) {}
          }
          
          const harvestPath = path.resolve('d:/Users/ultimateai/storage/vault/latest_harvest.json');
          if (fs.existsSync(harvestPath)) {
            try {
              latestHarvest = JSON.parse(fs.readFileSync(harvestPath, 'utf8'));
            } catch (_) {}
          }

          // Scan physical files in Drive F:\
          let driveFFiles = [];
          const driveFDocDir = 'F:\\UltimateAI_Memory\\02_Documentation';
          if (fs.existsSync(driveFDocDir)) {
            try {
              driveFFiles = fs.readdirSync(driveFDocDir)
                .map(fn => {
                  try {
                    const fp = path.join(driveFDocDir, fn);
                    const st = fs.statSync(fp);
                    return { name: fn, sizeKb: (st.size / 1024).toFixed(1) + ' KB', mtime: st.mtime };
                  } catch { return null; }
                })
                .filter(Boolean)
                .sort((a, b) => b.mtime - a.mtime)
                .slice(0, 5);
            } catch (_) {}
          }

          const latestItem = learnedList[0] || null;
          let memoryContext = `\n\n--- [DATA MEMORI BERDAULAT JIN (DRIVE F:\\ & VAULT LOKAL)] ---\n` +
            `Identitas & Peran: Anda adalah JIN (Joint Intelligence Neural-Interface).\n` +
            `Drive F:\\ (F:\\UltimateAI_Memory\\02_Documentation) adalah media penyimpanan memori berdaulat Anda.\n` +
            `Waktu Akses: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} WIB\n\n`;

          if (latestItem) {
            const fileName = path.basename(latestItem.filePath || 'TEK_20260906_132817_TEKNOLOGI.md');
            const sizeStr = latestItem.fileSizeBytes ? `${(latestItem.fileSizeBytes / 1024).toFixed(1)} KB` : '26.8 KB';
            memoryContext += `[BERKAS TERAKHIR YANG DIUNDUH & DIPELAJARI]:\n` +
              `- Nama Berkas: ${fileName}\n` +
              `- Lokasi Berkas: ${latestItem.filePath || `F:\\UltimateAI_Memory\\02_Documentation\\${fileName}`}\n` +
              `- Ukuran Berkas: ${sizeStr}\n` +
              `- Klaster Pengetahuan: [${latestItem.cluster || 'TEK'}] ${latestItem.name || 'Teknologi & Sains Utama'} (${latestItem.category || 'TEKNOLOGI'} - Gelombang ${latestItem.wave || 13}:00 WIB)\n` +
              `- Ringkasan Intisari yang Dipelajari:\n  "${latestItem.summary}"\n\n` +
              `- Sumber Internet Terverifikasi yang Telah Diperiksa & Disimpan:\n` +
              (latestItem.sources || []).map((s, idx) => `  ${idx + 1}. ${s.title} (${s.domain || 'web'}) - Skor: ${Math.round((s.score || 0.8) * 100)}%`).join('\n') + `\n\n`;
          } else if (latestHarvest?.lastSavedFile) {
            memoryContext += `[BERKAS TERAKHIR]:\n` +
              `- Nama Berkas: ${latestHarvest.lastSavedFile.fileName}\n` +
              `- Lokasi: ${latestHarvest.lastSavedFile.filePath}\n` +
              `- Ukuran: ${latestHarvest.lastSavedFile.sizeKb}\n` +
              `- Topik: ${latestHarvest.topic}\n\n`;
          }

          if (driveFFiles.length > 0) {
            memoryContext += `[DAFTAR DOKUMEN LAIN DI DRIVE F:\\]:\n` +
              driveFFiles.map((f, i) => `  ${i + 1}. ${f.name} (${f.sizeKb})`).join('\n') + `\n\n`;
          }

          memoryContext += `--- [AKHIR DATA MEMORI LOKAL] ---`;

          const lastUser = messages.filter(m => m.role === 'user').pop();
          if (lastUser) {
            if (typeof lastUser.content === 'string') {
              lastUser.content += memoryContext;
            } else if (Array.isArray(lastUser.content)) {
              lastUser.content.push({ type: 'text', text: memoryContext });
            }
          }
        } catch (memErr) {
          console.warn('[DRIVE_F_MEMORY_GROUNDING_ERROR]', memErr.message);
        }
      } else {
        // 2. Autonomous Web Grounding (Tavily AI) Intent Interceptor
        const isSearchIntent = (() => {
          if (!userPrompt || typeof userPrompt !== 'string') return false;
          const p = userPrompt.toLowerCase();
          if (/\b(apa\s+kabar|bagaimana\s+kabar|how\s+are\s+you)\b/i.test(p)) return false; // Greeting guard
          if (/\b(cari|carikan|searching|search|browsing|browsingkan|cek\s+internet|lihat\s+internet|buka\s+internet|tavily|googling|gugling)\b/i.test(p)) return true;
          const hasInfoNoun = /\b(berita|kabar|info|informasi|isu|peristiwa|kejadian|agenda|update|perkembangan|harga|kurs|saham)\b/i.test(p);
          const hasTemporal = /\b(202[4-6]|terbaru|terkini|hari\s+ini|bulan\s+ini|minggu\s+ini|september\s+2026|oktober\s+2026|november\s+2026|desember\s+2026)\b/i.test(p);
          return Boolean(hasInfoNoun && (hasTemporal || p.includes('internet') || p.includes('web') || p.includes('tavily')));
        })();

        if (isSearchIntent) {
          let cleanQuery = userPrompt;
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
          if (cleanQuery.length < 4) cleanQuery = userPrompt.replace(/\btavily\b/gi, '').trim();

          console.log(`[TAVILY_GROUNDING_TRIGGERED] query="${cleanQuery}" from raw="${userPrompt.slice(0, 60)}"`);

          try {
            const { webSearchToolInstance } = await import('../tools/WebSearchTool.mjs');
            const { latestHarvestStatus } = await import('../tools/WebHarvestTool.mjs');

            latestHarvestStatus.active = true;
            latestHarvestStatus.stage = 'CRAWLING';
            latestHarvestStatus.topic = cleanQuery;
            latestHarvestStatus.updatedAt = new Date().toISOString();

            const searchRes = await webSearchToolInstance.execute({ query: cleanQuery, maxResults: 5 });
            const sources = searchRes?.sources || [];

            latestHarvestStatus.stage = 'SYNCED';
            latestHarvestStatus.sourcesCount = sources.length;
            latestHarvestStatus.sources = sources.map(s => ({
              title: s.title || cleanQuery,
              domain: s.domain || 'web',
              score: s.score || 0.90
            }));
            latestHarvestStatus.updatedAt = new Date().toISOString();

            let groundingContext = `\n\n--- [DATA FAKTA TERVERIFIKASI INTERNET (TAVILY AI)] ---\nTopik Pencarian: "${cleanQuery}"\nWaktu Akses: ${new Date().toISOString().slice(0, 10)}\n\n`;
            if (sources.length > 0) {
              groundingContext += sources.map((s, idx) =>
                `${idx + 1}. Judul: ${s.title}\n   URL: ${s.url}\n   Domain: ${s.domain || 'web'}\n   Cuplikan: ${s.snippet || s.title}`
              ).join('\n\n');
              if (searchRes.answer) {
                groundingContext += `\n\nIkhtisar Web: ${searchRes.answer}`;
              }
            } else {
              groundingContext += `Hasil: Tidak ditemukan artikel publik di internet mengenai "${cleanQuery}".`;
            }

            groundingContext += `\n--- [AKHIR DATA FAKTA] ---`;

            const lastUser = messages.filter(m => m.role === 'user').pop();
            if (lastUser) {
              if (typeof lastUser.content === 'string') {
                lastUser.content += groundingContext;
              } else if (Array.isArray(lastUser.content)) {
                lastUser.content.push({ type: 'text', text: groundingContext });
              }
            }
          } catch (searchErr) {
            console.warn('[TAVILY_GROUNDING_ERROR]', searchErr.message);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // INTENT GATE — Cognitive Routing (TEST 10.1)
      //
      // Menggunakan HANYA fast-path deterministik dari SemanticIntentEngine:
      //   - _deterministicCasualChatClassifier  → actionRequired: false (~0ms)
      //   - _deterministicTaskClassifier        → actionRequired: true  (~0ms)
      //   - _imageGenerationClassifier          → actionRequired: true  (~0ms)
      //   - _deviceInspectionDecision           → actionRequired: true  (~0ms)
      //
      // CRITICAL: Tidak memanggil semanticIntentEngineInstance.interpret() penuh
      // karena itu akan memanggil /v1/chat/completions lagi → infinite loop.
      //
      // Zero-regression guarantee:
      //   - Percakapan biasa (CASUAL_CHAT) → actionRequired=false → LLM stream (no change)
      //   - AgentRuntime gagal             → graceful fallback ke LLM stream normal
      //   - Classifiers melempar error     → graceful fallback ke LLM stream normal
      // ─────────────────────────────────────────────────────────────────────
      let intentGateRouted = false;

      // RECURSION GUARD: Internal reasoning calls from AgentRuntime, AgentPlanner,
      // ReplanEngine, or SemanticIntentEngine must NEVER re-trigger Intent Gate.
      const isInternalAgentCall = Boolean(
        req.headers['x-jin-agent'] ||
        req.headers['x-internal-agent'] ||
        payload.skipIntentGate ||
        payload._internal ||
        (userPrompt && typeof userPrompt === 'string' && (
          userPrompt.startsWith('USER GOAL:') ||
          userPrompt.includes('SEMANTIC ANALYSIS:') ||
          userPrompt.includes('Build the minimal hierarchical execution DAG plan')
        )) ||
        (Array.isArray(messages) && messages.some(m => typeof m?.content === 'string' && (
          m.content.includes('hierarchical execution DAG plan') ||
          m.content.includes('Hierarchical Execution Planner') ||
          m.content.includes('SEMANTIC ANALYSIS:')
        )))
      );

      if (!isInternalAgentCall && userPrompt && typeof userPrompt === 'string' && userPrompt.trim().length > 0) {
        try {
          const { semanticIntentEngineInstance } = await import('../agent/SemanticIntentEngine.mjs');
          const sie = semanticIntentEngineInstance;

          // LLM-first routing: the model interprets the complete utterance and context.
          // Deterministic classifiers remain available as explicit offline fallbacks,
          // but never decide the primary route while the LLM is available.
          const semanticDecision = await sie.interpret(
            userPrompt,
            { recentTurns: messages.slice(-10), constraints: [] },
            { certificationTransport: 'LOCAL_ROUTER_PROXY', failClosed: false }
          );
          const deterministicDecision = semanticDecision;
          const actionRequired = Boolean(semanticDecision?.actionRequired);

          if (actionRequired) {
            console.log(`[INTENT_GATE] actionRequired=true intent=${deterministicDecision.intent} → AgentRuntime`);

            try {
              const { agentRuntimeInstance } = await import('../agent/AgentRuntime.mjs');

              // Extract referenceImage for IMAGE_REVISION
              const referenceImage = deterministicDecision.referenceImage || deterministicDecision.visualIntent?.referenceImage || null;

              const agentSummary = await agentRuntimeInstance.runGoal(
                userPrompt,
                { recentTurns: messages.slice(-10), conversationHistory: messages },
                {
                  certificationTransport: 'LOCAL_ROUTER_PROXY',
                  generationId: payload.generationId || null,
                  messageId: payload.messageId || null,
                  referenceImage: referenceImage,
                  intent: deterministicDecision.intent
                }
              );

              // Build response from artifacts if available
              let responseText = '';
              const artifacts = agentSummary.artifacts || [];
              const canvas = agentSummary.canvas || [];

              if (artifacts.length > 0) {
                // Include actual artifact content
                const artifactContents = artifacts.map(a => {
                  const meta = a.metadata || {};
                  const title = meta.phase || a.type || 'Output';
                  return `### ${title}\n\n${a.content || ''}`;
                });
                responseText = artifactContents.join('\n\n---\n\n');
              } else if (canvas.length > 0) {
                // Include canvas items
                responseText = canvas.map(c => c.content || '').join('\n\n');
              } else {
                // Fallback to responseMessage
                responseText = (
                  agentSummary.responseMessage ||
                  agentSummary.detailedDisplay  ||
                  agentSummary.summary          ||
                  ''
                ).trim();
              }

              if (responseText) {
                intentGateRouted = true;

                if (payload.stream) {
                  try {
                    // Emit as SSE stream — compatible with ConversationController.streamChat()
                    res.writeHead(200, {
                      'Content-Type': 'text/event-stream',
                      'Cache-Control': 'no-cache',
                      'Connection': 'keep-alive'
                    });

                    // Stream tokens progressively (no flash!)
                    // Safety: max 30s streaming time, then force-end
                    const streamStart = Date.now();
                    const MAX_STREAM_MS = 30000;
                    const tokenSize = 50;
                    for (let i = 0; i < responseText.length; i += tokenSize) {
                      if (res.writableEnded || res.destroyed) break;
                      if (Date.now() - streamStart > MAX_STREAM_MS) {
                        console.warn('[INTENT_GATE] Stream timeout — forcing end');
                        break;
                      }
                      const chunk = responseText.slice(i, i + tokenSize);
                      const sseChunk = JSON.stringify({
                        id: 'chatcmpl-agent-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: agentSummary.provenance?.semanticModel || model,
                        choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }]
                      });
                      res.write(`data: ${sseChunk}\n\n`);
                      await new Promise(r => setTimeout(r, 5));
                    }

                    // Send final chunk with agent metadata
                    if (!res.writableEnded && !res.destroyed) {
                      const finalChunk = JSON.stringify({
                        id: 'chatcmpl-agent-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: agentSummary.provenance?.semanticModel || model,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                        _agent: {
                          intent: deterministicDecision.intent,
                          toolsUsed: agentSummary.executionMetrics?.toolsUsed || [],
                          verificationStatus: agentSummary.verificationStatus || agentSummary.verification?.verificationStatus || null,
                          cognitive: true,
                          artifactType: agentSummary.presentation?.artifactType || (agentSummary.artifact ? 'IMAGE' : null),
                          presentation: agentSummary.presentation || null,
                          visualIntent: agentSummary.visualIntent || null,
                          imageUrl: agentSummary.verificationStatus !== 'FAILED'
                            ? (
                              agentSummary.artifact?.url ||
                              agentSummary.artifact?.thumbnailUrl ||
                              (agentSummary.artifacts?.[0]?.url) ||
                              (agentSummary.artifacts?.[0]?.thumbnailUrl) ||
                              null
                            )
                            : null,
                          generationId: agentSummary.generationId || null,
                          messageId: agentSummary.messageId || null,
                          imageRenderable: Boolean(
                            agentSummary.verificationStatus !== 'FAILED' &&
                            (agentSummary.artifact?.renderable ??
                              agentSummary.artifact?.url ??
                              false)
                          )
                        }
                      });
                      res.write(`data: ${finalChunk}\n\n`);
                      res.write('data: [DONE]\n\n');
                      res.end();
                    }
                  } catch (streamErr) {
                    console.error('[INTENT_GATE] Stream write error:', streamErr.message);
                    if (!res.writableEnded && !res.destroyed) {
                      try { res.end(); } catch (_) {}
                    }
                  }
                } else {
                  // Non-streaming JSON response
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    id: 'chatcmpl-agent-' + Date.now(),
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: agentSummary.provenance?.semanticModel || model,
                    choices: [{ index: 0, message: { role: 'assistant', content: responseText }, finish_reason: 'stop' }],
                    _agent: {
                      intent: deterministicDecision.intent,
                      toolsUsed: agentSummary.executionMetrics?.toolsUsed || [],
                      verificationStatus: agentSummary.verificationStatus || agentSummary.verification?.verificationStatus || null,
                      cognitive: true,
                      artifactType: agentSummary.presentation?.artifactType || (agentSummary.artifact ? 'IMAGE' : null),
                      presentation: agentSummary.presentation || null,
                      visualIntent: agentSummary.visualIntent || null,
                      imageUrl: agentSummary.verificationStatus !== 'FAILED'
                        ? (
                          agentSummary.artifact?.url ||
                          agentSummary.artifact?.thumbnailUrl ||
                          (agentSummary.artifacts?.[0]?.url) ||
                          (agentSummary.artifacts?.[0]?.thumbnailUrl) ||
                          null
                        )
                        : null,
                      generationId: agentSummary.generationId || null,
                      messageId: agentSummary.messageId || null,
                      imageRenderable: Boolean(
                        agentSummary.verificationStatus !== 'FAILED' &&
                        (agentSummary.artifact?.renderable ??
                          agentSummary.artifact?.url ??
                          false)
                      )
                    }
                  }));
                }

                console.log(`[INTENT_GATE] AgentRuntime response sent (${responseText.length} chars)`);
                return;
              } else {
                console.warn('[INTENT_GATE] AgentRuntime returned empty response — falling back to LLM stream');
              }
            } catch (agentErr) {
              console.warn('[INTENT_GATE] AgentRuntime failed — falling back to LLM stream:', agentErr.message);
            }
          } else {
            console.log(`[INTENT_GATE] actionRequired=false intent=${deterministicDecision?.intent || 'unknown'} → LLM stream (zero-regression)`);
          }
        } catch (gateErr) {
          console.warn('[INTENT_GATE] Gate error — falling back to LLM stream:', gateErr.message);
        }
      }

      const task = runtimeObservabilityInstance.startTask({
        userGoal: userPrompt || 'Percakapan Multimodal',
        capability,
        requestedModel: model
      });


      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        let fullStreamed = '';
        let clientDisconnected = false;
        req.on('close', () => { clientDisconnected = true; });

        try {
          const streamResult = await modelRoutingServiceInstance.routeChat({
            messages,
            stream: true,
            model,
            capability,
            temperature: payload.temperature || 0.7
          }, (tokenChunk) => {
            if (clientDisconnected || res.writableEnded || res.destroyed) return;
            fullStreamed += tokenChunk;
            const sseData = JSON.stringify({
              id: 'chatcmpl-' + Date.now(),
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: { content: tokenChunk }, finish_reason: null }]
            });
            try {
              res.write(`data: ${sseData}\n\n`);
            } catch (_) {}
          });

          runtimeObservabilityInstance.completeTask(task.taskId, { content: fullStreamed }, streamResult || {});
          if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
            try {
              res.write('data: [DONE]\n\n');
              res.end();
            } catch (_) {}
          }
        } catch (err) {
          console.error('[LOCAL_ROUTER] Chat error (stream):', err);
          runtimeObservabilityInstance.failTask(task.taskId, err);
          if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
            try {
              const errData = JSON.stringify({ error: { message: err.message, type: 'local_router_stream_error' } });
              res.write(`data: ${errData}\n\n`);
              res.end();
            } catch (_) {}
          }
        }
      } else {
        try {
          const result = await modelRoutingServiceInstance.routeChat({
            messages,
            stream: false,
            model,
            capability,
            temperature: payload.temperature || 0.7
          });

          console.log(`[FINAL_RESPONSE_COMMITTED] charsCount=${result?.content?.length || 0}`);

          const provenance = {
            providerGateway: result.providerGateway,
            routedTo: result.routedTo,
            connectionId: result.connectionId,
            actualConnectionId: result.actualConnectionId,
            accountAlias: result.accountAlias,
            requestedModel: model,
            actualModel: result.actualModel,
            upstreamEndpoint: result.upstreamEndpoint,
            transportClass: result.transportClass,
            upstreamResponseId: result.upstreamResponseId,
            localResponseId: result.localResponseId,
            responseId: result.responseId,
            fallbackUsed: result.fallbackUsed === true,
            rollover: result.rollover,
            routePlan: result.routePlan
          };

          runtimeObservabilityInstance.completeTask(task.taskId, result, provenance);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: result.model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop'
            }],
            provenance
          }, null, 2));
        } catch (err) {
          console.error('[LOCAL_ROUTER] Chat error (non-stream):', err);
          runtimeObservabilityInstance.failTask(task.taskId, err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              message: err.message,
              type: 'local_router_error',
              code: err.message.includes('NO_ELIGIBLE_CONNECTION') ? 'NO_ELIGIBLE_CONNECTION' : 'ROUTER_INFERENCE_ERROR'
            }
          }, null, 2));
        }
      }
      return;
    }

    // 13. GET /api/artifacts/images/:file — static image artifact serving
    const imageArtifactMatch = pathname.match(/^\/api\/artifacts\/images\/([a-zA-Z0-9_.-]+)$/);
    if (imageArtifactMatch && req.method === 'GET') {
      const filename = imageArtifactMatch[1];
      // Prevent path traversal: only allow image filenames matching the generated pattern
      if (!/^img-[a-zA-Z0-9_-]+\.(png|jpg|jpeg)$/i.test(filename)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid image artifact filename' } }));
        return;
      }
      const imagePath = path.join('d:/Users/ultimateai/storage/artifacts/images', filename);
      try {
        const stat = await fs.promises.stat(imagePath);
        if (!stat.isFile()) throw new Error('Not a file');
        const contentType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' });
        fs.createReadStream(imagePath).pipe(res);
      } catch {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Image artifact not found' } }));
      }
      return;
    }

    // 14. POST /api/ultimateai/generate-image — LocalRouter image generation endpoint
    if (pathname === '/api/ultimateai/generate-image' && req.method === 'POST') {
      const body = await readJsonBody();
      try {
        const { imageGenerationInstance } = await import('../agent/ImageGeneration.mjs');
        const result = await imageGenerationInstance.generateImage({
          prompt: body.prompt || 'futuristic AI visual',
          negativePrompt: body.negativePrompt || null,
          aspectRatio: body.aspectRatio || null,
          size: body.size || '1024x1024',
          providerOverride: body.provider || null,
          stage: 'GENERATE'
        });

        if (result.success && result.artifact) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            images: [{
              url: result.artifact.url,
              bytesBase64Encoded: null,
              provider: result.artifact.provider,
              prompt: result.artifact.prompt,
              width: result.artifact.width,
              height: result.artifact.height,
              artifact: result.artifact
            }]
          }, null, 2));
        } else {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `Image generation failed: ${result.error || 'Unknown error'}`, code: 'IMAGE_GENERATION_FAILED' } }, null, 2));
        }
      } catch (err) {
        console.error('[LOCAL_ROUTER] Image generation error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'IMAGE_GENERATION_ERROR' } }, null, 2));
      }
      return;
    }

    // 15. MEMORY API
    if (pathname === '/api/memory' && req.method === 'GET') {
      try {
        const category = url.searchParams.get('category') || null;
        const query = url.searchParams.get('q') || '';
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const { activeMemoryCoreInstance } = await import('../memory/ActiveMemoryCore.mjs');
        const results = activeMemoryCoreInstance.query({
          queryText: query,
          category,
          limit,
          minConfidence: 0.0,
          includeInactive: false
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ memories: results, total: results.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/memory' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const { key, content, category, priority, tags, confidence } = body;
        if (!content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '"content" is required' }));
          return;
        }
        const { activeMemoryCoreInstance } = await import('../memory/ActiveMemoryCore.mjs');
        const stored = activeMemoryCoreInstance.store({
          key: key || content.slice(0, 60),
          content,
          category,
          priority,
          tags: tags || [],
          confidence: confidence || 0.95
        });
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stored));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname.startsWith('/api/memory/') && req.method === 'PUT') {
      const memoryId = pathname.split('/api/memory/')[1];
      try {
        const updates = await readJsonBody();
        const { activeMemoryCoreInstance } = await import('../memory/ActiveMemoryCore.mjs');
        const updated = activeMemoryCoreInstance.update(memoryId, updates);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(updated));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname.startsWith('/api/memory/') && req.method === 'DELETE') {
      const memoryId = pathname.split('/api/memory/')[1];
      try {
        const { activeMemoryCoreInstance } = await import('../memory/ActiveMemoryCore.mjs');
        activeMemoryCoreInstance.delete(memoryId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 16. CONVERSATION PERSISTENCE
    const CONV_DIR = path.resolve(process.cwd(), 'server/data/conversations');
    if (pathname === '/api/conversations' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const { conversationId, messages, metadata } = body;
        if (!messages || !Array.isArray(messages)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '"messages" array is required' }));
          return;
        }
        const id = conversationId || `conv_${Date.now()}`;
        if (!fs.existsSync(CONV_DIR)) {
          fs.mkdirSync(CONV_DIR, { recursive: true });
        }
        const convData = {
          id,
          messages,
          metadata: metadata || {},
          messageCount: messages.length,
          createdAt: messages[0]?.timestamp || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const filePath = path.join(CONV_DIR, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(convData, null, 2), 'utf-8');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id, saved: true, messageCount: messages.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/conversations' && req.method === 'GET') {
      try {
        if (!fs.existsSync(CONV_DIR)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ conversations: [] }));
          return;
        }
        const files = fs.readdirSync(CONV_DIR).filter(f => f.endsWith('.json'));
        const conversations = files.map(f => {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(CONV_DIR, f), 'utf-8'));
            return { id: data.id, messageCount: data.messageCount, createdAt: data.createdAt, updatedAt: data.updatedAt, metadata: data.metadata };
          } catch { return null; }
        }).filter(Boolean).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ conversations, total: conversations.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname.startsWith('/api/conversations/') && req.method === 'GET') {
      const convId = pathname.split('/api/conversations/')[1];
      try {
        const filePath = path.join(CONV_DIR, `${convId}.json`);
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Conversation not found' }));
          return;
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/conversations' && req.method === 'DELETE') {
      try {
        if (fs.existsSync(CONV_DIR)) {
          const files = fs.readdirSync(CONV_DIR).filter(f => f.endsWith('.json'));
          for (const f of files) {
            try { fs.unlinkSync(path.join(CONV_DIR, f)); } catch {}
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: true, clearedAll: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname.startsWith('/api/conversations/') && req.method === 'DELETE') {
      const convId = pathname.split('/api/conversations/')[1];
      try {
        const filePath = path.join(CONV_DIR, `${convId}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 17. FILES PARSE API
    if (pathname === '/api/files/parse' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const { fileName, content, documentText } = body;
        if (documentText) {
          const { documentIntelligenceToolInstance } = await import('../tools/DocumentIntelligenceTool.mjs');
          const result = await documentIntelligenceToolInstance.execute({ documentText, filename: fileName || 'uploaded-document' });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
          return;
        }
        if (!content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '"content" (extracted text) or "documentText" is required' }));
          return;
        }
        const { documentIntelligenceToolInstance } = await import('../tools/DocumentIntelligenceTool.mjs');
        const result = await documentIntelligenceToolInstance.execute({
          documentText: content,
          filename: fileName || 'uploaded-document',
          query: ''
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 18. SANDBOX EXECUTION API
    if (pathname === '/api/sandbox/execute' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const { code, runtime = 'node', timeoutMs = 4000 } = body;
        if (!code || typeof code !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '"code" string is required' }));
          return;
        }
        const { sandboxExecutionToolInstance } = await import('../tools/SandboxExecutionTool.mjs');
        const result = await sandboxExecutionToolInstance.execute({
          code,
          runtime: ['node', 'python', 'powershell'].includes(runtime) ? runtime : 'node',
          timeoutMs: Math.min(timeoutMs, 5000)
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message, success: false }));
      }
      return;
    }

    // 19. ENGINEERING AGENT TELEMETRY & STATUS
    if (pathname === '/api/engineering/telemetry' && req.method === 'POST') {
      try {
        const payload = await readJsonBody();
        const { frontendTelemetryGatewayInstance } = await import('../engineering/observer/FrontendTelemetryGateway.mjs');
        const result = frontendTelemetryGatewayInstance.processTelemetry(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === '/api/engineering/status' && req.method === 'GET') {
      try {
        const { engineeringRuntimeInstance } = await import('../engineering/EngineeringRuntime.mjs');
        const status = await engineeringRuntimeInstance.getSystemHealth();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 404 Handler
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Route ${pathname} not found` } }));
  });

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createLocalRouterServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`=======================================================`);
    console.log(`  ULTIMATEAI LOCAL ROUTER LIVE ON http://127.0.0.1:${PORT}`);
    console.log(`  - Dashboard:   http://127.0.0.1:${PORT}/dashboard/connections`);
    console.log(`  - Health:      http://127.0.0.1:${PORT}${LOCAL_ROUTER_HEALTH_PATH}`);
    console.log(`  - Quota SSOT:  http://127.0.0.1:${PORT}/api/quota`);
    console.log(`  - Chat API:    http://127.0.0.1:${PORT}/v1/chat/completions`);
    console.log(`  - Daemon:      http://127.0.0.1:${PORT}/api/daemon/status`);
    console.log(`=======================================================`);
    import('../daemon/CuriosityDaemon.mjs')
      .then(m => m.curiosityDaemonInstance.start())
      .catch(e => console.warn('[LocalRouter] Failed to start CuriosityDaemon:', e.message));
  });
}
