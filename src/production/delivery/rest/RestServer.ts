import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { StudioFacade } from "../../studio/StudioFacade";
import { StudioHealthCheck } from "../../studio/StudioHealthCheck";
import { RestRouter } from "./RestRouter";
import { RestMiddleware } from "./RestMiddleware";
import { DEFAULT_ORCHESTRATION_MANIFEST } from "../../orchestrator/OrchestrationManifest";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DASHBOARD_DIR = path.resolve(__dirname, "../web");

// ─── Version info ─────────────────────────────────────────────────────────────

const VERSION_INFO = {
  api: "v1",
  studio: "1.0.0",
  orchestrator: "1.0.0",
  generator: "USGEC-1.0",
  foundation: DEFAULT_ORCHESTRATION_MANIFEST.foundationBaseline,
  phase: "H"
};

/**
 * RestServer — HTTP delivery channel for UltimateAI Studio API.
 *
 * ADR-009: All route handlers MUST call StudioFacade methods only.
 * No direct access to OrchestratorEngine or lower layers is permitted here.
 */
export class RestServer {
  private readonly studio: StudioFacade;
  private readonly health: StudioHealthCheck;
  private readonly router: RestRouter;
  private server?: http.Server;

  // SSE: track active event-stream clients
  private readonly sseClients = new Set<http.ServerResponse>();

  constructor() {
    this.studio = new StudioFacade();
    this.health = new StudioHealthCheck();
    this.router = new RestRouter();
    this.registerRoutes();

    // Subscribe notification bus → broadcast to all SSE clients
    this.studio.notificationBus.on("*", notification => {
      const data = `data: ${JSON.stringify(notification)}\n\n`;
      for (const client of this.sseClients) {
        try { client.write(data); } catch { this.sseClients.delete(client); }
      }
    });
  }

  // ─── Route registration ──────────────────────────────────────────────────

  private registerRoutes(): void {
    const r = this.router;

    // Generation
    r.on("POST", "/api/v1/generate", async (req, res, _, body) => {
      const { naturalLanguage, priority, asOf, maxTimeMs, tags } = body as any;
      if (!naturalLanguage) return RestMiddleware.error(res, 400, "naturalLanguage required", "VALIDATION_ERROR");
      const result = await this.studio.submit({ naturalLanguage, priority, asOf, maxTimeMs, tags });
      RestMiddleware.json(res, 200, result);
    });

    r.on("POST", "/api/v1/preview", async (req, res, _, body) => {
      const { naturalLanguage, asOf } = body as any;
      if (!naturalLanguage) return RestMiddleware.error(res, 400, "naturalLanguage required", "VALIDATION_ERROR");
      const result = await this.studio.preview({ naturalLanguage, asOf });
      RestMiddleware.json(res, 200, result);
    });

    r.on("POST", "/api/v1/replay/:requestId", async (req, res, params, body) => {
      const { asOf } = body as any;
      if (!asOf) return RestMiddleware.error(res, 400, "asOf required", "VALIDATION_ERROR");
      const result = await this.studio.replay(params.requestId, asOf);
      RestMiddleware.json(res, 200, result);
    });

    // Status + control
    r.on("GET", "/api/v1/status/:requestId", async (req, res, params) => {
      const state = this.studio.getStatus(params.requestId);
      if (!state) return RestMiddleware.error(res, 404, "Request not found", "NOT_FOUND");
      RestMiddleware.json(res, 200, state);
    });

    r.on("DELETE", "/api/v1/cancel/:requestId", async (req, res, params) => {
      const ok = this.studio.cancel(params.requestId);
      RestMiddleware.json(res, 200, { cancelled: ok, requestId: params.requestId });
    });

    r.on("GET", "/api/v1/requests", async (req, res) => {
      RestMiddleware.json(res, 200, this.studio.listRequests());
    });

    // Observability
    r.on("GET", "/api/v1/metrics", async (req, res) => {
      RestMiddleware.json(res, 200, this.studio.getMetrics());
    });

    r.on("GET", "/api/v1/trace/:requestId", async (req, res, params) => {
      const trace = this.studio.getTrace(params.requestId);
      if (!trace) return RestMiddleware.error(res, 404, "Trace not found", "NOT_FOUND");
      RestMiddleware.json(res, 200, trace);
    });

    r.on("GET", "/api/v1/events/:requestId", async (req, res, params) => {
      const log = this.studio.getEventLog(params.requestId);
      RestMiddleware.json(res, 200, log);
    });

    // Intelligence
    r.on("GET", "/api/v1/capabilities", async (req, res) => {
      RestMiddleware.json(res, 200, this.studio.getCapabilityMatrix());
    });

    r.on("GET", "/api/v1/policies", async (req, res) => {
      RestMiddleware.json(res, 200, this.studio.getPolicyVersionHistory());
    });

    // Export
    r.on("POST", "/api/v1/export/:requestId", async (req, res, params, body) => {
      const { format = "json" } = body as any;
      try {
        const bundle = this.studio.export(params.requestId, format);
        RestMiddleware.json(res, 200, bundle);
      } catch (e: any) {
        RestMiddleware.error(res, 404, e.message, "NOT_FOUND");
      }
    });

    // Health (enhanced with version metadata)
    r.on("GET", "/api/v1/health", async (req, res) => {
      const report = this.health.check();
      RestMiddleware.json(res, report.status === "unhealthy" ? 503 : 200, {
        ...report,
        version: VERSION_INFO
      });
    });

    // OpenAPI spec
    r.on("GET", "/api/v1/openapi.json", async (req, res) => {
      const spec = this.buildOpenApiSpec();
      RestMiddleware.json(res, 200, spec);
    });
  }

  // ─── Server lifecycle ─────────────────────────────────────────────────────

  start(port = 3099): Promise<void> {
    return new Promise(resolve => {
      this.server = http.createServer(async (req, res) => {
        const requestId = RestMiddleware.requestId(req, res);
        RestMiddleware.cors(res);
        RestMiddleware.log(req, requestId);

        if (!RestMiddleware.apiKey(req)) {
          return RestMiddleware.error(res, 401, "Invalid API key", "UNAUTHORIZED", requestId);
        }

        // Handle preflight
        if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

        // Serve dashboard static files
        if (req.url === "/" || req.url === "/dashboard") {
          return this.serveDashboard(res);
        }

        // SSE endpoint for live notifications
        if (req.url === "/events" && req.method === "GET") {
          return this.handleSSE(req, res);
        }

        const match = this.router.match(req.method ?? "GET", req.url ?? "/");
        if (!match) {
          return RestMiddleware.error(res, 404, `Route not found: ${req.method} ${req.url}`, "NOT_FOUND", requestId);
        }

        try {
          const body = ["POST", "PUT", "PATCH"].includes(req.method ?? "")
            ? await RestMiddleware.body(req)
            : {};
          await match.handler(req, res, match.params, body);
        } catch (err: any) {
          console.error(`[ERROR] ${req.url}:`, err.message);
          RestMiddleware.error(res, 500, err.message, "INTERNAL_ERROR", requestId);
        }
      });

      this.server.listen(port, () => {
        console.log(`\n🚀 UltimateAI REST Server running on http://localhost:${port}`);
        console.log(`   Dashboard: http://localhost:${port}/`);
        console.log(`   OpenAPI:   http://localhost:${port}/api/v1/openapi.json`);
        console.log(`   SSE:       http://localhost:${port}/events\n`);
        resolve();
      });
    });
  }

  stop(): void {
    this.server?.close();
    this.sseClients.forEach(c => c.end());
    this.sseClients.clear();
  }

  // ─── SSE ─────────────────────────────────────────────────────────────────

  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write(`data: ${JSON.stringify({ type: "connected", message: "UltimateAI SSE stream active" })}\n\n`);
    this.sseClients.add(res);
    req.on("close", () => { this.sseClients.delete(res); });
  }

  // ─── Static dashboard ────────────────────────────────────────────────────

  private serveDashboard(res: http.ServerResponse): void {
    const htmlPath = path.join(DASHBOARD_DIR, "dashboard.html");
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync(htmlPath));
    } else {
      RestMiddleware.json(res, 200, { message: "UltimateAI Studio API", version: VERSION_INFO });
    }
  }

  // ─── OpenAPI spec builder ─────────────────────────────────────────────────

  private buildOpenApiSpec(): object {
    return {
      openapi: "3.0.3",
      info: {
        title: "UltimateAI Studio API",
        version: VERSION_INFO.api,
        description: "UltimateAI Studio Control Plane — ADR-008/ADR-009",
        contact: { name: "UltimateAI" }
      },
      servers: [{ url: "http://localhost:3099", description: "Local Dev" }],
      paths: {
        "/api/v1/generate": {
          post: { summary: "Submit generation request", tags: ["Generation"],
            requestBody: { required: true, content: { "application/json": { schema: {
              type: "object", required: ["naturalLanguage"],
              properties: { naturalLanguage: { type: "string" }, priority: { type: "string", enum: ["high","normal","low"] }, asOf: { type: "string" }, maxTimeMs: { type: "number" } }
            }}}},
            responses: { "200": { description: "StudioResult" }, "400": { description: "Validation error" } }
          }
        },
        "/api/v1/preview": {
          post: { summary: "Preview blueprint + architecture (no generation)", tags: ["Generation"],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { naturalLanguage: { type: "string" } }}}}},
            responses: { "200": { description: "PreviewResult" } }
          }
        },
        "/api/v1/status/{requestId}": {
          get: { summary: "Get request status", tags: ["Status"],
            parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "ExecutionState" }, "404": { description: "Not found" } }
          }
        },
        "/api/v1/cancel/{requestId}": {
          delete: { summary: "Cancel a running request", tags: ["Status"],
            parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Cancellation result" } }
          }
        },
        "/api/v1/metrics": { get: { summary: "Get aggregated metrics", tags: ["Observability"], responses: { "200": { description: "MetricsSummary" } } } },
        "/api/v1/trace/{requestId}": { get: { summary: "Get pipeline trace", tags: ["Observability"],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "PipelineTrace" }, "404": { description: "Not found" } } }
        },
        "/api/v1/events/{requestId}": { get: { summary: "Get event log for request", tags: ["Observability"],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OrchestrationEvent[]" } } }
        },
        "/api/v1/capabilities": { get: { summary: "Get generator capability matrix", tags: ["Intelligence"], responses: { "200": { description: "GeneratorCapabilityMeta[]" } } } },
        "/api/v1/policies": { get: { summary: "Get policy version history", tags: ["Intelligence"], responses: { "200": { description: "PolicyVersionEntry[]" } } } },
        "/api/v1/export/{requestId}": { post: { summary: "Export result in specified format", tags: ["Export"],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { format: { type: "string", enum: ["json","yaml","markdown","zip"] } } } } } },
          responses: { "200": { description: "ExportBundle" }, "404": { description: "Not found" } } }
        },
        "/api/v1/health": { get: { summary: "System health report with version metadata", tags: ["Health"], responses: { "200": { description: "HealthReport + VERSION_INFO" } } } },
        "/api/v1/requests": { get: { summary: "List all requests", tags: ["Status"], responses: { "200": { description: "ExecutionState[]" } } } },
        "/events": { get: { summary: "Server-Sent Events stream for live notifications", tags: ["SSE"] } }
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" }
        }
      }
    };
  }
}

// ─── Standalone entry point ───────────────────────────────────────────────────

// Standalone entry point (ESM)
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = new RestServer();
  server.start(3099);
}
