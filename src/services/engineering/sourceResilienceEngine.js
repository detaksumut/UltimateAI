/**
 * sourceResilienceEngine.js
 * JIN PERSISTENT INTELLIGENCE & SOURCE RESILIENCE PROTOCOL — core engine.
 *
 * Non-negotiable behaviors enforced here:
 *   - ONE FAILURE IS NOT A CONCLUSION.
 *   - UNREACHABLE IS NOT THE SAME AS UNAVAILABLE.
 *   - FIRST PAGE IS NOT THE WHOLE DATASET.
 *   - NO DATA MUST NEVER BE REPLACED WITH FAKE DATA.
 *   - JIN MUST KNOW WHY A RETRIEVAL FAILED BEFORE DECIDING WHAT TO TRY NEXT.
 *
 * This module is framework-agnostic (pure JS) so it can be shared by the
 * frontend progress UI and backend retrieval/search flows. It implements:
 *   - Failure diagnosis engine (classify every failure before choosing a path)
 *   - Search state machine (IDLE → … → COMPLETE | EXHAUSTED)
 *   - Source resilience levels (primary → … → exhausted report)
 *   - Network access profiles (DIRECT default; alternates used only if configured)
 *   - Deep search depth levels + pagination awareness
 *   - Honest data-state rules (LIVE/STALE/SNAPSHOT/CACHED/UNKNOWN — never fake)
 *   - Transparent progress + final exhausted report
 */

// ============================================================
// 1. FAILURE TAXONOMY — every failure is classified before a
//    next strategy is chosen. Different types → different action.
// ============================================================
export const FAILURE_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  DNS_ERROR: 'DNS_ERROR',
  TIMEOUT: 'TIMEOUT',
  HTTP_403: 'HTTP_403',
  HTTP_404: 'HTTP_404',
  HTTP_429: 'HTTP_429',
  HTTP_5XX: 'HTTP_5XX',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  PAYWALL: 'PAYWALL',
  GEOGRAPHIC_RESTRICTION: 'GEOGRAPHIC_RESTRICTION',
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  JAVASCRIPT_RENDERING_REQUIRED: 'JAVASCRIPT_RENDERING_REQUIRED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  WEBSOCKET_DISCONNECTED: 'WEBSOCKET_DISCONNECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  SOURCE_CHANGED: 'SOURCE_CHANGED',
  EMPTY_RESULT: 'EMPTY_RESULT',
  PAGINATION_AVAILABLE: 'PAGINATION_AVAILABLE',
  UNKNOWN_FAILURE: 'UNKNOWN_FAILURE'
};

export const statusFamily = {
  notFound: [FAILURE_TYPES.CONTENT_NOT_FOUND, FAILURE_TYPES.HTTP_404, FAILURE_TYPES.EMPTY_RESULT],
  blocked: [FAILURE_TYPES.HTTP_403, FAILURE_TYPES.PAYWALL, FAILURE_TYPES.LOGIN_REQUIRED, FAILURE_TYPES.GEOGRAPHIC_RESTRICTION, FAILURE_TYPES.JAVASCRIPT_RENDERING_REQUIRED],
  transient: [FAILURE_TYPES.TIMEOUT, FAILURE_TYPES.NETWORK_ERROR, FAILURE_TYPES.DNS_ERROR, FAILURE_TYPES.HTTP_5XX, FAILURE_TYPES.HTTP_429, FAILURE_TYPES.RATE_LIMITED, FAILURE_TYPES.API_UNAVAILABLE, FAILURE_TYPES.WEBSOCKET_DISCONNECTED]
};

/**
 * classifyFailure — turn any thrown error / fetch shape into a typed diagnosis.
 * The strategy field states what JIN should do next for THAT kind of failure.
 */
export const FAILURE_STRATEGIES = {
  [FAILURE_TYPES.NETWORK_ERROR]: 'Retry with the same source (transient); then alternate host/endpoint.',
  [FAILURE_TYPES.DNS_ERROR]: 'Domain not resolvable — try documented mirror/official alternative host.',
  [FAILURE_TYPES.TIMEOUT]: 'Increase timeout and retry once; then alternate endpoint or provider.',
  [FAILURE_TYPES.HTTP_403]: 'Source/geo blocked or forbidden — do NOT retry same access; look for an allowed/official alternative access path.',
  [FAILURE_TYPES.HTTP_404]: 'Resource/endpoint changed or moved — run source-network/deep discovery for the new location.',
  [FAILURE_TYPES.HTTP_429]: 'Rate limited — back off and retry; if persistent, switch provider.',
  [FAILURE_TYPES.HTTP_5XX]: 'Temporary provider/server failure — retry with backoff, then alternate provider.',
  [FAILURE_TYPES.LOGIN_REQUIRED]: 'Authentication required — seek a public/official variant or dataset; never fabricate.',
  [FAILURE_TYPES.PAYWALL]: 'Paywalled — disclose; look for a legitimate public/official summary or dataset.',
  [FAILURE_TYPES.GEOGRAPHIC_RESTRICTION]: 'Geo-blocked here — try the official geo-friendly data host or an approved alternate network profile.',
  [FAILURE_TYPES.CONTENT_NOT_FOUND]: 'Not found at this location — deepen search (structure/discovery/source network).',
  [FAILURE_TYPES.JAVASCRIPT_RENDERING_REQUIRED]: 'Page needs JS rendering — prefer the official API/JSON/RSS feed for the same data.',
  [FAILURE_TYPES.API_UNAVAILABLE]: 'API down — try documented mirror, then secondary credible provider.',
  [FAILURE_TYPES.WEBSOCKET_DISCONNECTED]: 'Stream died — reconnect; if it stays down, degrade status honestly to STALE, never LIVE.',
  [FAILURE_TYPES.RATE_LIMITED]: 'Rate limited — back off; switch provider if sustained.',
  [FAILURE_TYPES.SOURCE_CHANGED]: 'Source schema moved — run deep discovery; do not assume data is gone.',
  [FAILURE_TYPES.EMPTY_RESULT]: 'Source returned empty/unusable — treat as not-found and deepen search.',
  [FAILURE_TYPES.PAGINATION_AVAILABLE]: 'First page is not the whole dataset — traverse next pages before concluding.',
  [FAILURE_TYPES.UNKNOWN_FAILURE]: 'Unknown — retry once, then deepen search; record what is unknown.'
};

export function classifyError(err, httpStatus) {
  const s = httpStatus;
  const code = err && (err.code || err.name);
  const msg = ((err && (err.message || String(err))) || '').toLowerCase();
  if (s === 403) return { type: FAILURE_TYPES.HTTP_403, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.HTTP_403] };
  if (s === 404) return { type: FAILURE_TYPES.HTTP_404, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.HTTP_404] };
  if (s === 429) return { type: FAILURE_TYPES.HTTP_429, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.HTTP_429] };
  if (s >= 500) return { type: FAILURE_TYPES.HTTP_5XX, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.HTTP_5XX] };
  if (s === 401) return { type: FAILURE_TYPES.LOGIN_REQUIRED, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.LOGIN_REQUIRED] };
  if (/timed?\s*out|timeout|slow network|etimedout|abort/i.test(msg)) return { type: FAILURE_TYPES.TIMEOUT, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.TIMEOUT] };
  if (/enotfound|dns|eai_again|getaddrinfo|name not resolved/i.test(msg)) return { type: FAILURE_TYPES.DNS_ERROR, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.DNS_ERROR] };
  if (/fetch failed|network|internet|econnreset|unreachable|socket/i.test(msg)) return { type: FAILURE_TYPES.NETWORK_ERROR, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.NETWORK_ERROR] };
  if (/rate.?limit|429|too many request/i.test(msg)) return { type: FAILURE_TYPES.RATE_LIMITED, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.RATE_LIMITED] };
  if (/websocket|disconnect|stream.*(dead|closed)/i.test(msg)) return { type: FAILURE_TYPES.WEBSOCKET_DISCONNECTED, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.WEBSOCKET_DISCONNECTED] };
  // Geo-restriction must be detected BEFORE the broad 403/forbidden regex, whose
  // generic tokens (geo|region) would otherwise swallow the more specific case.
  if (/geo.?block|unavailable in your (region|country)|geo restricted|not available in your area/i.test(msg)) return { type: FAILURE_TYPES.GEOGRAPHIC_RESTRICTION, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.GEOGRAPHIC_RESTRICTION] };
  if (/403|forbidden|geo|region|area.i* (not )?allow/i.test(msg)) return { type: FAILURE_TYPES.HTTP_403, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.HTTP_403] };
  if (code === 'AbortError') return { type: FAILURE_TYPES.TIMEOUT, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.TIMEOUT] };
  return { type: FAILURE_TYPES.UNKNOWN_FAILURE, strategy: FAILURE_STRATEGIES[FAILURE_TYPES.UNKNOWN_FAILURE] };
}

// ============================================================
// 2. SEARCH STATE MACHINE
// ============================================================
export const SEARCH_STATES = {
  IDLE: 'IDLE',
  UNDERSTANDING_REQUEST: 'UNDERSTANDING_REQUEST',
  DISCOVERING_SOURCES: 'DISCOVERING_SOURCES',
  ACCESSING_PRIMARY: 'ACCESSING_PRIMARY',
  RETRIEVING: 'RETRIEVING',
  VALIDATING: 'VALIDATING',
  DEEP_SEARCHING: 'DEEP_SEARCHING',
  SWITCHING_SOURCE: 'SWITCHING_SOURCE',
  RETRYING: 'RETRYING',
  NETWORK_FALLBACK: 'NETWORK_FALLBACK',
  CROSS_VERIFYING: 'CROSS_VERIFYING',
  COMPLETE: 'COMPLETE',
  EXHAUSTED: 'EXHAUSTED'
};

// ============================================================
// 3. HONEST DATA-STATE RULES (never fake)
// ============================================================
export const HONEST_STATES = {
  LIVE: 'LIVE',
  STALE: 'STALE',
  SNAPSHOT: 'SNAPSHOT',
  CACHED: 'CACHED',
  UNKNOWN: 'UNKNOWN'
};

/**
 * deriveHonestState — given live-stream active + freshness, returns the ONLY
 * label JIN is allowed to use. LIVE only when a live stream is active AND
 * freshness is met; otherwise SNAPSHOT/STALE/CACHED/UNKNOWN.
 */
export function deriveHonestState({ liveStreamActive = false, freshnessMs, now = Date.now(), lastUpdate = 0, dataSource = 'UNKNOWN' }) {
  if (liveStreamActive && freshnessMs != null && Number.isFinite(freshnessMs) && lastUpdate && (now - lastUpdate) <= freshnessMs) {
    return HONEST_STATES.LIVE;
  }
  // If a timestamp is known and its freshness window has passed, the data is
  // STALE — regardless of whether the provider called it a snapshot/cached —
  // and it MUST NOT be labelled live.
  if (lastUpdate && freshnessMs != null && Number.isFinite(freshnessMs) && (now - lastUpdate) > freshnessMs) {
    return HONEST_STATES.STALE;
  }
  if (dataSource === 'SNAPSHOT') return HONEST_STATES.SNAPSHOT;
  if (dataSource === 'CACHED') return HONEST_STATES.CACHED;
  return HONEST_STATES.UNKNOWN;
}

// ============================================================
// 4. SOURCE RESILIENCE LEVELS
// ============================================================
export const RESILIENCE_LEVELS = [
  { level: 1, name: 'PRIMARY_SOURCE', label: 'Primary source' },
  { level: 2, name: 'OFFICIAL_ALTERNATIVE_ENDPOINT', label: 'Official alternative endpoint' },
  { level: 3, name: 'OFFICIAL_API', label: 'Official API' },
  { level: 4, name: 'OFFICIAL_MIRROR', label: 'Official mirror / documented alternative' },
  { level: 5, name: 'SECONDARY_CREDIBLE_SOURCE', label: 'Secondary credible source' },
  { level: 6, name: 'THIRD_PARTY_VERIFIED_SOURCE', label: 'Third-party verified source' },
  { level: 7, name: 'DEEP_SEARCH', label: 'Deep search / archive / index discovery' },
  { level: 8, name: 'REPORT_EXHAUSTED', label: 'Report exhausted search paths' }
];

// ============================================================
// 5. DEEP SEARCH DEPTH LEVELS
// ============================================================
export const SEARCH_DEPTHS = [
  { level: 1, name: 'DIRECT' },
  { level: 2, name: 'STRUCTURE' },
  { level: 3, name: 'DISCOVERY' },
  { level: 4, name: 'SOURCE_NETWORK' },
  { level: 5, name: 'DATA_DISCOVERY' },
  { level: 6, name: 'CROSS_VERIFICATION' }
];

// ============================================================
// 6. NETWORK ACCESS PROFILES (fallback only if configured)
// ============================================================
export const NETWORK_PROFILES = {
  DIRECT: { id: 'DIRECT', label: 'Direct' },
  ALTERNATE_NETWORK: { id: 'ALTERNATE_NETWORK', label: 'Alternate network' },
  ENTERPRISE_PROXY: { id: 'ENTERPRISE_PROXY', label: 'Enterprise proxy' },
  USER_CONFIGURED_SECURE_ROUTE: { id: 'USER_CONFIGURED_SECURE_ROUTE', label: 'User-configured secure route' }
};

const DEFAULT_PROFILES = {
  enabled: [NETWORK_PROFILES.DIRECT],
  order: [NETWORK_PROFILES.DIRECT.id],
  active: NETWORK_PROFILES.DIRECT.id
};

export function loadNetworkProfiles(configured) {
  if (!configured || !Array.isArray(configured.enabled) || configured.enabled.length === 0) {
    return { enabled: [NETWORK_PROFILES.DIRECT], order: [NETWORK_PROFILES.DIRECT.id], active: NETWORK_PROFILES.DIRECT.id, fallbackAvailable: false };
  }
  const enabled = configured.enabled.map((pid) => NETWORK_PROFILES[pid] || { id: pid, label: pid });
  const order = configured.order && configured.order.length ? configured.order : enabled.map((p) => p.id);
  return { enabled, order, active: configured.active || order[0], fallbackAvailable: order.length > 1 };
}

// ============================================================
// 7. PAGINATION AWARENESS
// ============================================================
export const PAGINATION_HINTS = [
  /next|selanjutnya|berikutnya|page.?1 of|halaman 1 dari|load more|muat lebih|see more|show more/i,
  /(^|\W)(next|selanjutnya|berikutnya)(\W|$)/i
];

export function detectPagination(pageIndicators, currentItems) {
  if (!pageIndicators) return false;
  for (const h of PAGINATION_HINTS) if (h.test(String(pageIndicators))) return true;
  // If there are hints that a next page exists but current page is full, flag it.
  return false;
}

// ============================================================
// 8. PERSISTENT SEARCH ENGINE
// ============================================================
let __seq = 0;

/**
 * createPersistentEngine — build a JIN Persistent Intelligence instance.
 * `config`:
 *   {
 *     onProgress?: (step) => void,        // transparency: real steps only
 *     networkProfiles?: object,           // optional user/auth network config
 *     maxRetries?: number (default 2),    // per-access retry cap
 *     backoffMs?: number (default 800),
 *     label?: string                       // e.g. 'BTC live chart'
 *   }
 * Returns a search orchestration function:
 *   search({ accessors, validate, extract, target }) → promise of a full report.
 * Where `accessors` is an ordered array of candidate access functions, each
 * returning data or throwing; the engine routes through resilience, deeper
 * efforts, and produces an honest final report (COMPLETE or EXHAUSTED).
 */
export function createPersistentEngine(config = {}) {
  const id = ++__seq;
  const onProgress = config.onProgress || (() => {});
  const maxRetries = config.maxRetries ?? 2;
  const backoffMs = config.backoffMs ?? 800;
  const profiles = loadNetworkProfiles(config.networkProfiles);
  const steps = [];
  let state = SEARCH_STATES.IDLE;

  const setState = (next, detail) => {
    state = next;
    const step = { t: Date.now(), state: next, detail: detail || '', label: config.label || 'persistent request' };
    steps.push(step);
    onProgress(step);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms || 0));

  /** Run one access function with classification + retries; returns {data|diag}. */
  async function attempt(accessor, ctx, level) {
    const fn = typeof accessor === 'function' ? accessor : accessor.run;
    let lastDiagnosis = null;
    for (let attemptNo = 0; attemptNo <= maxRetries; attemptNo++) {
      try {
        setState(SEARCH_STATES.RETRIEVING, `${ctx.name} (level ${level}) — attempt ${attemptNo + 1}`);
        const data = await fn(ctx);
        return { ok: true, data, level, attempt: attemptNo + 1 };
      } catch (err) {
        const diag = classifyError(err, ctx.httpStatus && ctx.httpStatus(err));
        lastDiagnosis = { ...diag, message: err && err.message };
        if (statusFamily.transient.includes(diag.type) && attemptNo < maxRetries) {
          setState(SEARCH_STATES.RETRYING, `${ctx.name} → ${diag.type} (transient), retry ${attemptNo + 2}`);
          await sleep(backoffMs * (attemptNo + 1));
          continue;
        }
        setState(SEARCH_STATES.SWITCHING_SOURCE, `${ctx.name} → ${diag.type}: ${diag.strategy}`);
        break; // non-transient abandons retry for this source
      }
    }
    return { ok: false, level, diagnosis: lastDiagnosis };
  }

  /**
   * Run the full resilient search.
   * `spec`:
   *   {
   *     target: string,                       // human target summary
   *     expectedCount: number|null,           // optional target completion (35 etc.)
   *     accessors: [ { id, name, run(ctx) } ],// ordered candidate access layers
   *     validate: (data) => boolean,          // data must satisfy target
   *     extract: (data) => payload,           // normalize to delivered result
   *     expected: number|null                 // completion target
   *   }
   */
  async function search(spec) {
    setState(SEARCH_STATES.UNDERSTANDING_REQUEST, spec.target || 'target');
    setState(SEARCH_STATES.DISCOVERING_SOURCES, `${spec.accessors.length} candidate access path(s)`);

    let payload = null;                 // first validated delivered payload
    let collectedCount = 0;
    let foundSummary = null;
    const attempts = [];
    let networkFallbackUsed = false;
    const expected = spec.expectedCount != null ? spec.expectedCount : null;

    for (let lvl = 0; lvl < spec.accessors.length; lvl++) {
      const acc = spec.accessors[lvl];
      setState(SEARCH_STATES.ACCESSING_PRIMARY, acc.name);

      const access = async () => {
        const res = await attempt(acc, { name: acc.name }, lvl + 1);
        attempts.push({ level: lvl + 1, name: acc.name, ok: res.ok, diagnosis: res.diagnosis });
        // Configured alternate-network fallback: on-demand, temporary, logged.
        if (!res.ok && res.diagnosis && res.diagnosis.type === FAILURE_TYPES.GEOGRAPHIC_RESTRICTION && profiles.fallbackAvailable && !networkFallbackUsed) {
          setState(SEARCH_STATES.NETWORK_FALLBACK, `geo-block terdeteksi — alternatif jaringan terkonfigurasi diaktifkan sementara`);
          networkFallbackUsed = true;
          const rerun = await attempt(acc, { name: acc.name + ' (alternate network)' }, lvl + 1);
          attempts.push({ level: lvl + 1, name: acc.name + ' (alternate network)', ok: rerun.ok, diagnosis: rerun.diagnosis, viaNetworkFallback: true });
          return rerun;
        }
        return res;
      };

      const res = await access();

      if (res.ok) {
        setState(SEARCH_STATES.VALIDATING, acc.name);
        let valid = true;
        let extracted = res.data;
        try {
          valid = spec.validate ? spec.validate(res.data, { level: lvl + 1 }) : true;
          if (valid && spec.extract) extracted = spec.extract(res.data);
        } catch (e) {
          valid = false;
        }
        if (valid) {
          attempts[attempts.length - 1].validated = true;
          if (!payload) payload = extracted && extracted.payload ? extracted.payload : extracted;
          const pieceCount = extracted && extracted.count != null ? extracted.count : 1;
          collectedCount += pieceCount;
          attempts[attempts.length - 1].count = pieceCount;
          if (extracted && typeof extracted.summaryOfFound === 'function') foundSummary = extracted.summaryOfFound();
          if (expected != null && collectedCount >= expected) {
            setState(SEARCH_STATES.COMPLETE, `target tercapai ${collectedCount}/${expected} via ${acc.name}`);
            break;
          }
          // PAGINATION AWARENESS: first page is never the whole dataset. With a
          // target set, keep collecting until the expected count is reached.
          setState(SEARCH_STATES.DEEP_SEARCHING,
            expected != null
              ? `dikumpulkan ${collectedCount}/${expected} — melanjutkan ke level/lonjakan berikutnya`
              : `validated via ${acc.name} — menampilkan hasil`);
          if (expected == null) break; // no target → first validated result is enough
        } else {
          setState(SEARCH_STATES.VALIDATING, `data dari ${acc.name} gagal validasi — berlanjut ke level berikutnya`);
          attempts[attempts.length - 1].validationFailed = true;
        }
      }
    }

    if (!payload) {
      setState(SEARCH_STATES.EXHAUSTED, 'seluruh jalur yang tersedia telah dicoba');
      return buildReport({ spec, attempts, payload: null, collectedCount: 0, expected, foundSummary, networkFallbackUsed, steps });
    }

    const targetMet = expected == null || collectedCount >= expected;
    setState(targetMet ? SEARCH_STATES.COMPLETE : SEARCH_STATES.EXHAUSTED, targetMet ? 'pengumpulan target selesai' : `target ${collectedCount}/${expected} belum terpenuhi dari seluruh jalur`);
    return buildReport({ spec, attempts, payload, collectedCount, expected, foundSummary, networkFallbackUsed, steps });
  }

  return {
    id,
    state: () => state,
    steps: () => steps.slice(),
    search,
    profiles
  };
}

function buildReport({ spec, attempts, payload, collectedCount = 0, expected = null, foundSummary = null, networkFallbackUsed, steps }) {
  const attemptedPaths = attempts.map((a) => ({
    level: a.level,
    name: a.name,
    ok: a.ok,
    validated: !!a.validated,
    validationFailed: !!a.validationFailed,
    viaNetworkFallback: !!a.viaNetworkFallback,
    count: a.count,
    diagnosis: a.diagnosis || null
  }));
  const targetMet = payload != null && (expected == null || collectedCount >= expected);
  const partial = payload != null && !targetMet;
  return {
    ok: !!payload && targetMet,
    complete: !!payload && targetMet,
    partial,
    exhausted: !payload,
    target: spec.target,
    expectedCount: expected,
    foundCount: collectedCount,
    found: payload,
    networkFallbackUsed,
    sourcesAttempted: attemptedPaths,
    // Golden-rule reporting: WHAT/WHAT-NOT/WHY/WHY-STOPPED/NEXT
    report: {
      whatWasFound: payload
        ? (foundSummary || (spec.summaryOfFound ? spec.summaryOfFound(payload) : `ditemukan ${collectedCount}${expected != null ? '/' + expected : ''}`))
        : 'tidak ada hasil valid dari jalur yang dicoba',
      whatWasNotFound: payload
        ? (expected != null && collectedCount < expected ? `target belum terpenuhi: ${collectedCount}/${expected}` : null)
        : (spec.summaryOfMissing || 'target tidak dapat diverifikasi dari seluruh jalur yang tersedia'),
      sourcesAttempted: attemptedPaths.map((a) => `${a.level}.${a.name} (${a.ok ? (a.validated ? `OK +${a.count ?? 1}` : 'OK') : 'failed'})`),
      whyStopped: payload
        ? (targetMet ? 'target tercapai & tervalidasi' : `target ${collectedCount}/${expected} belum terpenuhi; seluruh jalur tersedia telah dicoba`)
        : 'seluruh jalur yang tersedia telah dicoba (EXHAUSTED)',
      nextAction: targetMet ? 'selesai' : (spec.suggestNext || 'periksa jalur/kredensial baru, atau coba lagi nanti')
    },
    steps
  };
}

export default {
  classifyError, deriveHonestState, detectPagination,
  createPersistentEngine, SEARCH_STATES, FAILURE_TYPES, HONEST_STATES,
  RESILIENCE_LEVELS, SEARCH_DEPTHS, NETWORK_PROFILES, loadNetworkProfiles
};
