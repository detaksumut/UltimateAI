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
import { imageEditingInstance } from '../agent/ImageEditing.mjs';
import { imageGenerationInstance } from '../agent/ImageGeneration.mjs';
import { imageOutputSizePolicyInstance, MAX_IMAGE_BYTES } from '../agent/ImageOutputSizePolicy.mjs';
import { IMAGE_STEPS } from '../agent/ImageOutputConfig.mjs';
import { LOCAL_ROUTER_HEALTH_PATHS, LOCAL_ROUTER_HEALTH_PATH } from '../config/env.mjs';

function verifyImageArtifactCompliance(artifact, isRevision = false) {
  if (!artifact || !artifact.renderable) return false;
  if (isRevision && !artifact.parentArtifactId) return false;

  // 1. In-memory byte size check
  if (artifact.bytesSize && artifact.bytesSize >= MAX_IMAGE_BYTES) return false;
  if (artifact.sizeBytes && artifact.sizeBytes >= MAX_IMAGE_BYTES) return false;

  // 2. Physical disk stat check
  if (artifact.localPath) {
    const postCheck = imageOutputSizePolicyInstance.validatePersistedFile(artifact.localPath);
    if (!postCheck.valid || postCheck.sizeBytes >= MAX_IMAGE_BYTES) {
      return false;
    }
  }
  return true;
}

function resolveRevisionFailureDetails(imageResult) {
  const reasonCode = imageResult?.reasonCode || (
    imageResult?.error?.includes('POLICY_VIOLATION') ? 'IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION' :
    imageResult?.error?.includes('timed out') ? 'PROVIDER_TIMEOUT' :
    imageResult?.error?.includes('offline') || imageResult?.error?.includes('unreachable') || imageResult?.error?.includes('unavailable') ? 'PROVIDER_UNAVAILABLE' :
    imageResult?.error?.includes('no output') ? 'OUTPUT_NOT_FOUND' :
    imageResult?.error?.includes('invalid') || imageResult?.error?.includes('corrupt') ? 'OUTPUT_INVALID' :
    imageResult?.error?.includes('SIZE_LIMIT') ? 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED' :
    'PROVIDER_EXECUTION_FAILED'
  );

  let failureReason = 'Provider image editing tidak tersedia.';
  if (reasonCode === 'IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION') {
    failureReason = `Kebijakan workflow revisi dilanggar (steps harus tepat ${IMAGE_STEPS || 8} pada CPU).`;
  } else if (reasonCode === 'PROVIDER_TIMEOUT') {
    failureReason = 'Waktu tunggu eksekusi ComfyUI terlampaui (timeout).';
  } else if (reasonCode === 'OUTPUT_NOT_FOUND') {
    failureReason = 'ComfyUI selesai dijalankan tetapi tidak menghasilkan file output gambar.';
  } else if (reasonCode === 'OUTPUT_INVALID') {
    failureReason = 'Format gambar yang dihasilkan ComfyUI tidak valid atau rusak.';
  } else if (reasonCode === 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED') {
    failureReason = 'Ukuran file gambar hasil revisi melebihi batas 1 MB.';
  } else if (reasonCode === 'PROVIDER_UNAVAILABLE') {
    failureReason = 'Backend ComfyUI offline atau tidak dapat dihubungi.';
  } else if (imageResult?.error) {
    failureReason = imageResult.error;
  }

  return { reasonCode, failureReason };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10);
const startTime = Date.now();

// Idempotency cache for image generation & revision: prevents duplicate executions for the same request
const recentImageExecutions = new Map(); // requestId -> { timestamp, status, artifact, responseText }
function pruneRecentImageExecutions() {
  const now = Date.now();
  for (const [id, item] of recentImageExecutions.entries()) {
    if (now - item.timestamp > 300000) { // 5 minutes TTL
      recentImageExecutions.delete(id);
    }
  }
}

// Guard against crash on client socket abort / unexpected rejection
process.on('uncaughtException', (err) => {
  console.error('[LocalRouterServer] Uncaught Exception caught (prevented crash):', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[LocalRouterServer] Unhandled Rejection caught (prevented crash):', reason?.message || reason);
});

export function enrichContextualImagePrompt(rawPrompt, messages = []) {
  const trimmed = String(rawPrompt || '').trim();
  const isGeneric = /^(?:buat(?:kan)?|bikin|generate|render|tampilkan|hasilkan)?\s*(?:visual(?:nya)?|gambar(?:nya)?|desain(?:nya)?|foto(?:nya)?|slidenya|tampilannya)$/i.test(trimmed);

  if (!isGeneric || !Array.isArray(messages) || messages.length === 0) {
    return trimmed;
  }

  // Find latest assistant message
  const lastAssistantMsg = [...messages].reverse().find(m => m && m.role === 'assistant');
  if (!lastAssistantMsg) return trimmed;

  const lastText = typeof lastAssistantMsg.content === 'string'
    ? lastAssistantMsg.content
    : (Array.isArray(lastAssistantMsg.content) ? lastAssistantMsg.content.map(p => p.text || '').join(' ') : '');

  if (!lastText) return trimmed;

  // 1. Check if last message contains structured presentation slide content
  const slideMatch = lastText.match(/###?\s*\**SLIDE\s*(\d+)[^:\n]*:?\s*([^\n\*]+)/i);
  const headlineMatch = lastText.match(/(?:Headline\s*\/?[^:]*|Key\s*Takeaway)[^:]*:\s*\*?([^\n\*]+)/i);
  const visualRecMatch = lastText.match(/(?:Rekomendasi\s+Visual|Elemen\s+Visual)[^:]*:\s*([^\n]+(?:\n\*[^\n]+)*)/i);
  const keyPointsMatch = lastText.match(/(?:Poin\s+Kunci)[^:]*:\s*([^\n]+(?:\n\*[^\n]+)*)/i);

  if (slideMatch || visualRecMatch || headlineMatch) {
    const slideNum = slideMatch ? slideMatch[1] : '';
    const slideTitle = slideMatch ? slideMatch[2].trim() : '';
    const headline = headlineMatch ? headlineMatch[1].trim() : '';
    const visualDesc = visualRecMatch ? visualRecMatch[1].replace(/[\*\_\#]/g, ' ').trim() : '';
    const keyPoints = keyPointsMatch ? keyPointsMatch[1].replace(/[\*\_\#]/g, ' ').trim() : '';

    const contextDetails = `\n\n[CONTEXT: PRESENTATION SLIDE]\n- Slide Number: ${slideNum}\n- Slide Title: ${slideTitle}\n- Headline: ${headline || slideTitle}\n- Key Points: ${keyPoints ? keyPoints.slice(0, 160) : '-'}\n- Recommended Visual: ${visualDesc || '-'}`;
    const enriched = `${rawPrompt}${contextDetails}`;
    console.log(`[CONTEXTUAL_PROMPT] Appended context to prompt for Visual Planner.`);
    return enriched;
  }

  // 2. Generic context from last assistant text
  const cleanSnippet = lastText
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[\*\_\#\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  if (cleanSnippet) {
    const enriched = `Professional visual design representing: ${cleanSnippet}. Modern cinematic 16:9, clean composition, high definition, elegant color grading`;
    console.log(`[CONTEXTUAL_PROMPT] Enriched generic visual prompt: "${enriched.slice(0, 120)}..."`);
    return enriched;
  }

  return trimmed;
}

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
      const localReady = routerStatus.localLLM?.status === 'READY';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        gateway: 'ONLINE',
        mode: routerStatus.mode,
        provider: routerStatus.primaryProvider,
        model: routerStatus.primaryProvider === 'llamacpp'
          ? (routerStatus.localLLM?.model || process.env.LLAMACPP_MODEL || 'qwen2.5-3b-instruct-q4_k_m.gguf')
          : (routerStatus.cloudLLM?.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash'),
        routerPort: PORT,
        llamaCppPort: 8080,
        router: 'UltimateAI Local Router',
        port: PORT,
        version: '2.5.0-HYBRID',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        status: (routerStatus.cloudLLM?.configured || localReady) ? 'ONLINE' : 'DEGRADED',
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
        mode: 'LOCAL_LLAMA_CPP',
        status: 'ONLINE',
        message: 'Antigravity OAuth retired. System runs on llama.cpp :8080 (Qwen 2.5 3B) with Gemini image pipeline.',
        slots: []
      }, null, 2));
      return;
    }

    // 10. GET /api/models (locally available llama.cpp model)
    if (pathname === '/api/models' && req.method === 'GET') {
      const routerStatus = await modelRoutingServiceInstance.status();
      const modelName = routerStatus.localLLM?.model || process.env.LLAMACPP_MODEL || 'qwen2.5-3b-instruct-q4_k_m.gguf';
      const data = [{
        id: modelName,
        object: 'model',
        capability: 'FAST_CHAT',
        family: 'llamacpp',
        reasoning: 'standard',
        contextWindow: parseInt(process.env.LLAMACPP_CTX_SIZE || '32768', 10),
        defaultLimit: null,
        hosted: 'LOCAL'
      }];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data, hostedLocally: [modelName] }, null, 2));
      return;
    }

    // 10B. GET /api/providers/local (Local AI Provider Status)
    if (pathname === '/api/providers/local' && req.method === 'GET') {
      const routerStatus = await modelRoutingServiceInstance.status();
      const localLLM = routerStatus.localLLM;
      const available = localLLM?.status === 'READY';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        providers: [
          {
            id: 'llamacpp',
            name: 'llama.cpp (Qwen 2.5 3B)',
            type: 'LOCAL',
            status: available ? 'ONLINE' : 'OFFLINE',
            endpoint: localLLM?.endpoint || 'http://127.0.0.1:8080',
            models: [{ name: localLLM?.model || 'qwen2.5-3b-instruct-q4_k_m.gguf', status: available ? 'READY' : 'PARKED' }]
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

    // 11. GET /api/quota (Local Resource & llama.cpp Quota State)
    if (pathname === '/api/quota' && req.method === 'GET') {
      const routerStatus = await modelRoutingServiceInstance.status();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        dataSource: 'LOCAL_ROUTER_API',
        mode: 'LOCAL_LLAMA_CPP',
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        pools: {
          local: {
            provider: 'llamacpp',
            model: routerStatus.localLLM?.model || 'qwen2.5-3b-instruct-q4_k_m.gguf',
            endpoint: routerStatus.localLLM?.endpoint || 'http://127.0.0.1:8080',
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

    // 11D. SLIDE STUDIO — Autonomous Programmatic Corporate Presentation Engine
    if ((pathname === '/api/studio/slide/create' || pathname === '/v1/studio/slide/create') && req.method === 'POST') {
      const body = await readJsonBody();
      try {
        const { slideStudioInstance } = await import('../studio/slide/SlideStudio.mjs');
        const result = await slideStudioInstance.createSlide(body.prompt || body.goal || '', body.options || {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'SLIDE_STUDIO_ERROR' } }));
      }
      return;
    }

    // 11E. GET /artifacts/slides/* — Static serving for generated slide assets
    if (pathname.startsWith('/artifacts/slides/') && req.method === 'GET') {
      const fileName = path.basename(pathname);
      const filePath = path.join('d:/Users/ultimateai/artifacts/slides', fileName);
      if (fs.existsSync(filePath)) {
        let contentType = 'application/octet-stream';
        if (fileName.endsWith('.svg')) contentType = 'image/svg+xml';
        else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (fileName.endsWith('.png')) contentType = 'image/png';
        else if (fileName.endsWith('.pptx')) contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        
        const fileContent = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileContent.length,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        });
        res.end(fileContent);
        return;
      }
    }

    // 11F. ARCHITECTURAL STUDIO — Autonomous Architectural Design & Building Workflow Engine
    if (pathname === '/api/studio/architectural/create' && req.method === 'POST') {
      const body = await readJsonBody();
      try {
        const { architecturalStudioInstance } = await import('../studio/architectural/ArchitecturalStudio.mjs');
        const result = architecturalStudioInstance.initiateDesignProject(body.prompt || body.goal || '', body.options || {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'ARCHITECTURAL_STUDIO_ERROR' } }));
      }
      return;
    }

    if (pathname === '/api/studio/architectural/produce-all' && req.method === 'POST') {
      try {
        const { architecturalStudioInstance } = await import('../studio/architectural/ArchitecturalStudio.mjs');
        const result = await architecturalStudioInstance.produceAllSteps();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'ARCHITECTURAL_STUDIO_ERROR' } }));
      }
      return;
    }

    // Static serving for architectural artifacts
    if (pathname.startsWith('/artifacts/architecture/') && req.method === 'GET') {
      const fileName = path.basename(pathname);
      const filePath = path.join('d:/Users/ultimateai/artifacts/architecture', fileName);
      if (fs.existsSync(filePath)) {
        let contentType = 'application/octet-stream';
        if (fileName.endsWith('.svg')) contentType = 'image/svg+xml';
        else if (fileName.endsWith('.png')) contentType = 'image/png';
        else if (fileName.endsWith('.json')) contentType = 'application/json';
        
        const fileContent = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': fileContent.length });
        res.end(fileContent);
        return;
      }
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

      const requestId = 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

      // ═══════════════════════════════════════════════════════════════════════
      // 0. FAST-PATH DETERMINISTIC CLASSIFIERS & DIRECT DISPATCH
      // ═══════════════════════════════════════════════════════════════════════
      if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim().length > 0 && !payload.skipIntentGate && !payload._internal) {
        const { semanticIntentEngineInstance } = await import('../agent/SemanticIntentEngine.mjs');
        const sie = semanticIntentEngineInstance;
        const cleanPrompt = sie._normalizeUtterance(userPrompt);

        console.log(`[${requestId}] [INTENT_GATE] Fast-path deterministic classification`);

        const isDocRequest = userPrompt.includes('--- [BERKAS DOKUMEN') ||
          userPrompt.includes('--- [DOKUMEN') ||
          userPrompt.includes('--- [Konteks Dokumen') ||
          /(?:baca\s+ini|baca\s+dokumen|point\s+point|poin\s+poin|outline|rangkum|ringkas|buatkan\s+point)\b/i.test(userPrompt);

        // ═══════════════════════════════════════════════════════════════════════
        // PRIORITY 1: ACTIVE STUDIO CONTINUATION & CREATION GATE
        // Evaluated before any generic classifier or image generator!
        // (Skipped for document reading/summarization contexts)
        // ═══════════════════════════════════════════════════════════════════════
        if (!isDocRequest) {
          try {
            const { studioContinuationRouterInstance } = await import('../studio/core/StudioContinuationRouter.mjs');
            const continuationResult = await studioContinuationRouterInstance.evaluate(cleanPrompt, { messages, requestId });
            if (continuationResult.handled) {
              console.log(`[${requestId}] [STUDIO_CONTINUATION] Handled: ${continuationResult.slideTitle || continuationResult.artifactType || 'CONTINUATION'}`);

              if (isStream) {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
                });
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-continuation-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: (continuationResult.session?.studioType || 'studio').toLowerCase(),
                  choices: [{ index: 0, delta: { content: continuationResult.detailedTextDisplay }, finish_reason: null }]
                })}\n\n`);
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-continuation-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: (continuationResult.session?.studioType || 'studio').toLowerCase(),
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  _agent: {
                    intent: continuationResult.session?.studioType || 'STUDIO',
                    toolsUsed: [continuationResult.session?.studioType === 'DATA_LAB' ? 'data_lab.studio' : continuationResult.session?.studioType === 'ARCHITECTURAL_STUDIO' ? 'architectural.studio' : 'slide.studio'],
                    verificationStatus: 'VERIFIED',
                    cognitive: true,
                    artifactType: continuationResult.artifactType || 'STUDIO_ARTIFACT',
                    slideTitle: continuationResult.slideTitle || null,
                    imageUrl: continuationResult.previewUrl || continuationResult.chartUrl || null,
                    pptxUrl: continuationResult.pptxUrl || null,
                    slideData: continuationResult.slideResult?.schema || null,
                    project: continuationResult.session?.project,
                    studio: continuationResult.session?.studio,
                    slides: continuationResult.session?.slides,
                    dataState: continuationResult.session?.dataState || null
                  }
                })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: 'chatcmpl-continuation-' + Date.now(),
                  object: 'chat.completion',
                  created: Math.floor(Date.now() / 1000),
                  model: (continuationResult.session?.studioType || 'studio').toLowerCase(),
                  choices: [{ index: 0, message: { role: 'assistant', content: continuationResult.detailedTextDisplay }, finish_reason: 'stop' }],
                  _agent: {
                    intent: continuationResult.session?.studioType || 'STUDIO',
                    toolsUsed: [continuationResult.session?.studioType === 'DATA_LAB' ? 'data_lab.studio' : continuationResult.session?.studioType === 'ARCHITECTURAL_STUDIO' ? 'architectural.studio' : 'slide.studio'],
                    verificationStatus: 'VERIFIED',
                    cognitive: true,
                    artifactType: continuationResult.artifactType || 'STUDIO_ARTIFACT',
                    slideTitle: continuationResult.slideTitle || null,
                    imageUrl: continuationResult.previewUrl || continuationResult.chartUrl || null,
                    pptxUrl: continuationResult.pptxUrl || null,
                    slideData: continuationResult.slideResult?.schema || null,
                    project: continuationResult.session?.project,
                    studio: continuationResult.session?.studio,
                    slides: continuationResult.session?.slides,
                    dataState: continuationResult.session?.dataState || null
                  }
                }));
              }
              return;
            }
          } catch (continuationErr) {
            console.warn('[STUDIO_CONTINUATION] Evaluation error:', continuationErr.message);
          }
        }

        const deterministicDecision = isDocRequest
          ? null
          : (sie._slideStudioClassifier(cleanPrompt, []) ||
             sie._architecturalDesignClassifier(cleanPrompt, []) ||
             sie._imageRevisionClassifier(cleanPrompt, messages) ||
             sie._imageGenerationClassifier(cleanPrompt, []));

        if (deterministicDecision) {
          console.log(`[INTENT_GATE] Fast-path hit: intent=${deterministicDecision.intent}`);
          console.log(`[INTENT_GATE] actionRequired=true intent=${deterministicDecision.intent} → ProductionEngine`);

          // 0A. SLIDE STUDIO PATH
          // PRINCIPLE: AI DECIDES → CODE EXECUTES.
          // Multi-slide deck creation (isDeck) is NOT handled here — the deck plan
          // must come from the LLM, not from deterministic code.
          // Only single-slide rendering (no deck count) is handled here.
          if (deterministicDecision.intent === 'SLIDE_STUDIO') {
            try {
              const { slideDeckPlannerInstance } = await import('../studio/slide/SlideDeckPlanner.mjs');
              const deckDetection = slideDeckPlannerInstance.detectDeckRequest(cleanPrompt);

              if (deckDetection.isDeck && deckDetection.count >= 2) {
                // Multi-slide deck: do NOT fabricate a plan.
                // Let the request fall through to the LLM.
                // StudioContinuationRouter has already initialized the session with slidePlan:[].
                console.log(`[INTENT_GATE] Deck creation detected (${deckDetection.count} slides) — passing to LLM for AI deck planning.`);
                // fall through (no return)
              } else {
                // Single-slide: deterministic render from user-provided content
                const { slideStudioInstance } = await import('../studio/slide/SlideStudio.mjs');
                const slideResult = await slideStudioInstance.createSlide(cleanPrompt);
                const pptxUrl = `/artifacts/slides/${path.basename(slideResult.files.pptx.path)}`;
                const previewUrl = `/artifacts/slides/${path.basename(slideResult.files.preview.path)}`;
                const slideTitle = `SLIDE MASTER: ${slideResult.title.toUpperCase()}`;
                const detailedTextDisplay = `Berikut adalah **${slideResult.title}** yang telah selesai dirancang:\n\n` +
                  `• **Arketipe Visual**: ${slideResult.slideType}\n` +
                  `• **Format**: 16:9 Widescreen High Definition\n` +
                  `• **Berkas**: Vektor SVG, Pratinjau Gambar, dan Microsoft PowerPoint (.pptx) terpisah\n\n` +
                  `👉 **[Unduh Berkas PowerPoint (.pptx)](${pptxUrl})**\n\n` +
                  `Silakan sampaikan catatan jika Anda ingin mengubah bagian tertentu pada slide ini.`;

                if (isStream) {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                  });
                  res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-slide-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'slide_studio',
                    choices: [{ index: 0, delta: { content: detailedTextDisplay }, finish_reason: null }]
                  })}\n\n`);
                  res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-slide-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'slide_studio',
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                    _agent: {
                      intent: 'SLIDE_STUDIO',
                      toolsUsed: ['slide.studio'],
                      verificationStatus: 'VERIFIED',
                      cognitive: true,
                      artifactType: 'SLIDE_ARTIFACT',
                      slideTitle,
                      imageUrl: previewUrl,
                      pptxUrl,
                      slideData: slideResult.schema
                    }
                  })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                } else {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    id: 'chatcmpl-slide-' + Date.now(),
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: 'slide_studio',
                    choices: [{ index: 0, message: { role: 'assistant', content: detailedTextDisplay }, finish_reason: 'stop' }],
                    _agent: {
                      intent: 'SLIDE_STUDIO',
                      toolsUsed: ['slide.studio'],
                      verificationStatus: 'VERIFIED',
                      cognitive: true,
                      artifactType: 'SLIDE_ARTIFACT',
                      slideTitle,
                      imageUrl: previewUrl,
                      pptxUrl,
                      slideData: slideResult.schema
                    }
                  }));
                }
                return;
              }
            } catch (slideErr) {
              console.error('[INTENT_GATE] SlideStudio execution error:', slideErr.message);
              if (isStream && res.headersSent) {
                try {
                  res.write('data: [DONE]\n\n');
                  res.end();
                } catch (e) {}
              }
              // Fall through to other handlers
            }
          }

          // 0B. ARCHITECTURAL STUDIO PATH
          if (deterministicDecision.intent === 'ARCHITECTURAL_DESIGN') {
            try {
              const { architecturalStudioInstance } = await import('../studio/architectural/ArchitecturalStudio.mjs');
              const { masterDesignStateInstance } = await import('../studio/architectural/MasterDesignState.mjs');

              const activeProject = masterDesignStateInstance.getState();
              const isApproval = /^(setuju|approve|lanjutkan|ok\s+lanjut|produksi\s+semua|buatkan\s+gambarnya)\b/i.test(cleanPrompt);
              const isRevision = /^(geser|ubah|pindahkan|tambah|ganti|revisi)\b/i.test(cleanPrompt);

              let responseText = '';
              let agentPayload = {};

              if (activeProject && isApproval) {
                masterDesignStateInstance.approveMasterDraft();
                const productionResult = await architecturalStudioInstance.produceAllSteps();
                
                responseText = `### 🏛️ Proyek Rancang Bangun Arsitektur: Produksi Visual Selesai\n\n` +
                  `Master Design Draft telah disetujui. Seluruh 8 langkah visual rancang bangun telah diproduksi secara mandiri (1 Komponen = 1 Artifact Terpisah):\n\n` +
                  `1. **[STEP 01: Denah Tata Ruang (Lt 1 & 2)](/artifacts/architecture/STEP_01_DENAH.svg)** (Kode: AR-01)\n` +
                  `2. **[STEP 02: Rangka Struktur & Grid As Kolom](/artifacts/architecture/STEP_02_STRUKTUR.svg)** (Kode: ST-02)\n` +
                  `3. **[STEP 03: Tampak Fasad Depan](/artifacts/architecture/STEP_03_TAMPAK_DEPAN.svg)** (Kode: AR-03)\n` +
                  `4. **[STEP 04: Tampak Samping Kiri](/artifacts/architecture/STEP_04_TAMPAK_KIRI.svg)** (Kode: AR-04)\n` +
                  `5. **[STEP 05: Tampak Samping Kanan](/artifacts/architecture/STEP_05_TAMPAK_KANAN.svg)** (Kode: AR-05)\n` +
                  `6. **[STEP 06: Tampak Fasad Belakang Pool](/artifacts/architecture/STEP_06_TAMPAK_BELAKANG.svg)** (Kode: AR-06)\n` +
                  `7. **[STEP 07: 3D Perspektif Eksterior](/artifacts/architecture/STEP_07_MODEL_3D.svg)** (Kode: 3D-07)\n` +
                  `8. **[STEP 08: 3D Hologram Spatial HUD](/artifacts/architecture/STEP_08_HOLOGRAM_3D.svg)** (Kode: HUD-08)\n\n` +
                  `*Audit Konsistensi QA: Skor ${productionResult.qaReport.score}/100 (${productionResult.qaReport.passed ? 'PASSED' : 'CHECK'})*\n` +
                  `Seluruh geometri, bukaan jendela/pintu, dan koordinat as kolom 100% konsisten terhadap MasterDesignState.`;

                agentPayload = {
                  intent: 'ARCHITECTURAL_DESIGN',
                  action: 'PRODUCE_ALL',
                  artifacts: productionResult.artifacts,
                  qaReport: productionResult.qaReport
                };
              } else if (activeProject && isRevision) {
                const revResult = architecturalStudioInstance.applyRevision(cleanPrompt);
                responseText = `### 🔄 Revisi Desain Arsitektur Diterapkan\n\n` +
                  `Instruksi: *"${cleanPrompt}"*\n\n` +
                  `• **Komponen Terdampak**: ${revResult.evaluation.affectedComponents.join(', ')}\n` +
                  `• **Status State**: Komponen terkait ditandai \`UPDATE_REQUIRED\` untuk menjaga integritas geometri.\n` +
                  `• **Tindakan**: MasterDesignState telah diperbarui. Ketik **'Lanjutkan'** untuk memutakhirkan gambar terkait.`;

                agentPayload = {
                  intent: 'ARCHITECTURAL_DESIGN',
                  action: 'REVISION',
                  revision: revResult
                };
              } else {
                const initResult = architecturalStudioInstance.initiateDesignProject(cleanPrompt);
                responseText = initResult.masterDraft + `\n\n---\n` +
                  `💡 **Langkah Selanjutnya**: Silakan tinjau Master Design Draft di atas. Jika konsep, zonasi, dan asumsi telah sesuai, ketik **"Setuju"** atau **"Lanjutkan"** untuk memproduksi 8 gambar visual secara mandiri satu per satu. Anda juga dapat langsung memberikan instruksi revisi (misal: *"geser kamar utama ke belakang"*).`;

                agentPayload = {
                  intent: 'ARCHITECTURAL_DESIGN',
                  action: 'MASTER_DRAFT',
                  projectId: initResult.projectId,
                  state: initResult.state
                };
              }

              if (isStream) {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
                });
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-arch-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'architectural_studio',
                  choices: [{ index: 0, delta: { content: responseText }, finish_reason: null }]
                })}\n\n`);
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-arch-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'architectural_studio',
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  _agent: {
                    ...agentPayload,
                    toolsUsed: ['architectural.studio'],
                    verificationStatus: 'VERIFIED',
                    cognitive: true,
                    artifactType: 'ARCHITECTURAL_BLUEPRINT'
                  }
                })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: 'chatcmpl-arch-' + Date.now(),
                  object: 'chat.completion',
                  created: Math.floor(Date.now() / 1000),
                  model: 'architectural_studio',
                  choices: [{ index: 0, message: { role: 'assistant', content: responseText }, finish_reason: 'stop' }],
                  _agent: {
                    ...agentPayload,
                    toolsUsed: ['architectural.studio'],
                    verificationStatus: 'VERIFIED',
                    cognitive: true,
                    artifactType: 'ARCHITECTURAL_BLUEPRINT'
                  }
                }));
              }
              return;
            } catch (archErr) {
              console.error('[INTENT_GATE] ArchitecturalStudio execution error:', archErr.message);
            }
          }

          try {
            const { imageGenerationInstance } = await import('../agent/ImageGeneration.mjs');
            const { jinResponseEngineInstance } = await import('../agent/JINResponseEngine.mjs');

            const visualIntent = deterministicDecision.visualIntent || {};
            let referenceImage = deterministicDecision.referenceImage || visualIntent.referenceImage || sie._findLastVisualAsset(messages) || null;
            if (referenceImage && typeof referenceImage === 'string') {
              referenceImage = referenceImage.replace(/^https?:\/\/[^\/]+/i, '');
            }

            const clientRequestId = payload.generationId || payload.messageId || req.headers['x-request-id'] || null;
            const isRevision = deterministicDecision.intent === 'IMAGE_REVISION';
            const modElements = visualIntent.modifyElements || [];
            const modification = modElements.join(', ') || 'nighttime';
            const semanticKey = `${isRevision ? 'rev' : 'gen'}:${referenceImage || 'none'}:${cleanPrompt.toLowerCase().replace(/\s+/g, ' ').trim()}`;
            const requestId = clientRequestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

            if (isRevision) {
              console.log(`[IMAGE_REVISION] requestId=${requestId}`);
              console.log(`[IMAGE_REVISION] referenceImage=${referenceImage}`);
              console.log(`[IMAGE_REVISION] modification=${modification}`);
            }

            // IDEMPOTENCY GUARD: One request/message ID or semantic key -> at most one image generation
            pruneRecentImageExecutions();
            let cached = (clientRequestId && recentImageExecutions.get(clientRequestId)) || recentImageExecutions.get(semanticKey);

            if (cached) {
              let cachedEntry = cached;
              if (cached.status === 'IN_PROGRESS' && cached.inFlightPromise) {
                if (isRevision) {
                  console.log(`[IMAGE_REVISION] execution=SKIP_DUPLICATE`);
                } else {
                  console.log(`[INTENT_GATE] execution=SKIP_DUPLICATE requestId=${requestId}`);
                }
                cachedEntry = await cached.inFlightPromise;
              }

              if (cachedEntry && cachedEntry.artifact) {
                if (isRevision) {
                  console.log(`[IMAGE_REVISION] execution=SKIP_DUPLICATE`);
                } else {
                  console.log(`[INTENT_GATE] execution=SKIP_DUPLICATE requestId=${requestId}`);
                }

                if (payload.stream) {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                  });
                  const responseText = cachedEntry.responseText || (cleanPrompt ? `Visual untuk ${cleanPrompt.slice(0, 60)} telah selesai disiapkan.` : 'Visual telah selesai disiapkan.');
                  res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-direct-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'direct_image_pipeline',
                    choices: [{ index: 0, delta: { content: responseText }, finish_reason: null }]
                  })}\n\n`);
                  const cachedToolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                  const cachedStrictVerified = isRevision
                    ? Boolean(cachedEntry.artifact && cachedEntry.artifact.parentArtifactId && cachedEntry.artifact.renderable !== false)
                    : Boolean(cachedEntry.artifact && cachedEntry.artifact.renderable !== false);

                  res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-direct-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'direct_image_pipeline',
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                    _agent: {
                      intent: deterministicDecision.intent,
                      toolsUsed: cachedToolsUsed,
                      verificationStatus: cachedStrictVerified ? 'VERIFIED' : 'FAILED',
                      cognitive: true,
                      artifactType: 'IMAGE',
                      presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                      visualIntent: visualIntent,
                      imageUrl: cachedEntry.artifact.url || null,
                      generationId: payload.generationId || null,
                      messageId: payload.messageId || null,
                      imageRenderable: true
                    }
                  })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                } else {
                  const cachedToolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                  const cachedStrictVerified = isRevision
                    ? Boolean(cachedEntry.artifact && cachedEntry.artifact.parentArtifactId && cachedEntry.artifact.renderable !== false)
                    : Boolean(cachedEntry.artifact && cachedEntry.artifact.renderable !== false);

                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    id: 'chatcmpl-direct-' + Date.now(),
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: 'direct_image_pipeline',
                    choices: [{ index: 0, message: { role: 'assistant', content: cachedEntry.responseText || 'Visual telah dibuat.' }, finish_reason: 'stop' }],
                    _agent: {
                      intent: deterministicDecision.intent,
                      toolsUsed: cachedToolsUsed,
                      verificationStatus: cachedStrictVerified ? 'VERIFIED' : 'FAILED',
                      cognitive: true,
                      artifactType: 'IMAGE',
                      presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                      visualIntent: visualIntent,
                      imageUrl: cachedEntry.artifact.url || null,
                      generationId: payload.generationId || null,
                      messageId: payload.messageId || null,
                      imageRenderable: true
                    }
                  }));
                }
                return;
              }
            }

            if (isRevision) {
              console.log(`[IMAGE_REVISION] execution=START`);
            }

            // Register in-flight execution in cache
            let resolveInFlight;
            const inFlightPromise = new Promise((resolve) => { resolveInFlight = resolve; });
            const inProgressEntry = {
              timestamp: Date.now(),
              status: 'IN_PROGRESS',
              inFlightPromise
            };
            if (clientRequestId) recentImageExecutions.set(clientRequestId, inProgressEntry);
            recentImageExecutions.set(requestId, inProgressEntry);
            recentImageExecutions.set(semanticKey, inProgressEntry);

            const imagePrompt = visualIntent.providerPrompt || cleanPrompt;

            console.log(`[INTENT_GATE] Direct image generation: ${deterministicDecision.intent}`);

            let imageResult;
            if (isRevision) {
              console.log(`[IMAGE_REVISION_DISPATCH] path=ImageEditing`);
              let referenceUserPrompt = '';
              for (let i = messages.length - 1; i >= 0; i--) {
                const m = messages[i];
                if (m && m.role === 'user') {
                  const txt = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map(p => p.text || '').join(' ') : '');
                  if (txt && txt.trim() !== userPrompt.trim()) {
                    referenceUserPrompt = txt.trim();
                    break;
                  }
                }
              }
              const { imageEditingInstance } = await import('../agent/ImageEditing.mjs');
              imageResult = await imageEditingInstance.editImage({
                referenceImage,
                prompt: visualIntent.providerPrompt || modification || cleanPrompt,
                originalPrompt: referenceUserPrompt || userPrompt,
                requestId,
                steps: IMAGE_STEPS || 8,
                generationId: payload.generationId || null,
                messageId: payload.messageId || null
              });
            } else {
              const { imageGenerationInstance, ImageGenerationService } = await import('../agent/ImageGeneration.mjs');
              // Resolve size/aspectRatio from visualIntent or user prompt (e.g. 16:9 for slide/landscape)
              let intentAspectRatio = visualIntent?.aspectRatio;
              if (!intentAspectRatio || intentAspectRatio === '1:1') {
                intentAspectRatio = ImageGenerationService.detectAspectRatio(`${userPrompt} ${cleanPrompt}`, '1:1');
              }
              const intentSize = intentAspectRatio === '9:16' ? '512x912' : '912x512';
              imageResult = await imageGenerationInstance.generateImage({
                prompt: imagePrompt,
                referenceImage: null,
                mode: 'generate',
                visualIntent: {
                  ...visualIntent,
                  aspectRatio: intentAspectRatio,
                  referenceImage: null
                },
                aspectRatio: intentAspectRatio,
                size: intentSize,
                generationId: payload.generationId || null,
                messageId: payload.messageId || null
              });
            }

            if (imageResult.success && imageResult.artifact) {
              if (isRevision) {
                console.log(`[IMAGE_REVISION] execution=COMPLETE artifact=${imageResult.artifact.url}`);
              }
              const responsePayload = isRevision
                ? jinResponseEngineInstance.synthesizeImageRevisionOutcome({
                    userUtterance: userPrompt,
                    decision: deterministicDecision,
                    artifact: imageResult.artifact,
                    verification: { isSatisfied: true, verificationStatus: 'VERIFIED' },
                    evaluation: imageResult.evaluation || imageResult.artifact?.evaluation,
                    provenance: { semanticModel: 'direct_image_pipeline' }
                  })
                : jinResponseEngineInstance.synthesizeImageGenerationOutcome({
                    userUtterance: userPrompt,
                    decision: deterministicDecision,
                    artifact: imageResult.artifact,
                    verification: { isSatisfied: true, verificationStatus: 'VERIFIED' },
                    provenance: { semanticModel: 'direct_image_pipeline' }
                  });

              // Commit to idempotency cache
              const completedEntry = {
                timestamp: Date.now(),
                status: 'COMPLETED',
                artifact: imageResult.artifact,
                responseText: responsePayload.naturalVoiceSpeech
              };
              if (clientRequestId) recentImageExecutions.set(clientRequestId, completedEntry);
              recentImageExecutions.set(requestId, completedEntry);
              recentImageExecutions.set(semanticKey, completedEntry);
              resolveInFlight(completedEntry);

              if (payload.stream) {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
                });

                const responseText = responsePayload.naturalVoiceSpeech || (cleanPrompt ? `Visual untuk ${cleanPrompt.slice(0, 60)} telah selesai disiapkan.` : 'Visual telah selesai disiapkan.');
                const sseChunk = JSON.stringify({
                  id: 'chatcmpl-direct-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, delta: { content: responseText }, finish_reason: null }]
                });
                res.write(`data: ${sseChunk}\n\n`);

                const toolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                const isStrictVerified = Boolean(imageResult.success && verifyImageArtifactCompliance(imageResult.artifact, isRevision));
                const evalStatus = isRevision ? (imageResult.evaluation?.evaluationStatus || 'REVISION_PASS') : 'VERIFIED';

                const finalChunk = JSON.stringify({
                  id: 'chatcmpl-direct-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  _agent: {
                    intent: deterministicDecision.intent,
                    toolsUsed,
                    verificationStatus: isStrictVerified ? 'VERIFIED' : 'FAILED',
                    evaluationStatus: evalStatus,
                    semanticScore: imageResult.evaluation?.semantic?.semanticScore ?? null,
                    evaluation: imageResult.evaluation || null,
                    cognitive: true,
                    artifactType: 'IMAGE',
                    presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                    visualIntent: visualIntent,
                    imageUrl: isStrictVerified ? (imageResult.artifact.url || null) : null,
                    generationId: payload.generationId || null,
                    messageId: payload.messageId || null,
                    imageRenderable: isStrictVerified
                  }
                });
                res.write(`data: ${finalChunk}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                const toolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                const isStrictVerified = Boolean(imageResult.success && verifyImageArtifactCompliance(imageResult.artifact, isRevision));
                const evalStatus = isRevision ? (imageResult.evaluation?.evaluationStatus || 'REVISION_PASS') : 'VERIFIED';

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: 'chatcmpl-direct-' + Date.now(),
                  object: 'chat.completion',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, message: { role: 'assistant', content: responsePayload.naturalVoiceSpeech }, finish_reason: 'stop' }],
                  _agent: {
                    intent: deterministicDecision.intent,
                    toolsUsed,
                    verificationStatus: isStrictVerified ? 'VERIFIED' : 'FAILED',
                    evaluationStatus: evalStatus,
                    semanticScore: imageResult.evaluation?.semantic?.semanticScore ?? null,
                    evaluation: imageResult.evaluation || null,
                    cognitive: true,
                    artifactType: 'IMAGE',
                    presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                    visualIntent: visualIntent,
                    imageUrl: isStrictVerified ? (imageResult.artifact.url || null) : null,
                    generationId: payload.generationId || null,
                    messageId: payload.messageId || null,
                    imageRenderable: isStrictVerified
                  }
                }));
              }

              console.log(`[INTENT_GATE] Direct image success: ${imageResult.artifact.url}`);
              return;
            } else {
              if (clientRequestId) recentImageExecutions.delete(clientRequestId);
              recentImageExecutions.delete(requestId);
              recentImageExecutions.delete(semanticKey);
              resolveInFlight(null);
              console.warn(`[INTENT_GATE] Direct image failed: ${imageResult.error}`);

              let failureText;
              let reasonCode;
              if (isRevision) {
                const failureDetails = resolveRevisionFailureDetails(imageResult);
                reasonCode = failureDetails.reasonCode;
                console.log(`[IMAGE_REVISION] execution=FAILED reason=${reasonCode}`);
                failureText = `Saya belum dapat melakukan revisi gambar saat ini. Penyebab: ${failureDetails.failureReason}`;
              } else {
                failureText = `Pembuatan gambar belum berhasil. Penyebab: ${imageResult.error || 'Provider gambar tidak tersedia.'}`;
              }

              if (payload.stream) {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
                });
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-direct-err-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, delta: { content: failureText }, finish_reason: null }]
                })}\n\n`);
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-direct-err-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  _agent: {
                    intent: deterministicDecision.intent,
                    toolsUsed: [isRevision ? 'image.edit' : 'image.generate'],
                    verificationStatus: 'FAILED',
                    cognitive: true,
                    artifactType: 'IMAGE',
                    imageUrl: null,
                    error: imageResult.error,
                    reasonCode: isRevision ? reasonCode : undefined
                  }
                })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: 'chatcmpl-direct-err-' + Date.now(),
                  object: 'chat.completion',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, message: { role: 'assistant', content: failureText }, finish_reason: 'stop' }],
                  _agent: {
                    intent: deterministicDecision.intent,
                    toolsUsed: [isRevision ? 'image.edit' : 'image.generate'],
                    verificationStatus: 'FAILED',
                    cognitive: true,
                    artifactType: 'IMAGE',
                    imageUrl: null,
                    error: imageResult.error,
                    reasonCode: isRevision ? reasonCode : undefined
                  }
                }));
              }
              return;
            }
          } catch (directErr) {
            console.warn(`[INTENT_GATE] Direct image error: ${directErr.message}`);
            if (isRevision) {
              const failureDetails = resolveRevisionFailureDetails({ error: directErr.message });
              console.log(`[IMAGE_REVISION] execution=FAILED reason=${failureDetails.reasonCode}`);
              const failureText = `Saya belum dapat melakukan revisi gambar saat ini. Penyebab: ${failureDetails.failureReason}`;
              if (payload.stream) {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
                });
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-direct-err-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, delta: { content: failureText }, finish_reason: null }]
                })}\n\n`);
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-direct-err-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  _agent: {
                    intent: deterministicDecision.intent,
                    toolsUsed: ['image.edit'],
                    verificationStatus: 'FAILED',
                    cognitive: true,
                    artifactType: 'IMAGE',
                    imageUrl: null,
                    error: directErr.message,
                    reasonCode: failureDetails.reasonCode
                  }
                })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: 'chatcmpl-direct-err-' + Date.now(),
                  object: 'chat.completion',
                  created: Math.floor(Date.now() / 1000),
                  model: 'direct_image_pipeline',
                  choices: [{ index: 0, message: { role: 'assistant', content: failureText }, finish_reason: 'stop' }],
                  _agent: {
                    intent: deterministicDecision.intent,
                    toolsUsed: ['image.edit'],
                    verificationStatus: 'FAILED',
                    cognitive: true,
                    artifactType: 'IMAGE',
                    imageUrl: null,
                    error: directErr.message,
                    reasonCode: failureDetails.reasonCode
                  }
                }));
              }
              return;
            }
          }
        }
      }

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
          // Guard: NEVER trigger web search if attached document or document reading request is present
          if (userPrompt.includes('--- [BERKAS DOKUMEN') ||
              userPrompt.includes('--- [DOKUMEN') ||
              userPrompt.includes('--- [Konteks Dokumen') ||
              /(?:baca\s+ini|baca\s+dokumen|rangkum|ringkas|point\s+point|poin\s+poin|presentasi|slide|draft\s+presentasi)\b/i.test(userPrompt)) {
            return false;
          }
          const p = userPrompt.toLowerCase();
          if (/\b(apa\s+kabar|bagaimana\s+kabar|how\s+are\s+you)\b/i.test(p)) return false; // Greeting guard

          // Explicit web search command only (Passive knowledge harvesting is handled by CuriosityDaemon at 07, 13, 17, 21 WIB)
          const explicitSearch = /\b(cari\s+di\s+internet|carikan\s+di\s+internet|search\s+the\s+web|searching|browsing|browsingkan|cek\s+internet|lihat\s+internet|buka\s+internet|tavily|googling|gugling)\b/i.test(p);
          if (explicitSearch) return true;

          // Explicit pair: (cari/carikan/cek) + (internet/web/online/situs)
          if (/\b(cari|carikan|cek|temukan)\b/i.test(p) && /\b(internet|web|online|situs)\b/i.test(p)) return true;

          return false;
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
          if (cleanQuery.length > 200) cleanQuery = cleanQuery.slice(0, 200).trim();

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
        ))
      );

      if (!isInternalAgentCall && userPrompt && typeof userPrompt === 'string' && userPrompt.trim().length > 0) {
        try {
          const { semanticIntentEngineInstance } = await import('../agent/SemanticIntentEngine.mjs');
          const sie = semanticIntentEngineInstance;

          // 1. Normalize current user utterance
          const cleanPrompt = sie._normalizeUtterance(userPrompt);

          // 2. Detect document context markers in the merged prompt (injected by ConversationController)
          const hasDocumentMarker = userPrompt.includes('--- [BERKAS DOKUMEN') ||
            userPrompt.includes('--- [DOKUMEN') ||
            userPrompt.includes('--- [Konteks Dokumen');

          // 3. Detect document-analysis user intent in the prompt text
          const isDocAnalysisVerb = /(?:baca|baca\s+dokumen|baca\s+ini|rangkum|ringkas|analisis\s+dokumen|dokumen\s+ini|file\s+ini|pdf\s+ini|ekstrak\s+isi|summary\s+dokumen|buat\s+ringkasan|buat\s+summary)\b/i.test(userPrompt);
          const isDocumentRequest = hasDocumentMarker && isDocAnalysisVerb;

          // 4. Fast-path: slide / image / document (no LLM inference required)
          let deterministicDecision = null;

          if (isDocumentRequest) {
            // Deterministically classify as DOCUMENT_ANALYSIS (actionRequired=true → Document Pipeline)
            deterministicDecision = {
              intent: 'DOCUMENT_ANALYSIS',
              goal: cleanPrompt,
              actionRequired: true,
              toolsNeeded: ['document_pipeline'],
              confidence: 0.99
            };
            console.log(`[INTENT_GATE] Fast-path hit: intent=DOCUMENT_ANALYSIS (document marker + analysis verb detected)`);
          } else {
            // Slide / image classifier — only when no document is attached
            deterministicDecision =
              sie._slideStudioClassifier(cleanPrompt, []) ||
              sie._imageRevisionClassifier(cleanPrompt, messages) ||
              sie._imageGenerationClassifier(cleanPrompt, []) ||
              null;
            if (deterministicDecision) {
              console.log(`[INTENT_GATE] Fast-path hit: intent=${deterministicDecision.intent}`);
            }
          }

          const actionRequired = Boolean(deterministicDecision?.actionRequired);

          if (actionRequired) {
            console.log(`[INTENT_GATE] actionRequired=true intent=${deterministicDecision.intent} → Pipeline`);

            // ══════════════════════════════════════════════════════════════════
            // DOCUMENT ANALYSIS PIPELINE
            // UPLOAD → READING → UNDERSTANDING → ANALYSIS → SYNTHESIS → RESPONSE
            // ══════════════════════════════════════════════════════════════════
            if (deterministicDecision.intent === 'DOCUMENT_ANALYSIS') {
              try {
                const requestId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

                // Extract document text from marker blocks inside userPrompt
                const docBlocks = [];
                const docBlockRE = /--- \[BERKAS DOKUMEN TERLAMPIR: ([^\]]+)\] ---\n([\s\S]*?)\n--- \[AKHIR DOKUMEN: [^\]]+\] ---/g;
                let docMatch;
                while ((docMatch = docBlockRE.exec(userPrompt)) !== null) {
                  docBlocks.push({ fileName: docMatch[1], text: docMatch[2] });
                }
                // Also match generic markers
                const genericBlockRE = /--- \[(?:DOKUMEN|Konteks Dokumen)[^\]]*\] ---\n([\s\S]*?)\n--- \[Akhir[^\]]*\] ---/gi;
                while ((docMatch = genericBlockRE.exec(userPrompt)) !== null) {
                  docBlocks.push({ fileName: 'Dokumen', text: docMatch[1] });
                }

                const primaryDoc = docBlocks[0] || { fileName: 'Dokumen', text: userPrompt };
                const documentText = primaryDoc.text;
                const fileName = primaryDoc.fileName;

                // Extract the user instruction (without the embedded document block)
                const userInstruction = userPrompt
                  .replace(/\n?--- \[BERKAS DOKUMEN TERLAMPIR:[^\]]*\] ---[\s\S]*?--- \[AKHIR DOKUMEN:[^\]]*\] ---/gi, '')
                  .replace(/\n?--- \[(?:DOKUMEN|Konteks Dokumen)[^\]]*\] ---[\s\S]*?--- \[Akhir[^\]]*\] ---/gi, '')
                  .trim();

                const isStreamDoc = Boolean(payload.stream);

                if (isStreamDoc) {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                  });
                }

                // Helper: emit SSE progress status chunk
                const emitStatus = (statusText) => {
                  const chunk = JSON.stringify({
                    id: `chatcmpl-doc-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'document_pipeline',
                    choices: [{ index: 0, delta: { content: statusText }, finish_reason: null }],
                    _docPipeline: { status: statusText, requestId }
                  });
                  if (isStreamDoc && !res.writableEnded) res.write(`data: ${chunk}\n\n`);
                };

                // STAGE 1 — DOCUMENT_READING
                console.log(`[DOCUMENT_PIPELINE] started requestId=${requestId} file="${fileName}"`);
                console.log(`[DOCUMENT_PIPELINE] reading`);
                emitStatus('⏳ Membaca dokumen...');

                const { documentIntelligenceToolInstance } = await import('../tools/DocumentIntelligenceTool.mjs');
                const docResult = await documentIntelligenceToolInstance.execute({
                  documentText,
                  query: userInstruction || cleanPrompt,
                  fileName,
                  mode: 'full_document'
                });

                // STAGE 2 — DOCUMENT_UNDERSTANDING
                console.log(`[DOCUMENT_PIPELINE] understanding chunks=${docResult.totalChunks} coverage=${docResult.coveragePercent}%`);
                emitStatus('🔍 Memahami isi dokumen...');

                // Compile full document context from processed chunks
                const chunkTexts = (docResult.relevantChunks || []).map(c => c.content || '').filter(Boolean);
                const fullDocumentContext = chunkTexts.join('\n\n');

                // STAGE 3 — DOCUMENT_ANALYSIS
                console.log(`[DOCUMENT_PIPELINE] analysis`);
                emitStatus('📊 Menganalisis dokumen...');

                // Build synthesis prompt for LLM
                const systemPromptDoc = [
                  'Kamu adalah JIN, asisten peneliti dengan kemampuan analisis dokumen mendalam.',
                  'Kamu telah menerima keseluruhan isi dokumen yang diproses melalui Document Intelligence Pipeline.',
                  'PRINSIP:',
                  '- Baca dan pahami SELURUH isi dokumen yang diberikan.',
                  '- Jangan pernah menolak dengan alasan tidak bisa membaca dokumen.',
                  '- Berikan analisis mendalam, tidak hanya permukaan.',
                  '- Gunakan format yang jelas dan terstruktur.',
                  '- Sertakan poin-poin utama, temuan penting, dan kesimpulan.'                
                ].join('\n');

                const llmMessages = [
                  { role: 'system', content: systemPromptDoc },
                  {
                    role: 'user',
                    content: `Berikut adalah isi lengkap dokumen "${fileName}" (${docResult.totalChunks} unit semantik, cakupan ${docResult.coveragePercent}%):\n\n${fullDocumentContext}\n\n---\nInstruksi pengguna: ${userInstruction || 'Baca dan buatkan rangkuman lengkap dokumen ini.'}`
                  }
                ];

                // STAGE 4 — DOCUMENT_SYNTHESIS via LLM
                console.log(`[DOCUMENT_PIPELINE] synthesis`);
                emitStatus('✍️ Menyusun rangkuman...');

                // Route to LLM for synthesis
                const { modelRoutingServiceInstance } = await import('./ModelRoutingService.mjs');
                let synthesisText = '';

                const routeRes = await modelRoutingServiceInstance.routeChat(
                  {
                    messages: llmMessages,
                    stream: isStreamDoc,
                    model: 'llamacpp:qwen2.5-3b-instruct-q4_k_m.gguf',
                    temperature: 0.3,
                    maxTokens: 512
                  },
                  (chunk) => {
                    synthesisText += chunk;
                    if (isStreamDoc && !res.writableEnded) {
                      const sseChunk = JSON.stringify({
                        id: `chatcmpl-doc-${Date.now()}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'document_pipeline',
                        choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }]
                      });
                      res.write(`data: ${sseChunk}\n\n`);
                    }
                  }
                );

                if (!synthesisText && routeRes?.content) {
                  synthesisText = routeRes.content;
                }

                // STAGE 5 — COMPLETED
                console.log(`[DOCUMENT_PIPELINE] completed requestId=${requestId} chars=${synthesisText.length}`);
                emitStatus('✅ Rangkuman selesai.');

                if (isStreamDoc && !res.writableEnded) {
                  const finalChunk = JSON.stringify({
                    id: `chatcmpl-doc-final-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'document_pipeline',
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                    _agent: {
                      intent: 'DOCUMENT_ANALYSIS',
                      toolsUsed: ['doc.analyze', 'document_pipeline'],
                      verificationStatus: 'VERIFIED',
                      cognitive: true,
                      artifactType: 'DOCUMENT_ANALYSIS',
                      docMeta: {
                        fileName,
                        totalChunks: docResult.totalChunks,
                        coveragePercent: docResult.coveragePercent,
                        requestId
                      }
                    }
                  });
                  res.write(`data: ${finalChunk}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                } else if (!isStreamDoc) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    id: `chatcmpl-doc-final-${Date.now()}`,
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: 'document_pipeline',
                    choices: [{ index: 0, message: { role: 'assistant', content: synthesisText }, finish_reason: 'stop' }],
                    _agent: {
                      intent: 'DOCUMENT_ANALYSIS',
                      toolsUsed: ['doc.analyze', 'document_pipeline'],
                      verificationStatus: 'VERIFIED',
                      cognitive: true,
                      artifactType: 'DOCUMENT_ANALYSIS'
                    }
                  }));
                }
                return;
              } catch (docPipelineErr) {
                console.error('[DOCUMENT_PIPELINE] error:', docPipelineErr.message);
                // Fall through to standard LLM stream on error
              }
            }

            // DIRECT SLIDE STUDIO PATH — programmatic vector & PPTX presentation
            // PRINCIPLE: AI DECIDES → CODE EXECUTES.
            // Multi-slide deck creation: deck plan must come from the LLM, not from code.
            if (deterministicDecision.intent === 'SLIDE_STUDIO') {
              try {
                const { slideDeckPlannerInstance } = await import('../studio/slide/SlideDeckPlanner.mjs');
                const deckDetection = slideDeckPlannerInstance.detectDeckRequest(cleanPrompt);

                if (deckDetection.isDeck && deckDetection.count >= 2) {
                  // Multi-slide deck: do NOT fabricate a plan.
                  // Fall through to LLM for AI-driven deck planning.
                  console.log(`[INTENT_GATE][DIRECT] Deck creation (${deckDetection.count} slides) — passing to LLM.`);
                  // fall through (no return)
                } else {
                  // Single-slide: deterministic render from user-provided content
                  const { slideStudioInstance } = await import('../studio/slide/SlideStudio.mjs');
                  const slideResult = await slideStudioInstance.createSlide(cleanPrompt);
                  const pptxUrl = `/artifacts/slides/${path.basename(slideResult.files.pptx.path)}`;
                  const previewUrl = `/artifacts/slides/${path.basename(slideResult.files.preview.path)}`;
                  const slideTitle = `SLIDE MASTER: ${slideResult.title.toUpperCase()}`;
                  const detailedTextDisplay = `Berikut adalah **${slideResult.title}** yang telah selesai dirancang:\n\n` +
                    `• **Arketipe Visual**: ${slideResult.slideType}\n` +
                    `• **Format**: 16:9 Widescreen High Definition\n` +
                    `• **Berkas**: Vektor SVG, Pratinjau Gambar, dan Microsoft PowerPoint (.pptx) terpisah\n\n` +
                    `👉 **[Unduh Berkas PowerPoint (.pptx)](${pptxUrl})**\n\n` +
                    `Silakan sampaikan catatan jika Anda ingin mengubah bagian tertentu pada slide ini.`;

                  if (isStream) {
                    res.writeHead(200, {
                      'Content-Type': 'text/event-stream',
                      'Cache-Control': 'no-cache',
                      'Connection': 'keep-alive'
                    });
                    res.write(`data: ${JSON.stringify({
                      id: 'chatcmpl-slide-' + Date.now(),
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'slide_studio',
                      choices: [{ index: 0, delta: { content: detailedTextDisplay }, finish_reason: null }]
                    })}\n\n`);
                    res.write(`data: ${JSON.stringify({
                      id: 'chatcmpl-slide-' + Date.now(),
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'slide_studio',
                      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                      _agent: {
                        intent: 'SLIDE_STUDIO',
                        toolsUsed: ['slide.studio'],
                        verificationStatus: 'VERIFIED',
                        cognitive: true,
                        artifactType: 'SLIDE_ARTIFACT',
                        slideTitle,
                        imageUrl: previewUrl,
                        pptxUrl,
                        slideData: slideResult.schema
                      }
                    })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                  } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      id: 'chatcmpl-slide-' + Date.now(),
                      object: 'chat.completion',
                      created: Math.floor(Date.now() / 1000),
                      model: 'slide_studio',
                      choices: [{ index: 0, message: { role: 'assistant', content: detailedTextDisplay }, finish_reason: 'stop' }],
                      _agent: {
                        intent: 'SLIDE_STUDIO',
                        toolsUsed: ['slide.studio'],
                        verificationStatus: 'VERIFIED',
                        cognitive: true,
                        artifactType: 'SLIDE_ARTIFACT',
                        slideTitle,
                        imageUrl: previewUrl,
                        pptxUrl,
                        slideData: slideResult.schema
                      }
                    }));
                  }
                  return;
                }
              } catch (slideErr) {
                console.error('[INTENT_GATE] SlideStudio execution error:', slideErr.message);
              }
            }

            // DIRECT ARCHITECTURAL STUDIO PATH
            if (deterministicDecision.intent === 'ARCHITECTURAL_DESIGN') {
              try {
                const { architecturalStudioInstance } = await import('../studio/architectural/ArchitecturalStudio.mjs');
                const { masterDesignStateInstance } = await import('../studio/architectural/MasterDesignState.mjs');

                const activeProject = masterDesignStateInstance.getState();
                const isApproval = /^(setuju|approve|lanjutkan|ok\s+lanjut|produksi\s+semua|buatkan\s+gambarnya)\b/i.test(cleanPrompt);
                const isRevision = /^(geser|ubah|pindahkan|tambah|ganti|revisi)\b/i.test(cleanPrompt);

                let responseText = '';
                let agentPayload = {};

                if (activeProject && isApproval) {
                  masterDesignStateInstance.approveMasterDraft();
                  const productionResult = await architecturalStudioInstance.produceAllSteps();
                  
                  responseText = `### 🏛️ Proyek Rancang Bangun Arsitektur: Produksi Visual Selesai\n\n` +
                    `Master Design Draft telah disetujui. Seluruh 8 langkah visual rancang bangun telah diproduksi secara mandiri (1 Komponen = 1 Artifact Terpisah):\n\n` +
                    `1. **[STEP 01: Denah Tata Ruang (Lt 1 & 2)](/artifacts/architecture/STEP_01_DENAH.svg)** (Kode: AR-01)\n` +
                    `2. **[STEP 02: Rangka Struktur & Grid As Kolom](/artifacts/architecture/STEP_02_STRUKTUR.svg)** (Kode: ST-02)\n` +
                    `3. **[STEP 03: Tampak Fasad Depan](/artifacts/architecture/STEP_03_TAMPAK_DEPAN.svg)** (Kode: AR-03)\n` +
                    `4. **[STEP 04: Tampak Samping Kiri](/artifacts/architecture/STEP_04_TAMPAK_KIRI.svg)** (Kode: AR-04)\n` +
                    `5. **[STEP 05: Tampak Samping Kanan](/artifacts/architecture/STEP_05_TAMPAK_KANAN.svg)** (Kode: AR-05)\n` +
                    `6. **[STEP 06: Tampak Fasad Belakang Pool](/artifacts/architecture/STEP_06_TAMPAK_BELAKANG.svg)** (Kode: AR-06)\n` +
                    `7. **[STEP 07: 3D Perspektif Eksterior](/artifacts/architecture/STEP_07_MODEL_3D.svg)** (Kode: 3D-07)\n` +
                    `8. **[STEP 08: 3D Hologram Spatial HUD](/artifacts/architecture/STEP_08_HOLOGRAM_3D.svg)** (Kode: HUD-08)\n\n` +
                    `*Audit Konsistensi QA: Skor ${productionResult.qaReport.score}/100 (${productionResult.qaReport.passed ? 'PASSED' : 'CHECK'})*\n` +
                    `Seluruh geometri, bukaan jendela/pintu, dan koordinat as kolom 100% konsisten terhadap MasterDesignState.`;

                  agentPayload = {
                    intent: 'ARCHITECTURAL_DESIGN',
                    action: 'PRODUCE_ALL',
                    artifacts: productionResult.artifacts,
                    qaReport: productionResult.qaReport
                  };
                } else if (activeProject && isRevision) {
                  const revResult = architecturalStudioInstance.applyRevision(cleanPrompt);
                  responseText = `### 🔄 Revisi Desain Arsitektur Diterapkan\n\n` +
                    `Instruksi: *"${cleanPrompt}"*\n\n` +
                    `• **Komponen Terdampak**: ${revResult.evaluation.affectedComponents.join(', ')}\n` +
                    `• **Status State**: Komponen terkait ditandai \`UPDATE_REQUIRED\` untuk menjaga integritas geometri.\n` +
                    `• **Tindakan**: MasterDesignState telah diperbarui. Ketik **'Lanjutkan'** untuk memutakhirkan gambar terkait.`;

                  agentPayload = {
                    intent: 'ARCHITECTURAL_DESIGN',
                    action: 'REVISION',
                    revision: revResult
                  };
                } else {
                  const initResult = architecturalStudioInstance.initiateDesignProject(cleanPrompt);
                  responseText = initResult.masterDraft + `\n\n---\n` +
                    `💡 **Langkah Selanjutnya**: Silakan tinjau Master Design Draft di atas. Jika konsep, zonasi, dan asumsi telah sesuai, ketik **"Setuju"** atau **"Lanjutkan"** untuk memproduksi 8 gambar visual secara mandiri satu per satu. Anda juga dapat langsung memberikan instruksi revisi (misal: *"geser kamar utama ke belakang"*).`;

                  agentPayload = {
                    intent: 'ARCHITECTURAL_DESIGN',
                    action: 'MASTER_DRAFT',
                    projectId: initResult.projectId,
                    state: initResult.state
                  };
                }

                if (isStream) {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                  });
                  res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-arch-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'architectural_studio',
                    choices: [{ index: 0, delta: { content: responseText }, finish_reason: null }]
                  })}\n\n`);
                  res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-arch-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'architectural_studio',
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                    _agent: {
                      ...agentPayload,
                      toolsUsed: ['architectural.studio'],
                      verificationStatus: 'VERIFIED',
                      cognitive: true,
                      artifactType: 'ARCHITECTURAL_BLUEPRINT'
                    }
                  })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                } else {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    id: 'chatcmpl-arch-' + Date.now(),
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: 'architectural_studio',
                    choices: [{ index: 0, message: { role: 'assistant', content: responseText }, finish_reason: 'stop' }],
                    _agent: {
                      ...agentPayload,
                      toolsUsed: ['architectural.studio'],
                      verificationStatus: 'VERIFIED',
                      cognitive: true,
                      artifactType: 'ARCHITECTURAL_BLUEPRINT'
                    }
                  }));
                }
                return;
              } catch (archErr) {
                console.error('[INTENT_GATE] ArchitecturalStudio execution error:', archErr.message);
              }
            }

            // DIRECT IMAGE GENERATION PATH - bypass Ollama / LLMs entirely
            if (deterministicDecision.intent === 'IMAGE_GENERATION' || deterministicDecision.intent === 'IMAGE_REVISION') {
              try {
                const { imageGenerationInstance } = await import('../agent/ImageGeneration.mjs');
                const { jinResponseEngineInstance } = await import('../agent/JINResponseEngine.mjs');

                const visualIntent = deterministicDecision.visualIntent || {};
                let referenceImage = deterministicDecision.referenceImage || visualIntent.referenceImage || sie._findLastVisualAsset(messages) || null;
                if (referenceImage && typeof referenceImage === 'string') {
                  referenceImage = referenceImage.replace(/^https?:\/\/[^\/]+/i, '');
                }

                const clientRequestId = payload.generationId || payload.messageId || req.headers['x-request-id'] || null;
                const isRevision = deterministicDecision.intent === 'IMAGE_REVISION';
                const modElements = visualIntent.modifyElements || [];
                const modification = modElements.join(', ') || 'nighttime';
                const semanticKey = `${isRevision ? 'rev' : 'gen'}:${referenceImage || 'none'}:${cleanPrompt.toLowerCase().replace(/\s+/g, ' ').trim()}`;
                const requestId = clientRequestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

                if (isRevision) {
                  console.log(`[IMAGE_REVISION] requestId=${requestId}`);
                  console.log(`[IMAGE_REVISION] referenceImage=${referenceImage}`);
                  console.log(`[IMAGE_REVISION] modification=${modification}`);
                }

                // IDEMPOTENCY GUARD: One request/message ID or semantic key -> at most one image generation
                pruneRecentImageExecutions();
                let cached = (clientRequestId && recentImageExecutions.get(clientRequestId)) || recentImageExecutions.get(semanticKey);

                if (cached) {
                  let cachedEntry = cached;
                  if (cached.status === 'IN_PROGRESS' && cached.inFlightPromise) {
                    if (isRevision) {
                      console.log(`[IMAGE_REVISION] execution=SKIP_DUPLICATE`);
                    } else {
                      console.log(`[INTENT_GATE] execution=SKIP_DUPLICATE requestId=${requestId}`);
                    }
                    cachedEntry = await cached.inFlightPromise;
                  }

                  if (cachedEntry && cachedEntry.artifact) {
                    if (isRevision) {
                      console.log(`[IMAGE_REVISION] execution=SKIP_DUPLICATE`);
                    } else {
                      console.log(`[INTENT_GATE] execution=SKIP_DUPLICATE requestId=${requestId}`);
                    }
                    intentGateRouted = true;

                    if (payload.stream) {
                      res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                      });
                      const responseText = cachedEntry.responseText || (cleanPrompt ? `Visual untuk ${cleanPrompt.slice(0, 60)} telah selesai disiapkan.` : 'Visual telah selesai disiapkan.');
                      res.write(`data: ${JSON.stringify({
                        id: 'chatcmpl-direct-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'direct_image_pipeline',
                        choices: [{ index: 0, delta: { content: responseText }, finish_reason: null }]
                      })}\n\n`);
                      const cachedToolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                      const cachedStrictVerified = isRevision
                        ? Boolean(cachedEntry.artifact && cachedEntry.artifact.parentArtifactId && cachedEntry.artifact.renderable !== false)
                        : Boolean(cachedEntry.artifact && cachedEntry.artifact.renderable !== false);

                      res.write(`data: ${JSON.stringify({
                        id: 'chatcmpl-direct-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'direct_image_pipeline',
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                        _agent: {
                          intent: deterministicDecision.intent,
                          toolsUsed: cachedToolsUsed,
                          verificationStatus: cachedStrictVerified ? 'VERIFIED' : 'FAILED',
                          cognitive: true,
                          artifactType: 'IMAGE',
                          presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                          visualIntent: visualIntent,
                          imageUrl: cachedEntry.artifact.url || null,
                          generationId: payload.generationId || null,
                          messageId: payload.messageId || null,
                          imageRenderable: true
                        }
                      })}\n\n`);
                      res.write('data: [DONE]\n\n');
                      res.end();
                    } else {
                      const cachedToolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                      const cachedStrictVerified = isRevision
                        ? Boolean(cachedEntry.artifact && cachedEntry.artifact.parentArtifactId && cachedEntry.artifact.renderable !== false)
                        : Boolean(cachedEntry.artifact && cachedEntry.artifact.renderable !== false);

                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({
                        id: 'chatcmpl-direct-' + Date.now(),
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: 'direct_image_pipeline',
                        choices: [{ index: 0, message: { role: 'assistant', content: cachedEntry.responseText || 'Visual telah dibuat.' }, finish_reason: 'stop' }],
                        _agent: {
                          intent: deterministicDecision.intent,
                          toolsUsed: cachedToolsUsed,
                          verificationStatus: cachedStrictVerified ? 'VERIFIED' : 'FAILED',
                          cognitive: true,
                          artifactType: 'IMAGE',
                          presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                          visualIntent: visualIntent,
                          imageUrl: cachedEntry.artifact.url || null,
                          generationId: payload.generationId || null,
                          messageId: payload.messageId || null,
                          imageRenderable: true
                        }
                      }));
                    }
                    return;
                  }
                }

                if (isRevision) {
                  console.log(`[IMAGE_REVISION] execution=START`);
                }

                // Register pending execution in cache
                let resolveInFlight;
                const inFlightPromise = new Promise((resolve) => { resolveInFlight = resolve; });
                const inProgressEntry = {
                  timestamp: Date.now(),
                  status: 'IN_PROGRESS',
                  inFlightPromise
                };
                if (clientRequestId) recentImageExecutions.set(clientRequestId, inProgressEntry);
                recentImageExecutions.set(requestId, inProgressEntry);
                recentImageExecutions.set(semanticKey, inProgressEntry);

                const imagePrompt = enrichContextualImagePrompt(visualIntent.providerPrompt || cleanPrompt, messages);

                console.log(`[INTENT_GATE] Direct image generation: ${deterministicDecision.intent}`);

                let imageResult;
                if (isRevision) {
                  console.log(`[IMAGE_REVISION_DISPATCH] path=ImageEditing`);
                  let referenceUserPrompt = '';
                  for (let i = messages.length - 1; i >= 0; i--) {
                    const m = messages[i];
                    if (m && m.role === 'user') {
                      const txt = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map(p => p.text || '').join(' ') : '');
                      if (txt && txt.trim() !== userPrompt.trim()) {
                        referenceUserPrompt = txt.trim();
                        break;
                      }
                    }
                  }
                  imageResult = await imageEditingInstance.editImage({
                    referenceImage,
                    prompt: visualIntent.providerPrompt || modification || cleanPrompt,
                    originalPrompt: referenceUserPrompt || userPrompt,
                    requestId,
                    steps: IMAGE_STEPS || 8,
                    generationId: payload.generationId || null,
                    messageId: payload.messageId || null
                  });
                } else {
                  let imagePrompt = visualIntent.providerPrompt || cleanPrompt;

                  // ── CONTEXT-AWARE PROMPT ENRICHMENT ──
                  // When user says e.g. "buat visual slide 1" or "visualkan slide ini",
                  // resolve the full slide content / context from the preceding conversation.
                  const slideMatch = (userPrompt || cleanPrompt).match(/\bslide\s+(\d+)\b/i);
                  if (slideMatch && Array.isArray(messages)) {
                    const slideNum = slideMatch[1];
                    for (let i = messages.length - 1; i >= 0; i--) {
                      const msg = messages[i];
                      if (msg && msg.role === 'assistant') {
                        const content = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(p => p.text || '').join(' ') : '');
                        const pattern = new RegExp(`(?:###|\\*\\*)\\s*Slide\\s+${slideNum}[:\\s*]+([\\s\\S]*?)(?=(?:###|\\*\\*)\\s*Slide\\s+\\d+|$)`, 'i');
                        const m = content.match(pattern);
                        if (m && m[1]) {
                          const slideSnippet = m[1].replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 450);
                          imagePrompt = `Visual presentasi Slide ${slideNum}: ${slideSnippet}. Professional enterprise presentation visual, clean, modern high quality 16:9 layout.`;
                          console.log(`[INTENT_GATE] Context-aware slide enrichment: Slide ${slideNum} -> "${imagePrompt.slice(0, 100)}..."`);
                          break;
                        }
                      }
                    }
                  } else if (/(?:visualkan|buatkan visual|gambar|ilustrasi)\s+(?:nya|dokumen|ini|tadi)\b/i.test(userPrompt || cleanPrompt) && Array.isArray(messages)) {
                    // Context enrichment for generic "visualkan ini / tadi"
                    for (let i = messages.length - 1; i >= 0; i--) {
                      const msg = messages[i];
                      if (msg && msg.role === 'assistant') {
                        const content = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(p => p.text || '').join(' ') : '');
                        if (content && content.length > 50) {
                          const firstSection = content.slice(0, 350).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                          imagePrompt = `Visual representasi konsep: ${firstSection}. Modern professional enterprise presentation graphic.`;
                          console.log(`[INTENT_GATE] Context-aware conversation enrichment -> "${imagePrompt.slice(0, 100)}..."`);
                          break;
                        }
                      }
                    }
                  }

                  const { ImageGenerationService } = await import('../agent/ImageGeneration.mjs');
                  // Resolve size/aspectRatio from visualIntent or prompt
                  let intentAspectRatio2 = visualIntent?.aspectRatio;
                  if (!intentAspectRatio2 || intentAspectRatio2 === '1:1') {
                    intentAspectRatio2 = ImageGenerationService.detectAspectRatio(`${userPrompt} ${cleanPrompt}`, '1:1');
                  }
                  const intentSize2 = intentAspectRatio2 === '9:16' ? '512x912' : '912x512';
                  imageResult = await imageGenerationInstance.generateImage({
                    prompt: imagePrompt,
                    referenceImage: null,
                    mode: 'generate',
                    visualIntent: {
                      ...visualIntent,
                      aspectRatio: intentAspectRatio2,
                      referenceImage: null
                    },
                    aspectRatio: intentAspectRatio2,
                    size: intentSize2,
                    generationId: payload.generationId || null,
                    messageId: payload.messageId || null,
                    requestId
                  });
                }

                if (imageResult.success && imageResult.artifact) {
                  if (isRevision) {
                    console.log(`[IMAGE_REVISION] execution=COMPLETE artifact=${imageResult.artifact.url}`);
                  }
                  const responsePayload = isRevision
                    ? jinResponseEngineInstance.synthesizeImageRevisionOutcome({
                        userUtterance: userPrompt,
                        decision: deterministicDecision,
                        artifact: imageResult.artifact,
                        verification: { isSatisfied: true, verificationStatus: 'VERIFIED' },
                        evaluation: imageResult.evaluation || imageResult.artifact?.evaluation,
                        provenance: { semanticModel: 'direct_image_pipeline' }
                      })
                    : jinResponseEngineInstance.synthesizeImageGenerationOutcome({
                        userUtterance: userPrompt,
                        decision: deterministicDecision,
                        artifact: imageResult.artifact,
                        verification: { isSatisfied: true, verificationStatus: 'VERIFIED' },
                        provenance: { semanticModel: 'direct_image_pipeline' }
                      });

                  // Commit to idempotency cache
                  const completedEntry = {
                    timestamp: Date.now(),
                    status: 'COMPLETED',
                    artifact: imageResult.artifact,
                    responseText: responsePayload.naturalVoiceSpeech
                  };
                  if (clientRequestId) recentImageExecutions.set(clientRequestId, completedEntry);
                  recentImageExecutions.set(requestId, completedEntry);
                  recentImageExecutions.set(semanticKey, completedEntry);
                  resolveInFlight(completedEntry);

                  intentGateRouted = true;

                  const toolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                  const isStrictVerified = Boolean(imageResult.success && verifyImageArtifactCompliance(imageResult.artifact, isRevision));
                  const evalStatus = isRevision ? (imageResult.evaluation?.evaluationStatus || 'REVISION_PASS') : 'VERIFIED';

                  if (payload.stream) {
                    res.writeHead(200, {
                      'Content-Type': 'text/event-stream',
                      'Cache-Control': 'no-cache',
                      'Connection': 'keep-alive'
                    });

                    // Send response text
                    const responseText = responsePayload.naturalVoiceSpeech || (cleanPrompt ? `Visual untuk ${cleanPrompt.slice(0, 60)} telah selesai disiapkan.` : 'Visual telah selesai disiapkan.');
                    const sseChunk = JSON.stringify({
                      id: 'chatcmpl-direct-' + Date.now(),
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'direct_image_pipeline',
                      choices: [{ index: 0, delta: { content: responseText }, finish_reason: null }]
                    });
                    res.write(`data: ${sseChunk}\n\n`);

                    // Send final chunk with image metadata
                    const finalChunk = JSON.stringify({
                      id: 'chatcmpl-direct-' + Date.now(),
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'direct_image_pipeline',
                      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                      _agent: {
                        intent: deterministicDecision.intent,
                        toolsUsed,
                        verificationStatus: isStrictVerified ? 'VERIFIED' : 'FAILED',
                        evaluationStatus: evalStatus,
                        semanticScore: imageResult.evaluation?.semantic?.semanticScore ?? null,
                        evaluation: imageResult.evaluation || null,
                        cognitive: true,
                        artifactType: 'IMAGE',
                        presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                        visualIntent: visualIntent,
                        imageUrl: isStrictVerified ? (imageResult.artifact.url || null) : null,
                        generationId: payload.generationId || null,
                        messageId: payload.messageId || null,
                        imageRenderable: isStrictVerified
                      }
                    });
                    res.write(`data: ${finalChunk}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                  } else {
                    // Non-streaming response
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      id: 'chatcmpl-direct-' + Date.now(),
                      object: 'chat.completion',
                      created: Math.floor(Date.now() / 1000),
                      model: 'direct_image_pipeline',
                      choices: [{ index: 0, message: { role: 'assistant', content: responsePayload.naturalVoiceSpeech }, finish_reason: 'stop' }],
                      _agent: {
                        intent: deterministicDecision.intent,
                        toolsUsed,
                        verificationStatus: isStrictVerified ? 'VERIFIED' : 'FAILED',
                        evaluationStatus: evalStatus,
                        semanticScore: imageResult.evaluation?.semantic?.semanticScore ?? null,
                        evaluation: imageResult.evaluation || null,
                        cognitive: true,
                        artifactType: 'IMAGE',
                        presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                        visualIntent: visualIntent,
                        imageUrl: isStrictVerified ? (imageResult.artifact.url || null) : null,
                        generationId: payload.generationId || null,
                        messageId: payload.messageId || null,
                        imageRenderable: isStrictVerified
                      }
                    }));
                  }

                  console.log(`[INTENT_GATE] Direct image success: ${imageResult.artifact.url}`);
                  return;
                } else {
                  if (clientRequestId) recentImageExecutions.delete(clientRequestId);
                  recentImageExecutions.delete(requestId);
                  recentImageExecutions.delete(semanticKey);
                  resolveInFlight(null);
                  console.warn(`[INTENT_GATE] Direct image failed: ${imageResult.error}`);

                  if (isRevision) {
                    const failureDetails = resolveRevisionFailureDetails(imageResult);
                    const reasonCode = failureDetails.reasonCode;
                    console.log(`[IMAGE_REVISION] execution=FAILED reason=${reasonCode}`);
                    const failureText = `Saya belum dapat melakukan revisi gambar saat ini. Penyebab: ${failureDetails.failureReason}`;

                    if (payload.stream) {
                      res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                      });
                      res.write(`data: ${JSON.stringify({
                        id: 'chatcmpl-direct-err-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'direct_image_pipeline',
                        choices: [{ index: 0, delta: { content: failureText }, finish_reason: null }]
                      })}\n\n`);
                      res.write(`data: ${JSON.stringify({
                        id: 'chatcmpl-direct-err-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'direct_image_pipeline',
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                        _agent: {
                          intent: deterministicDecision.intent,
                          toolsUsed: ['image.edit'],
                          verificationStatus: 'FAILED',
                          cognitive: true,
                          artifactType: 'IMAGE',
                          imageUrl: null,
                          error: imageResult.error,
                          reasonCode
                        }
                      })}\n\n`);
                      res.write('data: [DONE]\n\n');
                      res.end();
                    } else {
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({
                        id: 'chatcmpl-direct-err-' + Date.now(),
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: 'direct_image_pipeline',
                        choices: [{ index: 0, message: { role: 'assistant', content: failureText }, finish_reason: 'stop' }],
                        _agent: {
                          intent: deterministicDecision.intent,
                          toolsUsed: ['image.edit'],
                          verificationStatus: 'FAILED',
                          cognitive: true,
                          artifactType: 'IMAGE',
                          imageUrl: null,
                          error: imageResult.error,
                          reasonCode
                        }
                      }));
                    }
                    return;
                  }
                }
              } catch (directErr) {
                console.warn(`[INTENT_GATE] Direct image error: ${directErr.message}`);
                if (isRevision) {
                  const failureDetails = resolveRevisionFailureDetails({ error: directErr.message });
                  console.log(`[IMAGE_REVISION] execution=FAILED reason=${failureDetails.reasonCode}`);
                  const failureText = `Saya belum dapat melakukan revisi gambar saat ini. Penyebab: ${failureDetails.failureReason}`;
                  if (payload.stream) {
                    res.writeHead(200, {
                      'Content-Type': 'text/event-stream',
                      'Cache-Control': 'no-cache',
                      'Connection': 'keep-alive'
                    });
                    res.write(`data: ${JSON.stringify({
                      id: 'chatcmpl-direct-err-' + Date.now(),
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'direct_image_pipeline',
                      choices: [{ index: 0, delta: { content: failureText }, finish_reason: null }]
                    })}\n\n`);
                    res.write(`data: ${JSON.stringify({
                      id: 'chatcmpl-direct-err-' + Date.now(),
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'direct_image_pipeline',
                      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                      _agent: {
                        intent: deterministicDecision.intent,
                        toolsUsed: ['image.edit'],
                        verificationStatus: 'FAILED',
                        cognitive: true,
                        artifactType: 'IMAGE',
                        imageUrl: null,
                        error: directErr.message,
                        reasonCode: failureDetails.reasonCode
                      }
                    })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                  } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      id: 'chatcmpl-direct-err-' + Date.now(),
                      object: 'chat.completion',
                      created: Math.floor(Date.now() / 1000),
                      model: 'direct_image_pipeline',
                      choices: [{ index: 0, message: { role: 'assistant', content: failureText }, finish_reason: 'stop' }],
                      _agent: {
                        intent: deterministicDecision.intent,
                        toolsUsed: ['image.edit'],
                        verificationStatus: 'FAILED',
                        cognitive: true,
                        artifactType: 'IMAGE',
                        imageUrl: null,
                        error: directErr.message,
                        reasonCode: failureDetails.reasonCode
                      }
                    }));
                  }
                  return;
                }
              }
            }

            // Standard AgentRuntime path for non-image tasks or fallback
            try {
              const { agentRuntimeInstance } = await import('../agent/AgentRuntime.mjs');

              let referenceImage = deterministicDecision.referenceImage || deterministicDecision.visualIntent?.referenceImage || sie._findLastVisualAsset(messages) || null;

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
              console.warn('[INTENT_GATE] AgentRuntime failed:', agentErr.message);
              if (deterministicDecision.intent === 'IMAGE_GENERATION' || deterministicDecision.intent === 'IMAGE_REVISION') {
                const isRevision = deterministicDecision.intent === 'IMAGE_REVISION';
                const failText = isRevision
                  ? `Saya belum berhasil merender ulang visual tersebut. Penyebab: ${agentErr.message}.`
                  : `Proses pembuatan gambar belum berhasil diselesaikan. Penyebab: ${agentErr.message}.`;
                if (payload.stream) {
                  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
                  res.write(`data: ${JSON.stringify({ id: 'chatcmpl-agent-fail-' + Date.now(), object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: failText }, finish_reason: 'stop' }], _agent: { intent: deterministicDecision.intent, verificationStatus: 'FAILED', artifactType: 'IMAGE', imageUrl: null, imageRenderable: false } })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                } else {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    id: 'chatcmpl-agent-fail-' + Date.now(),
                    object: 'chat.completion',
                    choices: [{ index: 0, message: { role: 'assistant', content: failText }, finish_reason: 'stop' }],
                    _agent: { intent: deterministicDecision.intent, verificationStatus: 'FAILED', artifactType: 'IMAGE', imageUrl: null, imageRenderable: false }
                  }));
                }
                return;
              }
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

      // ═══════════════════════════════════════════════════════════════════════
      // FALLBACK IMAGE DETECTION - If intent gate failed but request is image-related
      // ═══════════════════════════════════════════════════════════════════════
      const hasDocContext = userPrompt.includes('--- [BERKAS DOKUMEN') ||
        userPrompt.includes('--- [DOKUMEN') ||
        userPrompt.includes('--- [Konteks Dokumen') ||
        /(?:baca\s+ini|baca\s+dokumen|point\s+point|poin\s+poin|outline|rangkum|ringkas|buatkan\s+point)\b/i.test(userPrompt);

      if (!isInternalAgentCall && !intentGateRouted && userPrompt && !hasDocContext) {
        const imageCreationPattern = /\b(?:buat|bikin|generate|create|render|desain|lukis|buatkan|hasilkan)\s+(?:\w+\s+){0,3}(?:gambar|image|visual|foto|poster|logo|wallpaper|lukisan|artwork)\b/i;
        const imageRevisionPattern = /\b(?:revisi|ubah|ganti|update|regenerate|buat\s+ulang|edit|modifikasi|timpa)\s+(?:gambar|visual|foto|image|desain)\b/i;
        const isImageRequest = imageCreationPattern.test(userPrompt) || imageRevisionPattern.test(userPrompt);
        const { studioSessionManagerInstance } = await import('../studio/core/StudioSessionManager.mjs');
        const hasActiveSlideSession = studioSessionManagerInstance.hasActiveSession('SLIDE_STUDIO');
        const isContextualSlide = hasActiveSlideSession && /\b(?:visualnya|slidenya|gambarnya|tampilannya|nya|yang\s+tadi)\b/i.test(userPrompt);
        const isSlideRelated = /\b(?:slide|presentasi|deck)\b/i.test(userPrompt) || isContextualSlide;

        if (isImageRequest && !isSlideRelated) {
          console.log(`[${requestId}] [FALLBACK_IMAGE] Detected image request in plain LLM path, redirecting to direct generation`);

          try {
            const { imageGenerationInstance } = await import('../agent/ImageGeneration.mjs');
            const { jinResponseEngineInstance } = await import('../agent/JINResponseEngine.mjs');

            const isRevision = imageRevisionPattern.test(userPrompt);
            const imagePrompt = enrichContextualImagePrompt(userPrompt, messages);

            // Find previous visual for revision
            let referenceImage = null;
            if (isRevision) {
              for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (msg.role === 'assistant' && msg.imageUrl) {
                  referenceImage = msg.imageUrl;
                  break;
                }
                if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                  for (const part of msg.content) {
                    if (part.type === 'image_url' && part.image_url?.url) {
                      referenceImage = part.image_url.url;
                      break;
                    }
                  }
                  if (referenceImage) break;
                }
              }
            }

            // Auto-detect 16:9 or 9:16 from user prompt
            const { ImageGenerationService } = await import('../agent/ImageGeneration.mjs');
            const fallbackAspectRatio = ImageGenerationService.detectAspectRatio(userPrompt, '16:9');
            const fallbackSize = fallbackAspectRatio === '9:16' ? '512x912' : '912x512';

            const imageResult = await imageGenerationInstance.generateImage({
              prompt: imagePrompt,
              referenceImage,
              aspectRatio: fallbackAspectRatio,
              size: fallbackSize,
              generationId: payload.generationId || null,
              messageId: payload.messageId || null,
              requestId
            });

            if (imageResult.success && imageResult.artifact) {
              const decision = { intent: isRevision ? 'IMAGE_REVISION' : 'IMAGE_GENERATION' };
              const responsePayload = isRevision
                ? jinResponseEngineInstance.synthesizeImageRevisionOutcome({
                    userUtterance: userPrompt,
                    decision,
                    artifact: imageResult.artifact,
                    verification: { isSatisfied: true, verificationStatus: 'VERIFIED' },
                    provenance: { semanticModel: 'fallback_image_pipeline' }
                  })
                : jinResponseEngineInstance.synthesizeImageGenerationOutcome({
                    userUtterance: userPrompt,
                    decision,
                    artifact: imageResult.artifact,
                    verification: { isSatisfied: true, verificationStatus: 'VERIFIED' },
                    provenance: { semanticModel: 'fallback_image_pipeline' }
                  });

              if (isStream) {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
                });

                const responseText = responsePayload.naturalVoiceSpeech || (userPrompt ? `Visual untuk ${userPrompt.slice(0, 60)} telah selesai disiapkan.` : 'Visual telah selesai disiapkan.');
                const sseChunk = JSON.stringify({
                  id: 'chatcmpl-fallback-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'fallback_image_pipeline',
                  choices: [{ index: 0, delta: { content: responseText }, finish_reason: null }]
                });
                res.write(`data: ${sseChunk}\n\n`);

                const toolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                const isStrictVerified = Boolean(imageResult.success && verifyImageArtifactCompliance(imageResult.artifact, isRevision));

                const finalChunk = JSON.stringify({
                  id: 'chatcmpl-fallback-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'fallback_image_pipeline',
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  _agent: {
                    intent: decision.intent,
                    toolsUsed,
                    verificationStatus: isStrictVerified ? 'VERIFIED' : 'FAILED',
                    cognitive: true,
                    artifactType: 'IMAGE',
                    presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                    imageUrl: isStrictVerified ? (imageResult.artifact.url || null) : null,
                    generationId: payload.generationId || null,
                    messageId: payload.messageId || null,
                    imageRenderable: isStrictVerified
                  }
                });
                res.write(`data: ${finalChunk}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                const toolsUsed = isRevision ? ['image.edit'] : ['image.generate'];
                const isStrictVerified = Boolean(imageResult.success && verifyImageArtifactCompliance(imageResult.artifact, isRevision));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: 'chatcmpl-fallback-' + Date.now(),
                  object: 'chat.completion',
                  created: Math.floor(Date.now() / 1000),
                  model: 'fallback_image_pipeline',
                  choices: [{ index: 0, message: { role: 'assistant', content: responsePayload.naturalVoiceSpeech }, finish_reason: 'stop' }],
                  _agent: {
                    intent: decision.intent,
                    toolsUsed,
                    verificationStatus: isStrictVerified ? 'VERIFIED' : 'FAILED',
                    cognitive: true,
                    artifactType: 'IMAGE',
                    presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
                    imageUrl: isStrictVerified ? (imageResult.artifact.url || null) : null,
                    generationId: payload.generationId || null,
                    messageId: payload.messageId || null,
                    imageRenderable: isStrictVerified
                  }
                }));
              }

              console.log(`[FALLBACK_IMAGE] Success: ${imageResult.artifact.url}`);
              runtimeObservabilityInstance.completeTask(task.taskId, { content: responsePayload.naturalVoiceSpeech }, {});
              return;
            } else {
              const failReason = imageResult?.error || 'Gagal merender gambar.';
              console.warn(`[FALLBACK_IMAGE] Image generation failed: ${failReason}`);
              const failText = isRevision
                ? `Saya belum berhasil merender ulang visual tersebut. Penyebab: ${failReason}.`
                : `Proses pembuatan gambar belum berhasil diselesaikan. Penyebab: ${failReason}.`;
              if (payload.stream) {
                res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
                res.write(`data: ${JSON.stringify({ id: 'chatcmpl-fb-fail-' + Date.now(), object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: failText }, finish_reason: 'stop' }], _agent: { intent: isRevision ? 'IMAGE_REVISION' : 'IMAGE_GENERATION', verificationStatus: 'FAILED', artifactType: 'IMAGE', imageUrl: null, imageRenderable: false } })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: 'chatcmpl-fb-fail-' + Date.now(),
                  object: 'chat.completion',
                  choices: [{ index: 0, message: { role: 'assistant', content: failText }, finish_reason: 'stop' }],
                  _agent: { intent: isRevision ? 'IMAGE_REVISION' : 'IMAGE_GENERATION', verificationStatus: 'FAILED', artifactType: 'IMAGE', imageUrl: null, imageRenderable: false }
                }));
              }
              runtimeObservabilityInstance.failTask(task.taskId, new Error(failReason));
              return;
            }
          } catch (fallbackErr) {
            console.warn(`[FALLBACK_IMAGE] Error: ${fallbackErr.message}`);
            const isRevision = imageRevisionPattern.test(userPrompt);
            const failText = isRevision
              ? `Saya belum berhasil merender ulang visual tersebut. Penyebab: ${fallbackErr.message}.`
              : `Proses pembuatan gambar belum berhasil diselesaikan. Penyebab: ${fallbackErr.message}.`;
            if (payload.stream) {
              res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
              res.write(`data: ${JSON.stringify({ id: 'chatcmpl-fb-err-' + Date.now(), object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: failText }, finish_reason: 'stop' }], _agent: { intent: isRevision ? 'IMAGE_REVISION' : 'IMAGE_GENERATION', verificationStatus: 'FAILED', artifactType: 'IMAGE', imageUrl: null, imageRenderable: false } })}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                id: 'chatcmpl-fb-err-' + Date.now(),
                object: 'chat.completion',
                choices: [{ index: 0, message: { role: 'assistant', content: failText }, finish_reason: 'stop' }],
                _agent: { intent: isRevision ? 'IMAGE_REVISION' : 'IMAGE_GENERATION', verificationStatus: 'FAILED', artifactType: 'IMAGE', imageUrl: null, imageRenderable: false }
              }));
            }
            runtimeObservabilityInstance.failTask(task.taskId, fallbackErr);
            return;
          }
        }
      }


      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write(': keep-alive\n\n');

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

          // TECHNICAL POST-PROCESS: Parse the AI's textual deck plan if this is a pending Slide Studio session.
          try {
            const { studioSessionManagerInstance } = await import('../studio/core/StudioSessionManager.mjs');
            const { slideDeckPlannerInstance } = await import('../studio/slide/SlideDeckPlanner.mjs');
            const slideSession = studioSessionManagerInstance.getActiveSession('SLIDE_STUDIO');
            
            if (slideSession && slideSession.execution?.phase === 'MASTER_DRAFT' && (!slideSession.slidePlan || slideSession.slidePlan.length === 0)) {
              const plan = slideDeckPlannerInstance.ingestSlidePlan(fullStreamed);
              if (plan && plan.length > 0) {
                slideSession.slidePlan = plan;
                slideSession.totalSlides = plan.length;
                studioSessionManagerInstance.updateSession('SLIDE_STUDIO', { slidePlan: plan, totalSlides: plan.length });
                console.log(`[AI_DECK_PLAN] ACCEPTED ${plan.length} slides`);
                console.log(`[MASTER_DRAFT] PERSISTED`);
              }
            }
          } catch (ingestErr) {
            console.error('[LOCAL_ROUTER] Failed to ingest AI deck plan:', ingestErr.message);
          }

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
          requestId: body.requestId || `img-${Date.now()}`,
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
        const { fileName, content, documentText, dataUrl } = body;
        const { extractTextFromDataUrl } = await import('../tools/DocumentParser.mjs');

        let extractedText = '';
        if (dataUrl) {
          extractedText = await extractTextFromDataUrl(dataUrl, fileName || 'document');
        } else if (documentText) {
          extractedText = typeof documentText === 'string' ? documentText : JSON.stringify(documentText);
        } else if (content) {
          extractedText = typeof content === 'string' ? content : JSON.stringify(content);
        }

        if (!extractedText && !dataUrl && !documentText && !content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '"dataUrl", "content", or "documentText" is required' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          fileName: fileName || 'uploaded-document',
          text: extractedText,
          content: extractedText,
          length: extractedText.length
        }, null, 2));
      } catch (err) {
        console.error('[FILES_PARSE_ERROR]', err);
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

const isDirectExecution = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
);

if (isDirectExecution) {
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
