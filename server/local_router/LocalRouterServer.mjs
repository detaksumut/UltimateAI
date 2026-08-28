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
import { antigravityConnectionStoreInstance } from '../antigravity/AntigravityConnectionStore.mjs';
import { antigravityQuotaTrackerInstance } from '../antigravity/AntigravityQuotaTracker.mjs';
import { antigravityProviderInstance } from '../antigravity/AntigravityProvider.mjs';
import { AntigravityModelRegistry } from '../antigravity/AntigravityModelRegistry.mjs';
import { antigravityEnrollmentSessionManagerInstance } from '../antigravity/AntigravityEnrollmentSessionManager.mjs';

import { AntigravityOAuthEnrollment, loadPersistedOAuthConfig } from '../antigravity/AntigravityOAuthEnrollment.mjs';

loadPersistedOAuthConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10);
const startTime = Date.now();

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

    // 2. GET /health
    if (pathname === '/health' && req.method === 'GET') {
      const health = await antigravityProviderInstance.healthCheck();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        router: 'UltimateAI Local Router',
        port: PORT,
        mode: health.status === 'AUTHENTICATED_LIVE' ? 'LIVE_CLOUD_AI' : 'NOT_CONFIGURED',
        version: '2.0.0-PROD',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        activeConnectionsCount: health.activeConnectionsCount,
        providerGateway: 'ANTIGRAVITY'
      }, null, 2));
      return;
    }

    // 2B. GET /api/antigravity/config (Non-secret diagnostic)
    if (pathname === '/api/antigravity/config' && req.method === 'GET') {
      const { AntigravityOAuthEnrollment } = await import('../antigravity/AntigravityOAuthEnrollment.mjs');
      const diag = AntigravityOAuthEnrollment.validateOAuthClientConfig(process.env);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diag, null, 2));
      return;
    }

    // 2C. POST /api/antigravity/config (Set OAuth Client ID dynamically)
    if (pathname === '/api/antigravity/config' && req.method === 'POST') {
      const body = await readJsonBody();
      const { savePersistedOAuthConfig, AntigravityOAuthEnrollment } = await import('../antigravity/AntigravityOAuthEnrollment.mjs');
      if (body.clientId) {
        savePersistedOAuthConfig(body.clientId.trim(), (body.clientSecret || '').trim());
      }
      const diag = AntigravityOAuthEnrollment.validateOAuthClientConfig(process.env);
      res.writeHead(diag.valid ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diag, null, 2));
      return;
    }

    // 3. GET /api/antigravity/connections (7 Connection Slots with Live Status)
    if (pathname === '/api/antigravity/connections' && req.method === 'GET') {
      const slots = antigravityEnrollmentSessionManagerInstance.getAllConnectionSlots();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        total: slots.length,
        slots
      }, null, 2));
      return;
    }

    // 4. POST /api/antigravity/connections/:connectionId/enroll
    const enrollMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])\/enroll$/);
    if (enrollMatch && req.method === 'POST') {
      const connectionId = enrollMatch[1];
      try {
        const sessionInfo = await antigravityEnrollmentSessionManagerInstance.startEnrollment(connectionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sessionInfo, null, 2));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
      return;
    }

    // 5. GET /api/antigravity/enrollments/:enrollmentId
    const getEnrollMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)$/);
    if (getEnrollMatch && req.method === 'GET') {
      const enrollmentId = getEnrollMatch[1];
      const progress = antigravityEnrollmentSessionManagerInstance.getEnrollmentProgress(enrollmentId);
      if (!progress) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Enrollment session not found or expired.' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(progress, null, 2));
      return;
    }

    // 6. POST /api/antigravity/enrollments/:enrollmentId/callback (Manual Paste)
    const callbackMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)\/callback$/);
    if (callbackMatch && req.method === 'POST') {
      const enrollmentId = callbackMatch[1];
      const body = await readJsonBody();
      try {
        const result = await antigravityEnrollmentSessionManagerInstance.processManualCallback(enrollmentId, body.callbackUrl || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
      return;
    }

    // 7. POST /api/antigravity/enrollments/:enrollmentId/cancel
    const cancelMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)\/cancel$/);
    if (cancelMatch && req.method === 'POST') {
      const enrollmentId = cancelMatch[1];
      const result = await antigravityEnrollmentSessionManagerInstance.cancelEnrollment(enrollmentId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    // 8. POST /api/antigravity/connections/:connectionId/refresh
    const refreshMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])\/refresh$/);
    if (refreshMatch && req.method === 'POST') {
      const connectionId = refreshMatch[1];
      try {
        const result = await antigravityEnrollmentSessionManagerInstance.refreshConnection(connectionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
      return;
    }

    // 9. DELETE /api/antigravity/connections/:connectionId
    const deleteMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])$/);
    if (deleteMatch && req.method === 'DELETE') {
      const connectionId = deleteMatch[1];
      const result = await antigravityEnrollmentSessionManagerInstance.disconnectConnection(connectionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    // 10. GET /api/models
    if (pathname === '/api/models' && req.method === 'GET') {
      const models = AntigravityModelRegistry.getAllModels();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: models }, null, 2));
      return;
    }

    // 11. GET /api/quota (SSOT Quota State)
    if (pathname === '/api/quota' && req.method === 'GET') {
      const snapshot = antigravityQuotaTrackerInstance.getQuotaSnapshot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        pools: snapshot
      }, null, 2));
      return;
    }

    // 12. POST /v1/chat/completions (OpenAI-compatible)
    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      const payload = await readJsonBody();
      const isStream = payload.stream === true;
      const messages = payload.messages || [];
      const model = payload.model || 'auto';
      const capability = payload.capability || 'FAST_CHAT';

      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        try {
          await antigravityProviderInstance.sendChat({
            messages,
            stream: true,
            model,
            capability,
            temperature: payload.temperature || 0.7
          }, (tokenChunk) => {
            const sseData = JSON.stringify({
              id: 'chatcmpl-' + Date.now(),
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: { content: tokenChunk }, finish_reason: null }]
            });
            res.write(`data: ${sseData}\n\n`);
          });

          res.write('data: [DONE]\n\n');
          res.end();
        } catch (err) {
          const errData = JSON.stringify({ error: { message: err.message, type: 'local_router_stream_error' } });
          res.write(`data: ${errData}\n\n`);
          res.end();
        }
      } else {
        try {
          const result = await antigravityProviderInstance.sendChat({
            messages,
            stream: false,
            model,
            capability,
            temperature: payload.temperature || 0.7
          });

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
            provenance: {
              providerGateway: 'ANTIGRAVITY',
              connectionId: result.connectionId,
              actualConnectionId: result.actualConnectionId,
              accountAlias: result.accountAlias,
              requestedModel: model,
              actualModel: result.actualModel,
              upstreamEndpoint: result.upstreamEndpoint,
              transportClass: result.transportClass,
              responseId: result.responseId,
              fallbackUsed: false,
              rollover: result.rollover
            }
          }, null, 2));
        } catch (err) {
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
    console.log(`  - Health:      http://127.0.0.1:${PORT}/health`);
    console.log(`  - Quota SSOT:  http://127.0.0.1:${PORT}/api/quota`);
    console.log(`  - Chat API:    http://127.0.0.1:${PORT}/v1/chat/completions`);
    console.log(`=======================================================`);
  });
}
