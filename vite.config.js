import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { providerRegistryInstance } from './server/providers/ProviderRegistry.mjs';
import { ChatCompletionService } from './server/services/ChatCompletionService.mjs';

// Custom 9Router Gateway Middleware Plugin (Vite Integrated)
function nineRouterGatewayPlugin() {
  return {
    name: 'ninerouter-gateway-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 1. Health & Status
        if (req.url === '/health' || req.url === '/api/ultimateai/health') {
          const providerHealth = await providerRegistryInstance.getHealthStatus();
          const hasAnyLive = Object.values(providerHealth).some(p => p.configured);

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({
            gateway: 'ONLINE',
            mode: hasAnyLive ? 'LIVE_CLOUD_AI' : 'LOCAL_HEURISTIC_FALLBACK',
            version: '2.0.0-PROD',
            providers: providerHealth
          }, null, 2));
          return;
        }

        // 1B. Live Provider Certification Probe
        if (req.url === '/api/ultimateai/providers/status' || req.url === '/providers/status') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({
            gateway: 'ONLINE',
            timestamp: new Date().toISOString(),
            providers: {
              gemini: { configured: false, certification: 'NOT_CONFIGURED' },
              openai: { configured: false, certification: 'NOT_CONFIGURED' },
              claude: { configured: false, certification: 'NOT_CONFIGURED' },
              deepseek: { configured: false, certification: 'NOT_CONFIGURED' }
            }
          }, null, 2));
          return;
        }

        // 2. Chat Completions & Streaming
        if ((req.url === '/v1/chat/completions' || req.url === '/api/ultimateai/v1/chat/completions') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const isStream = payload.stream === true;

              if (isStream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('Access-Control-Allow-Origin', '*');

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
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
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
                    latency_ms: result.latencyMs
                  }
                }));
              }
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), nineRouterGatewayPlugin()],
  server: {
    port: 5177,
  },
});
