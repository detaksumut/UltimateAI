/**
 * sourceCache.js
 * Tahap 7A — per-source TTL cache with in-flight request deduplication.
 *
 * The cache never stores failures and never fabricates values. Callers keep the
 * original provider timestamps, so a cached payload is still evaluated against
 * the current clock and can be reported as stale instead of appearing live.
 */

export function createSourceCache({ now = () => Date.now() } = {}) {
  const entries = new Map();
  const inflight = new Map();

  async function load(key, { ttlMs = 0, force = false, loader } = {}) {
    if (typeof loader !== 'function') throw new TypeError('sourceCache.load requires a loader function');
    const current = now();
    const entry = entries.get(key);
    if (!force && entry && ttlMs > 0 && current - entry.at < ttlMs) {
      return {
        value: entry.value,
        cache: {
          hit: true,
          deduped: false,
          ageMs: current - entry.at,
          fetchedAt: new Date(entry.at).toISOString(),
        },
      };
    }

    const pending = inflight.get(key);
    if (pending) {
      const value = await pending;
      return {
        value,
        cache: {
          hit: false,
          deduped: true,
          ageMs: 0,
          fetchedAt: new Date(now()).toISOString(),
        },
      };
    }

    const promise = Promise.resolve().then(loader);
    inflight.set(key, promise);
    try {
      const value = await promise;
      const at = now();
      if (value !== undefined && value !== null) entries.set(key, { at, value });
      return {
        value,
        cache: {
          hit: false,
          deduped: false,
          ageMs: 0,
          fetchedAt: new Date(at).toISOString(),
        },
      };
    } finally {
      inflight.delete(key);
    }
  }

  return {
    load,
    clear() {
      entries.clear();
    },
    size() {
      return entries.size;
    },
  };
}

export function withTimeout(promise, timeoutMs, label = 'source') {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
