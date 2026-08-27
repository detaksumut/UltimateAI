import * as http from "http";

export type HttpMethod = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

export interface RouteMatch {
  params: Record<string, string>;
  handler: RouteHandler;
}

export type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: Record<string, string>,
  body: unknown
) => Promise<void>;

interface RouteEntry {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

/**
 * RestRouter — lightweight URL pattern matching and handler dispatch.
 * Supports named path parameters (e.g. /api/v1/status/:requestId).
 */
export class RestRouter {
  private readonly routes: RouteEntry[] = [];

  on(method: HttpMethod, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const regexSource = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    this.routes.push({
      method,
      pattern: new RegExp(`^${regexSource}$`),
      paramNames,
      handler
    });
  }

  match(method: string, url: string): RouteMatch | undefined {
    const cleanUrl = url.split("?")[0]; // strip query string
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = cleanUrl.match(route.pattern);
      if (!m) continue;
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
      return { params, handler: route.handler };
    }
    return undefined;
  }
}
