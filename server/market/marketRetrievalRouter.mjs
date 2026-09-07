/**
 * marketRetrievalRouter.mjs
 * CANONICAL MARKET RETRIEVAL ROUTER.
 *
 * MarketQuery (utterance)
 *   → CanonicalInstrumentResolver
 *   → ProviderRouter (fallback chain, per category)
 *   → ProviderAdapters (each with its OWN symbol format)
 *   → Normalized Common Schema
 *
 * Golden rules enforced here:
 *   - A common instrument like BTC must NOT terminate at the first failed internal
 *     route. The router attempts EVERY configured provider before concluding.
 *   - EXHAUSTED is allowed ONLY AFTER canonical resolution succeeded AND every
 *     configured provider was actually attempted and failed/returned unverifiable
 *     data.
 *   - DO NOT give up because ONE internal engine / symbol mapping / provider /
 *     endpoint failed.
 *   - Distinguish NO DATA EXISTS (unresolvable instrument → immediate honest no) from
 *     THE CURRENT PROVIDER FAILED (keep trying the chain).
 *   - Never fabricate a price. If only price is available, return just that.
 *   - The UI source list reflects ONLY providers actually attempted (diagnostics).
 */
import { resolveCanonicalInstrument, providerChainFor } from './instrumentResolver.mjs';
import * as adapters from './providerAdapters.mjs';

const ADAPTERS = {
  binance: adapters.binanceQuote,
  coingecko: adapters.coingeckoQuote,
  yahoo: adapters.yahooQuote
};

// Optionally honor a narrowed/forced provider order override (e.g. certifi tests).
function effectiveChain(canonical, options = {}) {
  const base = providerChainFor(canonical);
  if (Array.isArray(options.providerOrder) && options.providerOrder.length) {
    const lower = options.providerOrder.map((p) => String(p).toLowerCase());
    const filtered = base.filter((p) => lower.includes(p));
    return filtered.length ? filtered : base;
  }
  return base;
}

/**
 * Retrieve REAL market data for an utterance/canonical/panelId.
 * @param {string|object} query - utterance, canonical object, or panelId
 * @param {object} options - { providerOrder?, reportType? }
 * @returns { Promise<object> } normalizedResult (common schema) or honest exhausted
 */
export async function retrieveMarketData(query, options = {}) {
  const canonical = (query && typeof query === 'object' && query.asset)
    ? query
    : resolveCanonicalInstrument(query);

  if (!canonical) {
    return {
      ok: false,
      exhausted: true,
      exhaustedReason: 'CANONICAL_UNRESOLVED',
      canonical: null,
      result: null,
      diagnostics: [],
      message: 'Instrumen tidak dikenali — tidak ada jalur provider yang relevan.'
    };
  }

  const diagnostics = [];
  const attempted = [];
  const chain = effectiveChain(canonical, options);

  for (const providerName of chain) {
    const adapter = ADAPTERS[providerName];
    if (!adapter) {
      diagnostics.push({ provider: providerName, status: 'SKIPPED no-adapter' });
      continue;
    }
    attempted.push(providerName);
    try {
      const result = await adapter(canonical, diagnostics);
      // Normalize is already performed by the adapter (common schema).
      return {
        ok: true,
        exhausted: false,
        canonical,
        result: sanitize(result),
        diagnostics,
        providerUsed: providerName,
        attempted
      };
    } catch (err) {
      const diag = adapters.classifyRouterError(err,
        err && /HTTP (\d+)/.exec(String(err.message)) ? Number(/HTTP (\d+)/.exec(String(err.message))[1]) : undefined);
      diagnostics.push({
        provider: providerName,
        status: 'FAILED',
        failureType: diag.type,
        reason: err && err.message ? String(err.message).slice(0, 200) : String(err)
      });
    }
  }

  // Only reached after EVERY configured provider was attempted.
  return {
    ok: false,
    exhausted: true,
    exhaustedReason: 'ALL_PROVIDERS_FAILED',
    canonical,
    result: null,
    diagnostics,
    attempted,
    message: 'Semua provider yang dikonfigurasi telah dicoba dan tidak mengembalikan data yang dapat diverifikasi.'
  };
}

/** Strip any non-schema fields; keep only real returned values. */
function sanitize(r) {
  return {
    asset: r.asset,
    symbol: r.symbol,
    price: r.price,
    currency: r.currency,
    change24h: r.change24h,
    high24h: r.high24h,
    low24h: r.low24h,
    volume24h: r.volume24h,
    source: r.source,
    sourceUrl: r.sourceUrl,
    retrievedAt: r.retrievedAt,
    verificationStatus: r.verificationStatus
  };
}

export default { retrieveMarketData };