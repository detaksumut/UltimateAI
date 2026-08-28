/**
 * UltimateAI 9Router Backend Server (server.mjs)
 * Modular AI Gateway with Provider Certification & Tool Governance.
 * Port: 20128
 */

import http from 'http';
import { config } from './config/env.mjs';
import { providerRegistryInstance } from './providers/ProviderRegistry.mjs';
import { ProviderCertification } from './providers/ProviderCertification.mjs';
import { ChatCompletionService } from './services/ChatCompletionService.mjs';
import { toolRegistryInstance } from './tools/ToolRegistry.mjs';
import { GatewayTelemetry } from './telemetry/GatewayTelemetry.mjs';

import { agentRuntimeInstance } from './agent/AgentRuntime.mjs';
import { loadPersistedOAuthConfig } from './antigravity/AntigravityOAuthEnrollment.mjs';

loadPersistedOAuthConfig();

const PORT = config.port;
const startTime = Date.now();

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Autonomous Agent Execution Endpoint (POST /api/agent/run)
  if ((pathname === '/api/agent/run' || pathname === '/v1/agent/run') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const goal = payload.goal || payload.prompt || '';
        const summary = await agentRuntimeInstance.runGoal(goal, payload.context || {});

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(summary, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 1. Basic Health Check
  if (pathname === '/health' && req.method === 'GET') {
    const cert = await ProviderCertification.certifyAllProviders();
    const liveProviders = Object.entries(cert).filter(([_, p]) => p.status === 'AUTHENTICATED_LIVE');
    const hasLive = liveProviders.length > 0;
    const hasDegraded = Object.entries(cert).some(([_, p]) => p.status === 'DEGRADED');

    let mode = 'LOCAL_SYNTHETIC';
    if (hasLive) {
      mode = 'LIVE_CLOUD_AI';
    } else if (hasDegraded) {
      mode = 'DEGRADED';
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      gateway: 'ONLINE',
      mode,
      version: '2.0.0-PROD',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      activeLiveProviders: liveProviders.map(([name]) => name),
      registeredTools: toolRegistryInstance.listTools().map(t => t.name)
    }, null, 2));
    return;
  }

  // 2. Real-time Provider Certification Probe Endpoint (GET /api/ultimateai/providers/status)
  if ((pathname === '/api/ultimateai/providers/status' || pathname === '/providers/status') && req.method === 'GET') {
    const certification = await ProviderCertification.certifyAllProviders();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      gateway: 'ONLINE',
      timestamp: new Date().toISOString(),
      providers: certification
    }, null, 2));
    return;
  }

  // 2B. Unified Quota & Pool State Endpoint (GET /api/quota, /api/pools)
  if ((pathname === '/api/quota' || pathname === '/api/pools' || pathname === '/api/dashboard/quota') && req.method === 'GET') {
    const { antigravityConnectionStoreInstance } = await import('./antigravity/AntigravityConnectionStore.mjs');
    const { antigravityQuotaTrackerInstance } = await import('./antigravity/AntigravityQuotaTracker.mjs');
    
    const connections = antigravityConnectionStoreInstance.getAllConnections(false);
    const quotaState = antigravityQuotaTrackerInstance.getQuotaSummary();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
      authority: 'ULTIMATEAI_LOCAL_ROUTER_V1_SSOT',
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.isActive !== false).length,
      connections,
      quota: quotaState
    }, null, 2));
    return;
  }

  // 2C. Antigravity Connection Manager Endpoints (/api/antigravity/*)
  if (pathname.startsWith('/api/antigravity/')) {
    const { antigravityEnrollmentSessionManagerInstance } = await import('./antigravity/AntigravityEnrollmentSessionManager.mjs');
    const { AntigravityOAuthEnrollment } = await import('./antigravity/AntigravityOAuthEnrollment.mjs');

    // GET /api/antigravity/config
    if (pathname === '/api/antigravity/config' && req.method === 'GET') {
      const diag = AntigravityOAuthEnrollment.validateOAuthClientConfig(process.env);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diag, null, 2));
      return;
    }

    // POST /api/antigravity/config
    if (pathname === '/api/antigravity/config' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const { savePersistedOAuthConfig } = await import('./antigravity/AntigravityOAuthEnrollment.mjs');
          if (parsed.clientId) {
            savePersistedOAuthConfig(parsed.clientId.trim(), (parsed.clientSecret || '').trim());
          }
          const diag = AntigravityOAuthEnrollment.validateOAuthClientConfig(process.env);
          res.writeHead(diag.valid ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(diag, null, 2));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      });
      return;
    }

    // GET /api/antigravity/connections
    if (pathname === '/api/antigravity/connections' && req.method === 'GET') {
      const slots = antigravityEnrollmentSessionManagerInstance.getAllConnectionSlots();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total: slots.length, slots }, null, 2));
      return;
    }

    // POST /api/antigravity/connections/:connectionId/enroll
    const enrollMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])\/enroll$/);
    if (enrollMatch && req.method === 'POST') {
      try {
        const sessionInfo = await antigravityEnrollmentSessionManagerInstance.startEnrollment(enrollMatch[1]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sessionInfo, null, 2));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
      return;
    }

    // GET /api/antigravity/enrollments/:enrollmentId
    const getEnrollMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)$/);
    if (getEnrollMatch && req.method === 'GET') {
      const progress = antigravityEnrollmentSessionManagerInstance.getEnrollmentProgress(getEnrollMatch[1]);
      if (!progress) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Enrollment session not found or expired.' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(progress, null, 2));
      return;
    }

    // POST /api/antigravity/enrollments/:enrollmentId/callback
    const callbackMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)\/callback$/);
    if (callbackMatch && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const result = await antigravityEnrollmentSessionManagerInstance.processManualCallback(callbackMatch[1], parsed.callbackUrl || '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      });
      return;
    }

    // POST /api/antigravity/enrollments/:enrollmentId/cancel
    const cancelMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)\/cancel$/);
    if (cancelMatch && req.method === 'POST') {
      const result = await antigravityEnrollmentSessionManagerInstance.cancelEnrollment(cancelMatch[1]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    // POST /api/antigravity/connections/:connectionId/refresh
    const refreshMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])\/refresh$/);
    if (refreshMatch && req.method === 'POST') {
      try {
        const result = await antigravityEnrollmentSessionManagerInstance.refreshConnection(refreshMatch[1]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
      return;
    }

    // DELETE /api/antigravity/connections/:connectionId
    const deleteMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])$/);
    if (deleteMatch && req.method === 'DELETE') {
      const result = await antigravityEnrollmentSessionManagerInstance.disconnectConnection(deleteMatch[1]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
      return;
    }
  }

  // 3. Chat Completions & Streaming Endpoint
  if ((pathname === '/v1/chat/completions' || pathname === '/api/ultimateai/v1/chat/completions') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const isStream = payload.stream === true;

        if (isStream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          const sseWriter = {
            sendChunk: (token, model) => {
              const chunk = {
                id: 'chatcmpl-' + Date.now(),
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model || '9Router-Autonomous',
                choices: [{
                  index: 0,
                  delta: { content: token },
                  finish_reason: null
                }]
              };
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
          };

          await ChatCompletionService.handleCompletion(payload, sseWriter);
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          const result = await ChatCompletionService.handleCompletion(payload, null);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: result.routing.recommendedModel,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop'
            }],
            telemetry: {
              strategy: result.routing.strategy,
              stream_mode: result.streamMode,
              tool_result: result.toolResult,
              latency_ms: result.latencyMs
            }
          }));
        }
      } catch (err) {
        GatewayTelemetry.logEvent('REQUEST_ERROR', { error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`  ULTIMATEAI 9ROUTER BACKEND GATEWAY LIVE ON PORT ${PORT} `);
  console.log(`  - Health:      http://localhost:${PORT}/health `);
  console.log(`  - Connections: http://localhost:${PORT}/api/antigravity/connections `);
  console.log(`  - Providers:   http://localhost:${PORT}/api/ultimateai/providers/status `);
  console.log(`  - Chat API:    http://localhost:${PORT}/v1/chat/completions `);
  console.log(`=======================================================`);

  // Auto-bootstrap Local Router on 20200 if not already running
  try {
    const { createLocalRouterServer } = await import('./local_router/LocalRouterServer.mjs');
    const localRouter = createLocalRouterServer();
    localRouter.listen(20200, '127.0.0.1', () => {
      console.log(`⚡ ULTIMATEAI LOCAL ROUTER LIVE ON http://127.0.0.1:20200`);
    });
    localRouter.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚡ UltimateAI Local Router on 127.0.0.1:20200 is already active.`);
      } else {
        console.warn(`Local Router startup notice:`, err.message);
      }
    });
  } catch (err) {
    console.warn(`Local Router could not be auto-bootstrapped:`, err.message);
  }
});
