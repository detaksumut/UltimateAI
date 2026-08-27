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

  // 1. Basic Health Check
  if (pathname === '/health' && req.method === 'GET') {
    const providerHealth = await providerRegistryInstance.getHealthStatus();
    const hasAnyLive = Object.values(providerHealth).some(p => p.configured);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      gateway: 'ONLINE',
      mode: hasAnyLive ? 'LIVE_CLOUD_AI' : 'LOCAL_HEURISTIC_FALLBACK',
      version: '2.0.0-PROD',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
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

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  ULTIMATEAI 9ROUTER BACKEND GATEWAY LIVE ON PORT ${PORT} `);
  console.log(`  - Health:    http://localhost:${PORT}/health `);
  console.log(`  - Providers: http://localhost:${PORT}/api/ultimateai/providers/status `);
  console.log(`  - Chat API:  http://localhost:${PORT}/v1/chat/completions `);
  console.log(`=======================================================`);
});
