const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const PORT = 9999;
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:5177/simulator';

app.use(cors());
app.use(express.json());

let browser = null;
let context = null;
let page = null;
let isInitializing = false;

/**
 * Inisialisasi Browser Headless & Halaman Simulator
 * Menggunakan sistem Chrome / Edge yang sudah terpasang di OS
 */
async function initBridge() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    console.log('🚀 [JIN DOM BRIDGE] Menginisialisasi koneksi antarmuka browser...');
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }

    // Coba launch dengan sistem Chrome, fallback ke MS Edge, fallback ke default chromium
    const launchOptions = [
      { channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
      { channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
      { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    ];

    let lastErr = null;
    for (const opt of launchOptions) {
      try {
        browser = await chromium.launch(opt);
        console.log(`✨ [JIN DOM BRIDGE] Browser aktif via kanal: ${opt.channel || 'chromium'}`);
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!browser) {
      throw lastErr || new Error('Gagal meluncurkan browser Playwright');
    }

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });

    page = await context.newPage();

    console.log(`🌐 [JIN DOM BRIDGE] Membuka target: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`✅ [JIN DOM BRIDGE] Aktif & Memonitor UI Simulator: ${TARGET_URL}`);
  } catch (err) {
    console.error('❌ [JIN DOM BRIDGE] Gagal inisialisasi browser:', err.message);
  } finally {
    isInitializing = false;
  }
}

/**
 * Helper: Pastikan halaman siap
 */
async function ensurePage() {
  if (!page || page.isClosed()) {
    await initBridge();
  }
  return page;
}

// ==========================================
// 1. ENDPOINT: Status Bridge
// ==========================================
app.get('/api/status', async (req, res) => {
  const isReady = page && !page.isClosed();
  res.json({
    status: isReady ? 'ONLINE' : 'INITIALIZING',
    agent: 'JIN-DOM-Bridge',
    port: PORT,
    targetUrl: TARGET_URL,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 2. ENDPOINT: Full Accessibility & DOM Tree
// ==========================================
app.get('/api/dom', async (req, res) => {
  try {
    const activePage = await ensurePage();
    if (!activePage) {
      return res.status(503).json({ error: 'Browser instance belum siap' });
    }

    // 1. Ambil Accessibility Snapshot (Struktur Semantik UI) jika didukung
    let accessibilityTree = null;
    try {
      if (activePage.accessibility && typeof activePage.accessibility.snapshot === 'function') {
        accessibilityTree = await activePage.accessibility.snapshot({ interestingOnly: false });
      }
    } catch (_) {}

    // 2. Ekstrak Elemen Interaktif Kunci (Tombol, Input, Badge Status, Tab)
    const interactiveElements = await activePage.evaluate(() => {
      const items = [];

      document.querySelectorAll('button, a, [role="button"], input, textarea').forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        
        if (isVisible) {
          items.push({
            id: el.id || `el-${index}`,
            tag: el.tagName.toLowerCase(),
            type: el.type || null,
            text: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 100),
            title: el.title || null,
            disabled: el.disabled || false,
            className: el.className ? String(el.className).slice(0, 80) : null
          });
        }
      });

      return items;
    });

    // 3. Ekstrak Teks Terlihat Utama (Header, Status, Live Messages)
    const pageTextSummary = await activePage.evaluate(() => {
      const textNodes = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        const val = node.nodeValue.trim();
        if (val.length > 2 && !val.startsWith('{') && !val.includes('function(')) {
          textNodes.push(val);
        }
      }
      return textNodes.slice(0, 100);
    });

    res.json({
      success: true,
      targetUrl: TARGET_URL,
      title: await activePage.title(),
      totalInteractiveElements: interactiveElements.length,
      interactiveElements,
      accessibilityTree,
      pageTextSummary
    });
  } catch (err) {
    console.error('Error saat membaca DOM:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. ENDPOINT: Screenshot Visual Halaman
// ==========================================
app.get('/api/screenshot', async (req, res) => {
  try {
    const activePage = await ensurePage();
    if (!activePage) return res.status(503).json({ error: 'Browser belum siap' });

    const format = req.query.format || 'base64'; // 'base64' | 'image'
    const buffer = await activePage.screenshot({ fullPage: false, type: 'png' });

    if (format === 'image') {
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    }

    res.json({
      success: true,
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ENDPOINT: Eksekusi Aksi UI (Klik / Ketik)
// ==========================================
app.post('/api/action', async (req, res) => {
  try {
    const activePage = await ensurePage();
    if (!activePage) return res.status(503).json({ error: 'Browser belum siap' });

    const { action, selector, text, key } = req.body;

    if (action === 'click') {
      await activePage.click(selector, { timeout: 5000 });
      return res.json({ success: true, message: `Klik berhasil pada ${selector}` });
    }

    if (action === 'type') {
      await activePage.fill(selector, text, { timeout: 5000 });
      return res.json({ success: true, message: `Berhasil mengetik pada ${selector}` });
    }

    if (action === 'press') {
      await activePage.keyboard.press(key || 'Enter');
      return res.json({ success: true, message: `Tombol ${key} ditekan` });
    }

    if (action === 'reload') {
      await activePage.reload({ waitUntil: 'domcontentloaded' });
      return res.json({ success: true, message: 'Halaman direfresh' });
    }

    res.status(400).json({ error: `Aksi "${action}" tidak didukung` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Jalankan Server Bridge
app.listen(PORT, async () => {
  console.log('==================================================');
  console.log(` 🌐 JIN DOM Bridge Server Running on http://localhost:${PORT}`);
  console.log(` 🎯 Target Simulator: ${TARGET_URL}`);
  console.log(` 📡 Endpoints:`);
  console.log(`    - GET  /api/status      (Status Bridge)`);
  console.log(`    - GET  /api/dom         (Accessibility & DOM Tree)`);
  console.log(`    - GET  /api/screenshot  (Live Screenshot Base64/PNG)`);
  console.log(`    - POST /api/action      (Eksekusi Klik & Ketik UI)`);
  console.log('==================================================');
  
  await initBridge();
});
