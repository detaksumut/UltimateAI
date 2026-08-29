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
              console.error('[ChatCompletion] Error:', err);

              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
              }

              if (!res.writableEnded) {
                res.end(JSON.stringify({
                  error: {
                    message: err.message || 'Internal server error'
                  }
                }));
              }
            }
          });
          return;
        }

                // 2B. Record Research & Non-Research Analysis to Drive F:
        if ((req.url === '/api/ultimateai/record-research' || req.url === '/api/ultimateai/record-document') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const fs = await import('fs');
              const path = await import('path');
              const payload = JSON.parse(body || '{}');

              const isNonResearch = payload.category === 'NON_RESEARCH' || payload.type === 'NON_RESEARCH';
              const docName = (payload.documentTitle || (isNonResearch ? 'Dokumen_Non_Riset' : 'Dokumen_Riset')).replace(/[^a-zA-Z0-9_-]/g, '_');
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filePrefix = isNonResearch ? 'NonRiset' : 'Riset';
              const fileName = `${filePrefix}_${docName}_${timestamp}.md`;

              // Primary Target: Drive F:\ (Dedicated folders)
              const primaryDir = isNonResearch ? 'F:\\UltimateAI_NonResearch_Reports' : 'F:\\UltimateAI_Research_Reports';
              // Fallback: Local workspace directory
              const fallbackDir = path.resolve(process.cwd(), isNonResearch ? 'UltimateAI_NonResearch_Reports' : 'UltimateAI_Research_Reports');

              let targetDir = primaryDir;
              try {
                if (!fs.existsSync(primaryDir)) {
                  fs.mkdirSync(primaryDir, { recursive: true });
                }
              } catch {
                targetDir = fallbackDir;
                if (!fs.existsSync(fallbackDir)) {
                  fs.mkdirSync(fallbackDir, { recursive: true });
                }
              }

              const fullPath = path.join(targetDir, fileName);
              const headerTitle = isNonResearch
                ? 'ðŸ“‘ LAPORAN HASIL ANALISIS DOKUMEN GENERAL (NON-RISET) JIN AI'
                : 'ðŸ“‘ LAPORAN HASIL ANALISIS RISET JIN AI';
              const engineSubtitle = isNonResearch
                ? 'UltimateAI Knowledge & Policy Intelligence Engine v2.0'
                : 'UltimateAI Research Intelligence Engine v2.0';

              const markdownContent = [
                `# ${headerTitle}`,
                `> **${engineSubtitle}**`,
                `- **Nama Dokumen**: ${payload.documentTitle || 'Dokumen'}`,
                `- **Kategori**: ${isNonResearch ? 'Dokumen General / Non-Riset (SK, Regulasi, Berita Ekonomi, dll)' : 'Dokumen Riset & Penelitian'}`,
                `- **Tanggal Analisis**: ${new Date().toLocaleString('id-ID')}`,
                `- **Ukuran Dokumen**: ${payload.documentSize || 'N/A'}`,
                `- **Lokasi Rekaman**: \`${fullPath}\``,
                ``,
                `---`,
                ``,
                `## ðŸ” HASIL ANALISIS LENGKAP`,
                ``,
                payload.analysisContent || 'Tidak ada konten analisis yang disertakan.',
                ``,
                `---`,
                `*Direkam secara otomatis oleh JIN Autonomous Core ke ${fullPath}*`
              ].join('\n');

              fs.writeFileSync(fullPath, markdownContent, 'utf8');

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                savedPath: fullPath,
                fileName: fileName,
                category: isNonResearch ? 'NON_RESEARCH' : 'RESEARCH',
                timestamp: new Date().toISOString()
              }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 3. Antigravity Connection Endpoints (/api/antigravity/*)
        if (req.url.startsWith('/api/antigravity/')) {
          const { antigravityEnrollmentSessionManagerInstance } = await import('./server/antigravity/AntigravityEnrollmentSessionManager.mjs');
          const pathname = req.url.split('?')[0];

          // GET /api/antigravity/connections
          if (pathname === '/api/antigravity/connections' && req.method === 'GET') {
            const slots = antigravityEnrollmentSessionManagerInstance.getAllConnectionSlots();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ total: slots.length, slots }, null, 2));
            return;
          }

          // POST /api/antigravity/connections/:connectionId/enroll
          const enrollMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])\/enroll$/);
          if (enrollMatch && req.method === 'POST') {
            try {
              const sessionInfo = await antigravityEnrollmentSessionManagerInstance.startEnrollment(enrollMatch[1]);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(sessionInfo, null, 2));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: err.message } }));
            }
            return;
          }

          // GET /oauth/callback (Dev server loopback fallback)
          if (pathname === '/oauth/callback' && req.method === 'GET') {
            const parsedUrl = new URL(req.url, 'http://localhost:5177');
            const code = parsedUrl.searchParams.get('code');
            const state = parsedUrl.searchParams.get('state');
            if (code) {
              try {
                await antigravityEnrollmentSessionManagerInstance.processManualCallback(state || '', req.url);
                res.setHeader('Content-Type', 'text/html');
                res.end(`<html><body><script>window.opener?.postMessage({type:'ANTIGRAVITY_AUTH_SUCCESS'},'*');window.close();</script></body></html>`);
              } catch (e) {
                res.statusCode = 500;
                res.end(e.message);
              }
              return;
            }
          }
        }

        // 4. Engineering Agent Runtime Endpoints (/api/engineering/*)
        if (req.url.startsWith('/api/engineering/')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          const pathname = req.url.split('?')[0];
          const { engineeringRuntimeInstance } = await import('./server/engineering/EngineeringRuntime.mjs');
          const { frontendTelemetryGatewayInstance } = await import('./server/engineering/observer/FrontendTelemetryGateway.mjs');
          const { incidentQueueInstance } = await import('./server/engineering/queue/IncidentQueue.mjs');

          // POST /api/engineering/telemetry
          if (pathname === '/api/engineering/telemetry' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                const result = frontendTelemetryGatewayInstance.processTelemetry(payload);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, result }));
              } catch (err) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          // GET /api/engineering/status
          if (pathname === '/api/engineering/status' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(engineeringRuntimeInstance.getStatus(), null, 2));
            return;
          }

          // GET /api/engineering/incidents
          if (pathname === '/api/engineering/incidents' && req.method === 'GET') {
            const incidents = incidentQueueInstance.getAllIncidents();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ incidents, total: incidents.length }, null, 2));
            return;
          }

          // POST /api/engineering/approve
          if (pathname === '/api/engineering/approve' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { incidentId } = JSON.parse(body || '{}');
                const result = await engineeringRuntimeInstance.applyAndDeployFix(incidentId);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result, null, 2));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }
        // 3B. Additional Antigravity Connection Endpoints
        if (req.url.startsWith('/api/antigravity/')) {
          const { antigravityEnrollmentSessionManagerInstance } = await import('./server/antigravity/AntigravityEnrollmentSessionManager.mjs');
          const pathname = req.url.split('?')[0];

          // GET /api/antigravity/enrollments/:enrollmentId
          const getEnrollMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)$/);
          if (getEnrollMatch && req.method === 'GET') {
            const progress = antigravityEnrollmentSessionManagerInstance.getEnrollmentProgress(getEnrollMatch[1]);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (!progress) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: { message: 'Session not found' } }));
            } else {
              res.end(JSON.stringify(progress, null, 2));
            }
            return;
          }

          // POST /api/antigravity/enrollments/:enrollmentId/callback & /api/antigravity/connections/:connectionId/callback
          const callbackMatch = pathname.match(/^\/api\/antigravity\/(?:enrollments|connections)\/([a-z0-9-]+)\/callback$/);
          if (callbackMatch && req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const result = await antigravityEnrollmentSessionManagerInstance.processManualCallback(callbackMatch[1], parsed.callbackUrl || parsed.code || '');
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify(result, null, 2));
              } catch (err) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: { message: err.message } }));
              }
            });
            return;
          }

          // POST /api/antigravity/enrollments/:enrollmentId/cancel
          const cancelMatch = pathname.match(/^\/api\/antigravity\/enrollments\/(enr-[a-z0-9-]+)\/cancel$/);
          if (cancelMatch && req.method === 'POST') {
            const result = await antigravityEnrollmentSessionManagerInstance.cancelEnrollment(cancelMatch[1]);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(result, null, 2));
            return;
          }

          // POST /api/antigravity/connections/:connectionId/refresh
          const refreshMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])\/refresh$/);
          if (refreshMatch && req.method === 'POST') {
            try {
              const result = await antigravityEnrollmentSessionManagerInstance.refreshConnection(refreshMatch[1]);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(result, null, 2));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: err.message } }));
            }
            return;
          }

          // POST /api/antigravity/connections/:connectionId/toggle
          const toggleMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])\/toggle$/);
          if (toggleMatch && req.method === 'POST') {
            try {
              const result = await antigravityEnrollmentSessionManagerInstance.toggleConnection(toggleMatch[1]);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(result, null, 2));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: err.message } }));
            }
            return;
          }

          // GET & POST /api/antigravity/oauth/config
          if (pathname === '/api/antigravity/oauth/config') {
            const { loadPersistedOAuthConfig, savePersistedOAuthConfig } = await import('./server/antigravity/AntigravityOAuthEnrollment.mjs');
            if (req.method === 'GET') {
              const cfg = loadPersistedOAuthConfig() || {};
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                clientId: cfg.clientId || process.env.ANTIGRAVITY_OAUTH_CLIENT_ID || '',
                hasClientSecret: Boolean(cfg.clientSecret || process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET)
              }, null, 2));
              return;
            }
            if (req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  if (body.clientId) {
                    savePersistedOAuthConfig(body.clientId, body.clientSecret || '');
                  }
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, clientId: body.clientId }, null, 2));
                } catch (err) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: { message: err.message } }));
                }
              });
              return;
            }
          }

          // DELETE /api/antigravity/connections/:connectionId
          const deleteMatch = pathname.match(/^\/api\/antigravity\/connections\/(ag-0[1-7])$/);
          if (deleteMatch && req.method === 'DELETE') {
            try {
              const result = await antigravityEnrollmentSessionManagerInstance.disconnectConnection(deleteMatch[1]);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(result, null, 2));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: err.message } }));
            }
            return;
          }

        }

        next();
      });

      // Auto-start Local Router on 20200 when Vite starts
      import('./server/local_router/LocalRouterServer.mjs').then(({ createLocalRouterServer }) => {
        try {
          const router = createLocalRouterServer();
          router.listen(20200, '127.0.0.1', () => {
            console.log('\x1b[36mâš¡ [Vite Bootstrap] UltimateAI Local Router Live on http://127.0.0.1:20200\x1b[0m');
          });
          router.on('error', (err) => {
            if (err.code !== 'EADDRINUSE') console.warn('Local router warning:', err.message);
          });
        } catch {}
      }).catch(() => {});
    }
  };
}

export default defineConfig({
  plugins: [react(), nineRouterGatewayPlugin()],
  server: {
    port: 5177,
    watch: {
      ignored: ['**/storage/**', '**/tests/**', '**/.git/**', '**/scratch/**']
    }
  },
});
