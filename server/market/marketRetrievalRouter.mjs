/**
 * Market retrieval router.
 * Provider adapters must be exported by providerAdapters.mjs and must also be
 * present in the canonical instrument's provider chain.
 */
import { resolveCanonicalInstrument, providerChainFor } from './instrumentResolver.mjs';
import * as adapters from './providerAdapters.mjs';

const ADAPTERS = {
  binance: adapters.binanceQuote,
  coingecko: adapters.coingeckoQuote
};

function effectiveChain(canonical, options = {}) {
  const base = providerChainFor(canonical);
  if (Array.isArray(options.providerOrder) && options.providerOrder.length) {
    const lower = options.providerOrder.map(p => String(p).toLowerCase());
    const filtered = base.filter(p => lower.includes(p));
    return filtered.length ? filtered : base;
  }
  return base;
}

export async function retrieveMarketData(query, options = {}) {
  const canonical = query && typeof query === 'object' && query.asset
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
  for (const providerName of effectiveChain(canonical, options)) {
    const adapter = ADAPTERS[providerName];
    if (typeof adapter !== 'function') {
      diagnostics.push({ provider: providerName, status: 'SKIPPED no-adapter' });
      continue;
    }
    attempted.push(providerName);
    try {
      const result = await adapter(canonical, diagnostics);
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
      const statusMatch = err && /HTTP (\d+)/.exec(String(err.message));
      const diag = adapters.classifyRouterError(err, statusMatch ? Number(statusMatch[1]) : undefined);
      diagnostics.push({
        provider: providerName,
        status: 'FAILED',
        failureType: diag.type,
        reason: err && err.message ? String(err.message).slice(0, 200) : String(err)
      });
    }
  }

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
