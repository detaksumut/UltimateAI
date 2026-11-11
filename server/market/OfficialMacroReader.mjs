/**
 * OfficialMacroReader.mjs
 * Shared reader for allowlisted official U.S. macroeconomic release sources.
 *
 * The raw HTML of these government pages is dominated by site chrome (skip
 * links, "official website" banners, mega-menus, footers). Stripping tags from
 * the whole document therefore returns navigation text instead of the actual
 * release schedule. This module locates the main content region first, trims
 * the footer and known trailing widgets, then converts only that region to
 * text.
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function officialSources() {
  return {
    fed: {
      label: 'Federal Reserve (FOMC)',
      url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
      host: 'www.federalreserve.gov',
      selector: /id="article"[^>]*>/i,
      stopText: ['Related Content', 'Recent Postings', 'Back to Top', 'Stay Connected']
    },
    bls: {
      label: 'BLS Releases',
      url: 'https://www.bls.gov/schedule/news_release/',
      host: 'www.bls.gov',
      selector: /class="[^"]*main-content[^"]*"[^>]*>/i,
      stopText: ['Subscribe to the BLS Online Calendar', 'Online calendar subscription']
    },
    bea: {
      label: 'BEA Releases',
      url: 'https://www.bea.gov/news/schedule',
      host: 'www.bea.gov',
      selector: /id="main-content"[^>]*>/i,
      stopText: ['Quick Links', 'Additional Formats', 'Media Contacts']
    },
    treasury: {
      label: 'US Treasury Yields',
      url: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=${currentMonthKey()}`,
      host: 'home.treasury.gov',
      selector: /id="main-content"[^>]*>/i,
      stopText: ['Looking for data on', 'About Treasury', 'Footer']
    },
    cftc: {
      label: 'CFTC COT Reports',
      url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
      host: 'www.cftc.gov',
      selector: /id="main-content"[^>]*>/i,
      stopText: ['Related Links', 'Footer']
    }
  };
}

const BOILERPLATE_RE = [
  /skip to (main )?content/i,
  /skip to main content/i,
  /an official website of the united states government/i,
  /official websites? use \.gov/i,
  /a \.gov website belongs to an official government organization/i,
  /secure \.gov websites? use https/i,
  /here'?s? (is )?how you know/i,
  /a lock \( ?lock/i,
  /the \.gov means it'?s official/i,
  /federal government websites often end in \.gov/i,
  /the site is secure/i,
  /https:\/\/ ensures that you are connecting/i,
  /information you provide is encrypted/i,
  /^primary tabs$/i,
  /^(upcoming releases|full schedule|\d{4} schedule)$/i,
  /^clear$/i,
  /^year \d{4}$/i,
  /^release$/i,
  /^month view \| list view$/i,
  /^(n\s*)?ews\s+release$/i,
  /^(d\s*)?ata\s+release$/i,
  /^(v\s*)?isual\s+data$/i,
  /^(a\s*)?rticle$/i,
  /^n\s+ews$/i,
  /^a\s+rticle$/i,
  /^d\s+ata$/i,
  /^v\s+isual$/i
];

const FOOTER_RE = /<footer\b|id="footer|class="[^"]*footer|role="contentinfo"|id="block-[^"]*footer/i;

function htmlToText(html) {
  const lines = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]*$/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !BOILERPLATE_RE.some(re => re.test(line)));

  const seen = [];
  let previous = '';
  for (const line of lines) {
    if (line.length < 2 && !/\d/.test(line)) continue;
    if (line.toLowerCase() === previous) continue;
    seen.push(line);
    previous = line.toLowerCase();
  }
  return seen;
}

function extractMainRegion(html, source) {
  const candidates = [
    source.selector,
    /id="main-content"[^>]*>/i,
    /class="[^"]*main-content[^"]*"[^>]*>/i,
    /id="press-results"[^>]*>/i,
    /id="content"[^>]*>/i,
    /<main\b[^>]*>/i,
    /<article\b[^>]*>/i
  ].filter(Boolean);

  let start = -1;
  for (const re of candidates) {
    const match = html.match(re);
    if (match) {
      start = match.index + match[0].length;
      break;
    }
  }
  if (start < 0) start = 0;

  let end = html.length;
  const footer = html.slice(start).match(FOOTER_RE);
  if (footer) end = Math.min(end, start + footer.index);

  return html.slice(start, end);
}

function cutAtStopText(text, stopText = []) {
  let cut = text.length;
  const lower = text.toLowerCase();
  for (const marker of stopText) {
    const index = lower.indexOf(String(marker).toLowerCase());
    if (index >= 0) cut = Math.min(cut, index);
  }
  return text.slice(0, cut);
}

/**
 * Read one allowlisted source and return a cleaned text payload.
 */
export async function readOfficialSource(key, source, { timeoutMs = 15000, maxChars = 6000 } = {}) {
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow'
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== source.host) {
      throw new Error('Unexpected source host');
    }

    const html = (await response.text()).slice(0, 1500000);
    const region = extractMainRegion(html, source);
    const text = cutAtStopText(htmlToText(region).join('\n'), source.stopText).trim();

    if (text.length < 80) throw new Error('Main content too short or blocked');

    return {
      key,
      label: source.label,
      url: finalUrl.href,
      status: 'READ',
      httpStatus: response.status,
      fetchedAt: new Date().toISOString(),
      content: text.slice(0, maxChars)
    };
  } catch (error) {
    return {
      key,
      label: source.label,
      url: source.url,
      status: 'SOURCE_UNAVAILABLE',
      fetchedAt: new Date().toISOString(),
      error: error?.message || 'Source unavailable'
    };
  }
}

export async function readOfficialSources(keys, options = {}) {
  const allowed = officialSources();
  const selected = [...new Set(keys)].filter(key => Object.hasOwn(allowed, key)).slice(0, 5);
  return Promise.all(selected.map(key => readOfficialSource(key, allowed[key], options)));
}
