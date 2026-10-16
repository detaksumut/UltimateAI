/**
 * DailyKnowledgeAugment.mjs
 * Auto-retrieval: menaikkan kecerdasan JIN (qwen3, cutoff 2023) dengan
 * menyuntikkan pengetahuan HARIAN hasil panen CuriosityDaemon (4 gelombang:
 * 07/13/17/21 WIB, live 2024-2026) sebagai konteks saat JIN menjawab.
 *
 * Sumber: storage/vault/learned_knowledge.json (ringkasan panen + sumber
 * terverifikasi). Hanya item yang cukup relevan dengan pertanyaan yang
 * disuntikkan, disertai tanggal panen agar JIN tidak mengira data lama.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VAULT_DIR = path.resolve(process.cwd(), 'storage', 'vault');
const LEARNED_FILE = path.join(VAULT_DIR, 'learned_knowledge.json');
const MAX_ITEMS_INJECTED = 4;
const MAX_BLOCK_CHARS = 6000;

// Kata kunci eksplisit: pertanyaan yang meminta info terkini → injeksi wajib
const EXPLICIT_TRIGGERS = /\b(terkini|terbaru|berita|update|kabar|perkembangan|hari\s+ini|kemarin|tadi\s+malam|akhir-akhir\s+ini|recent|latest|news|today|2024|2025|2026|harga|saham|ihsg|kripto|crypto|bitcoin|inflasi|apbn|apbd|suku\s+bunga|bi\s+rate)\b/i;

// Pemetaan kategori panen → kata kunci afinitas (agar pertanyaan tematik
// menemukan panenan klaster yang tepat meski tanpa kata persis pada ringkasan)
const CATEGORY_AFFINITY = {
  POLITIK: ['presiden', 'pemerintah', 'politik', 'kabinet', 'parlemen', 'dpr', 'mpr', 'pemilu', 'partai', 'birokrasi', 'reformasi', 'tata negara', 'menteri'],
  EKONOMI: ['ekonomi', 'inflasi', 'pajak', 'fiskal', 'moneter', 'bi rate', 'suku bunga', 'apbn', 'apbd', 'gdp', 'pdb', 'rupiah', 'neraca', 'impor', 'ekspor', 'investasi'],
  PASAR_MODAL: ['saham', 'ihsg', 'bursa', 'emiten', 'net foreign', 'dividen', 'blue chip', 'market', 'koreksi'],
  KOMODITAS: ['komoditas', 'cpo', 'minyak', 'batu bara', 'batubara', 'nikel', 'tembaga', 'emas', 'crude', 'palm oil'],
  KRIPTO: ['kripto', 'crypto', 'bitcoin', 'ethereum', 'btc', 'eth', 'altcoin', 'web3', 'bappebti', 'ojk', 'defi', 'nft'],
  HUKUM: ['hukum', 'mk', 'mahkamah', 'putusan', 'peradilan', 'korupsi', 'kpk', 'regulasi', 'kepatuhan', 'uji materiil'],
  SOSIAL: ['tenaga kerja', 'ketenagakerjaan', 'upah', 'umk', 'ump', 'demografi', 'pendidikan', 'serikat', 'jaminan sosial', 'bpjs', 'sosial'],
  HUMANIORA: ['kesehatan', 'bpjs kesehatan', 'rumah sakit', 'bioteknologi', 'pangan', 'medi', 'vaksin', 'gaya hidup'],
  TEKNOLOGI: ['ai', 'llm', 'agen', 'agentic', 'teknologi', 'sains', 'gpu', 'semikonduktor', 'cybersecurity', 'zero-day', 'ransomware', 'nvidia', 'tsmc', 'open source', 'chip'],
  REGIONAL: ['asean', 'asia tenggara', 'indo-pasifik', 'laut cina selatan', 'diplomasi', 'regional'],
  CHINA: ['china', 'tiongkok', 'beijing', 'ev', 'kendaraan listrik', 'manufaktur', 'semikonduktor china', 'baterai'],
  BURSA_ASIA: ['nikkei', 'hang seng', 'kospi', 'taiwan', 'asia timur', 'aliran modal'],
  GLOBAL_MARKET: ['wall street', 's&p 500', 'nasdaq', 'fed', 'federal reserve', 'treasury', 'dollar', 'dolar', 'amerika', 'fund rate'],
  EROPA: ['eropa', 'ecb', 'zona euro', 'ai act', 'inggris', 'uk', 'european', 'bank sentral eropa'],
  EURASIA: ['rusia', 'brics', 'moscow', 'gazprom', 'minyak rusia', 'eurasia', 'gas']
};

function _loadHarvest() {
  if (!fs.existsSync(LEARNED_FILE)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(LEARNED_FILE, 'utf-8') || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function _tokens(text = '') {
  return new Set(String(text).toLowerCase().split(/[^a-z0-9]+/i).filter(w => w.length > 2));
}

function _affinityScore(query, category) {
  const keys = CATEGORY_AFFINITY[category] || [];
  if (!keys.length) return 0;
  const q = String(query).toLowerCase();
  let score = 0;
  for (const k of keys) {
    if (typeof k === 'string' && q.includes(k)) score += 4;
  }
  return score;
}

function _recencyDays(generatedAt) {
  try {
    const then = new Date(generatedAt).getTime();
    if (!Number.isFinite(then)) return 999;
    return Math.max(0, Math.round((Date.now() - then) / 86400000));
  } catch {
    return 999;
  }
}

function _scoreItem(item, query, queryTokens, explicit) {
  const category = item.category || '';
  const searchable = `${item.name || ''} ${category.toLowerCase()} ${item.summary || ''}`;
  const itemTokens = _tokens(searchable);

  let overlap = 0;
  for (const t of queryTokens) {
    if (itemTokens.has(t)) overlap += 2;
  }

  const affinity = _affinityScore(query, category);
  const recencyBoost = Math.max(0, 6 - _recencyDays(item.generatedAt));
  return overlap + affinity + recencyBoost + (explicit ? 5 : 0);
}

function retrieveHarvest(harvestItems, userPrompt, { maxItems = MAX_ITEMS_INJECTED } = {}) {
  const query = String(userPrompt || '');
  if (!query.trim()) return [];

  const queryTokens = _tokens(query);
  const explicit = EXPLICIT_TRIGGERS.test(query);

  const scored = harvestItems
    .map(item => ({ item, score: _scoreItem(item, query, queryTokens, explicit) }))
    .filter(({ score }) => score >= 8)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxItems).map(({ item }) => item);
}

export function buildHarvestContext(harvestItems, userPrompt) {
  const picked = retrieveHarvest(harvestItems, userPrompt);
  if (!picked.length) return null;

  const lines = [];
  lines.push('--- [KONTEKS PENGETAHUAN TERBARU JIN (HASIL PANEN HARIAN 2024-2026)] ---');
  lines.push('Berikut data terkini yang dipanen JIN dari internet (CuriosityDaemon, 4 gelombang harian).');
  lines.push('GUNAKAN data ini sebagai sumber fakta terkini yang MELAMPUI pengetahuan bawaan Anda (cutoff 2023).');
  lines.push('Sebutkan tanggal panen (data "terpilah tanggal") agar pengguna tahu ini data live.');

  for (const item of picked) {
    const dateStr = (item.generatedAt || '')
      .replace('T', ' ').replace(/\.\d+Z?$|Z$/, '') + ' WIB';
    lines.push(`\n[PANEN ${item.cluster || ''} | ${item.name || ''} | ${item.category || ''} | ${dateStr}]:`);
    lines.push(`${item.summary || ''}`);
    const src = (item.sources || []).slice(0, 3);
    if (src.length) {
      lines.push(`Sumber: ${src.map(s => `${s.title} (${s.domain || 'web'})`).join('; ')}`);
    }
  }

  lines.push('--- [AKHIR KONTEKS PENGETAHUAN TERBARU] ---');

  let block = lines.join('\n');
  if (block.length > MAX_BLOCK_CHARS) {
    block = block.slice(0, MAX_BLOCK_CHARS) + '\n--- [AKHIR KONTEKS PENGETAHUAN TERBARU] ---';
  }
  return block;
}

/**
 * Inject konteks panenan ke pesan user terakhir. Mengembalikan boolean
 * (apakah konteks berhasil disuntikkan) untuk keperluan logging.
 */
export function augmentMessagesWithHarvest(messages = [], userPrompt = '') {
  if (!Array.isArray(messages) || !messages.length) return false;
  if (String(userPrompt || '').includes('--- [BERKAS DOKUMEN')) return false;

  // Hindari double-inject di pesan yang sudah membawa konteks memori/panen
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return false;
  const existing = typeof lastUser.content === 'string' ? lastUser.content : JSON.stringify(lastUser.content || '');
  if (existing.includes('KONTEKS PENGETAHUAN TERBARU') || existing.includes('DATA MEMORI BERDAULAT')) return false;

  const harvest = _loadHarvest();
  const block = buildHarvestContext(harvest, userPrompt);
  if (!block) return false;

  if (typeof lastUser.content === 'string') {
    lastUser.content += `\n${block}`;
  } else if (Array.isArray(lastUser.content)) {
    lastUser.content.push({ type: 'text', text: block });
  } else {
    lastUser.content = String(lastUser.content || '') + `\n${block}`;
  }
  console.log(`[DAILY_KNOWLEDGE_AUGMENT] Suntik ${harvest.length ? 'konteks panenan' : ''} → pesan user (relevan)`);
  return true;
}

export default {
  retrieveHarvest,
  buildHarvestContext,
  augmentMessagesWithHarvest
};