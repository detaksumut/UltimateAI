/**
 * sourceLinks.mjs
 * Derives REAL, clickable original-source links for a market panel/asset.
 *
 * The UniversalResultModal rule is: NO RESULT WITHOUT SOURCE; every result must
 * show where it came from with a real clickable link. Panel `source` is a
 * descriptive string, so this module turns the instrument + provider metadata
 * into genuine URLs (Yahoo Finance, CoinGecko, Binance, Investing, gold.org).
 *
 * It never invents links: it only builds URLs from the real provider identifiers
 * carried on the asset (meta.yahoo / meta.coingeckoId) or from hard-known
 * official source pages. When no real URL can be built, it returns [].
 */

/**
 * Build primary + cross-check source links for an asset/panel.
 * @param {object} asset - asset object with { symbol, category, isGold, panelId, meta:{yahoo, coingeckoId}, source? }
 * @returns { { primary: {name,url}|null, crosscheck: [{name,url}] } }
 */
export function deriveSourceLinks(asset) {
  if (!asset) return { primary: null, crosscheck: [] };
  const meta = asset.meta || {};
  const symbol = String(asset.symbol || '').toLowerCase();
  const category = asset.category || '';
  const panelId = asset.panelId || '';
  const name = asset.name || asset.symbol || 'Sumber';

  const links = {
    primary: null,
    crosscheck: []
  };

  // Crypto: primary Binance spot page; cross-check CoinGecko.
  if (category === 'crypto') {
    const base = String(asset.symbol || '').split('/')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (base) {
      links.primary = { name: 'Binance', url: `https://www.binance.com/en/trade/${base}_USDT`, type: 'BURSA CRYPTO' };
      links.crosscheck.push({ name: 'CoinMarketCap', url: `https://coinmarketcap.com/currencies/${(meta.coingeckoId || asset.symbol || '').toLowerCase()}`, type: 'CROSS-CHECK' });
    }
    if (meta.coingeckoId) {
      links.crosscheck.push({ name: 'CoinGecko', url: `https://www.coingecko.com/en/coins/${meta.coingeckoId}`, type: 'CROSS-CHECK' });
    }
    return links;
  }

  // Gold: Antam / logammulia primary; gold.org cross-check.
  if (category === 'metals' && asset.isGold) {
    links.primary = { name: 'Logam Mulia (Antam)', url: 'https://www.logammulia.com/id/harga-emas-hari-ini', type: 'HARGA JUAL RESMI' };
    links.crosscheck.push({ name: 'World Gold Council', url: 'https://www.gold.org/goldhub/data/gold-prices', type: 'CROSS-CHECK' });
    return links;
  }

  // IHSG → Investing Indonesia.
  if (panelId === 'market.ihsg' || asset.id === 'ihsg' || (symbol.includes('^jkse'))) {
    links.primary = { name: 'Investing.com (IHSG)', url: 'https://id.investing.com/indices/idx-composite', type: 'BURSA' };
    return links;
  }

  // S&P 500 → Investing.
  if (panelId === 'market.sp500' || symbol === 'spx' || /s\s*&\s*p\s*500/.test(symbol)) {
    links.primary = { name: 'Investing.com (S&P 500)', url: 'https://www.investing.com/indices/s-p-500', type: 'INDEKS' };
    return links;
  }

  // Yahoo-sourced instruments (stocks / indices / commodities / valas / bonds): Yahoo Finance.
  if (meta.yahoo) {
    const yahooSymbol = String(meta.yahoo).trim();
    if (yahooSymbol) {
      links.primary = { name: name, url: `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}`, type: category.toUpperCase() };
    }
  }

  return links;
}

/**
 * Convenience: given a panel (or asset) object, return the source-link register
 * with a guaranteed primary label (falls back to the descriptive source string
 * when no URL exists, so the register still names the source).
 * @returns { { primary: {name,url,label}|null, crosscheck: [{name,url}] } }
 */
export function panelSourceRegister(panel) {
  const links = deriveSourceLinks(panel);
  const primary = links.primary
    ? { name: links.primary.name, url: links.primary.url, label: links.primary.type }
    : null;
  return { primary, crosscheck: links.crosscheck };
}

export default { deriveSourceLinks, panelSourceRegister };
