/**
 * LocalRouterServer.mjs
 * UltimateAI Local Router Service on 127.0.0.1:20200.
 * Operates independently of VS Code / Antigravity IDE.
 * Manages 7 Antigravity Connections with Sticky Sequential Rollover & Real Upstream Transport.
 */

import http from 'http';
import { URL } from 'url';
import { antigravityConnectionStoreInstance } from '../antigravity/AntigravityConnectionStore.mjs';
import { antigravityQuotaTrackerInstance } from '../antigravity/AntigravityQuotaTracker.mjs';
import { antigravityProviderInstance } from '../antigravity/AntigravityProvider.mjs';
import { AntigravityModelRegistry } from '../antigravity/AntigravityModelRegistry.mjs';

const PORT = parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10);
const startTime = Date.now();

export function createLocalRouterServer() {
  const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    // 1. GET /health
    if (pathname === '/health' && req.method === 'GET') {
      const health = await antigravityProviderInstance.healthCheck();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        router: 'UltimateAI Local Router',
        port: PORT,
        mode: health.status === 'AUTHENTICATED_LIVE' ? 'LIVE_CLOUD_AI' : 'NOT_CONFIGURED',
        version: '1.0.0-PROD',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        activeConnectionsCount: health.activeConnectionsCount,
        providerGateway: 'ANTIGRAVITY'
      }, null, 2));
      return;
    }

    // 2. GET /api/accounts (Public Metadata, Zero Secrets)
    if (pathname === '/api/accounts' && req.method === 'GET') {
      const accounts = antigravityConnectionStoreInstance.getAllConnections(true);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        total: accounts.length,
        accounts
      }, null, 2));
      return;
    }

    // 3. GET /api/models
    if (pathname === '/api/models' && req.method === 'GET') {
      const models = AntigravityModelRegistry.getAllModels();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        object: 'list',
        data: models
      }, null, 2));
      return;
    }

    // 4. GET /api/quota (SSOT Quota State)
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

    // 5. POST /v1/chat/completions (OpenAI-compatible)
    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
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

            const result = await antigravityProviderInstance.sendChat(
              { messages, stream: true, model, capability, temperature: payload.temperature || 0.7 },
              (token) => {
                const chunk = {
                  id: 'chatcmpl-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: payload.model || 'gemini-2.5-flash',
                  choices: [{ index: 0, delta: { content: token }, finish_reason: null }]
                };
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
              }
            );

            res.write('data: [DONE]\n\n');
            res.end();
          } else {
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
                accountAlias: result.accountAlias,
                model: result.model,
                transport: result.transport,
                fallbackUsed: false,
                rollover: result.rollover
              }
            }, null, 2));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              message: err.message,
              type: 'local_router_error',
              code: err.message.includes('NO_ELIGIBLE_CONNECTION') ? 'NO_ELIGIBLE_CONNECTION' : 'ROUTER_EXECUTION_FAILED'
            }
          }, null, 2));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
  });

  return server;
}

// Auto-start if executed directly
if (process.argv[1] && process.argv[1].endsWith('LocalRouterServer.mjs')) {
  const server = createLocalRouterServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`=======================================================`);
    console.log(`  ULTIMATEAI LOCAL ROUTER LIVE ON 127.0.0.1:${PORT}`);
    console.log(`  - Health:    http://127.0.0.1:${PORT}/health`);
    console.log(`  - Accounts:  http://127.0.0.1:${PORT}/api/accounts`);
    console.log(`  - Models:    http://127.0.0.1:${PORT}/api/models`);
    console.log(`  - Quota:     http://127.0.0.1:${PORT}/api/quota`);
    console.log(`  - Chat API:  http://127.0.0.1:${PORT}/v1/chat/completions`);
    console.log(`=======================================================`);
  });
}

export default createLocalRouterServer;
