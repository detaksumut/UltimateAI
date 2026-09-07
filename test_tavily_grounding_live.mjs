/**
 * test_tavily_grounding_live.mjs
 * Verification script for autonomous Tavily web grounding and query refinement.
 */

import { webSearchToolInstance } from './server/tools/WebSearchTool.mjs';

function detectWebSearchIntent(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.toLowerCase();
  if (/\b(cari|carikan|searching|search|browsing|browsingkan|cek\s+internet|lihat\s+internet|buka\s+internet|tavily|googling|gugling)\b/i.test(p)) return true;
  const hasInfoNoun = /\b(berita|kabar|info|informasi|isu|peristiwa|kejadian|agenda|update|perkembangan|harga|kurs|saham)\b/i.test(p);
  const hasTemporal = /\b(202[4-6]|terbaru|terkini|hari\s+ini|bulan\s+ini|minggu\s+ini|september\s+2026|oktober\s+2026|november\s+2026|desember\s+2026)\b/i.test(p);
  return Boolean(hasInfoNoun && (hasTemporal || p.includes('internet') || p.includes('web') || p.includes('tavily')));
}

function refineSearchQuery(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';
  let q = prompt;
  q = q.replace(/bisakah\s+(anda|kamu|kau)\s+/gi, '');
  q = q.replace(/tolong\s+(carikan|cari|cek|temukan)\s+/gi, '');
  q = q.replace(/coba\s+(carikan|cari|cek|temukan)\s+/gi, '');
  q = q.replace(/apakah\s+(bisa|kamu\s+bisa|kau\s+bisa)\s+/gi, '');
  q = q.replace(/mungkin\s+tavily\s+bisa\s+membantu[^\,\.]*[\,\.]?/gi, '');
  q = q.replace(/utk\s+mencarinya\s+di\s+internet[\,\.]?/gi, '');
  q = q.replace(/di\s+internet[\,\.]?/gi, '');
  q = q.replace(/lewat\s+tavily[\,\.]?/gi, '');
  q = q.replace(/menggunakan\s+tavily[\,\.]?/gi, '');
  q = q.replace(/pake\s+tavily[\,\.]?/gi, '');
  q = q.replace(/pakai\s+tavily[\,\.]?/gi, '');
  q = q.replace(/\btavily\b/gi, '');
  q = q.replace(/\butk\b/gi, 'untuk');
  q = q.replace(/[\?\,\!]/g, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  if (q.length < 4) q = prompt.replace(/\btavily\b/gi, '').trim();
  return q;
}

async function run() {
  const userPrompt = "bisakah kau cari berita utk bulan September 2026, mungkin tavily bisa membantu utk mencarinya di internet.";
  const isIntent = detectWebSearchIntent(userPrompt);
  const cleanQ = refineSearchQuery(userPrompt);

  console.log('--- TEST INTENT & QUERY REFINEMENT ---');
  console.log('Raw prompt:     ', userPrompt);
  console.log('Detected Intent:', isIntent ? 'YES (SEARCH_INTENT)' : 'NO');
  console.log('Clean Query:    ', cleanQ);

  console.log('\n--- EXECUTING TAVILY WEB SEARCH ---');
  const res = await webSearchToolInstance.execute({ query: cleanQ, maxResults: 3 });
  console.log('Provider:      ', res.providerUsed || 'UNKNOWN');
  console.log('Sources count: ', res.sourcesCount || res.sources?.length || 0);
  if (res.sources && res.sources.length > 0) {
    res.sources.forEach((s, idx) => {
      console.log(`[${idx + 1}] ${s.title}`);
      console.log(`    URL:    ${s.url}`);
      console.log(`    Domain: ${s.domain}`);
      console.log(`    Score:  ${s.score}`);
    });
  }
}

run().catch(console.error);
