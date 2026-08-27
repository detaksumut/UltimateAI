import * as http from "http";
import * as crypto from "crypto";

const VALID_API_KEYS = new Set(["ultimateai-dev-key", "ultimateai-test-key"]);

/**
 * RestMiddleware — cross-cutting concerns for the REST delivery channel.
 * Applies: request logging, API key validation, CORS, X-Request-ID,
 * error serialization.
 */
export class RestMiddleware {

  /** Attach X-Request-ID to every response. */
  static requestId(req: http.IncomingMessage, res: http.ServerResponse): string {
    const id = (req.headers["x-request-id"] as string) ?? crypto.randomUUID();
    res.setHeader("X-Request-ID", id);
    return id;
  }

  /** Set CORS headers permissively (Phase H — Phase J will tighten). */
  static cors(res: http.ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Request-ID");
  }

  /**
   * API key check.
   * Pass `X-API-Key: ultimateai-dev-key` header to authenticate.
   * In dev mode (no header), request is allowed as anonymous.
   */
  static apiKey(req: http.IncomingMessage): boolean {
    const key = req.headers["x-api-key"] as string | undefined;
    if (!key) return true; // anonymous allowed in Phase H (stub, real enforcement in Phase J)
    return VALID_API_KEYS.has(key);
  }

  /** Log incoming request to stdout. */
  static log(req: http.IncomingMessage, requestId: string): void {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.url} — X-Request-ID: ${requestId}`);
  }

  /** Send a JSON response. */
  static json(res: http.ServerResponse, status: number, body: unknown, requestId?: string): void {
    const payload = JSON.stringify(body, null, 2);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      ...(requestId ? { "X-Request-ID": requestId } : {})
    });
    res.end(payload);
  }

  /** Send a standardized error response. */
  static error(res: http.ServerResponse, status: number, message: string, code: string, requestId?: string): void {
    RestMiddleware.json(res, status, { error: message, code, requestId }, requestId);
  }

  /** Parse JSON body from incoming request. */
  static body(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString();
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          reject(new Error("Invalid JSON body"));
        }
      });
      req.on("error", reject);
    });
  }
}
