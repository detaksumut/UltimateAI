import * as crypto from "crypto";
import { OrchestrationResult } from "./OrchestratorEngine";

interface CachedEntry {
  readonly hash: string;
  readonly result: OrchestrationResult;
  readonly cachedAt: string;
  readonly naturalLanguage: string;
}

/**
 * IdempotencyGuard prevents duplicate execution of identical requests.
 * Uses SHA-256 hash of (naturalLanguage + serialized options) as the cache key.
 * If the same request arrives twice, the cached result is returned immediately.
 */
export class IdempotencyGuard {
  private readonly cache: Map<string, CachedEntry> = new Map();

  /** Compute a deterministic hash for a request. */
  computeHash(naturalLanguage: string, options?: unknown): string {
    const payload = JSON.stringify({ naturalLanguage, options: options ?? null });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /** Return the cached result if one exists for this hash. */
  check(hash: string): OrchestrationResult | undefined {
    return this.cache.get(hash)?.result;
  }

  /** Store a result against its hash. */
  store(hash: string, naturalLanguage: string, result: OrchestrationResult): void {
    this.cache.set(hash, {
      hash,
      result,
      cachedAt: new Date().toISOString(),
      naturalLanguage
    });
  }

  /** Return all cache entries (for audit/export). */
  listEntries(): Omit<CachedEntry, "result">[] {
    return Array.from(this.cache.values()).map(({ result: _r, ...meta }) => meta);
  }

  /** Remove a cached entry (force re-execution). */
  invalidate(hash: string): boolean {
    return this.cache.delete(hash);
  }

  get size(): number {
    return this.cache.size;
  }
}
