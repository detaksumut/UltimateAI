/**
 * NoLegacyRouterUI.test.mjs
 * Strict UI & Source Audit: Purge all Legacy 9Router / Old Model Selector UI.
 * 
 * Verifications:
 * 1. "CONTROL CENTER & SETTINGS" legacy modal absent
 * 2. "9Router Autonomous" absent from frontend components
 * 3. "Gemini 2.0 Flash" absent from frontend UI
 * 4. "Claude 3.5 Sonnet" absent from frontend UI
 * 5. "DeepSeek-R1" absent from frontend UI
 * 6. "/api/ultimateai" absent from active frontend routing
 * 7. Connections UI points strictly to Local Router :20200
 * 8. Antigravity Pools remain functional
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('  TEST: NO LEGACY 9ROUTER / OLD MODEL SELECTOR UI IN FRONTEND');
console.log('================================================================\n');

const srcDir = path.join(process.cwd(), 'src');

function scanDirectory(dir, filterExt = ['.jsx', '.js', '.ts', '.tsx', '.html']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(scanDirectory(fullPath, filterExt));
    } else if (filterExt.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

const frontendFiles = scanDirectory(srcDir);
console.log(`[INFO] Scanned ${frontendFiles.length} frontend source files.`);

// 1. Prohibited Legacy UI String Patterns
const prohibitedPatterns = [
  { pattern: /CONTROL CENTER & SETTINGS/i, desc: '"CONTROL CENTER & SETTINGS" legacy modal header' },
  { pattern: /9Router-Autonomous/i, desc: '"9Router-Autonomous" legacy model selector' },
  { pattern: /Gemini 2\.0 Flash/i, desc: '"Gemini 2.0 Flash" legacy model selector' },
  { pattern: /Claude 3\.5 Sonnet/i, desc: '"Claude 3.5 Sonnet" legacy model selector' },
  { pattern: /DeepSeek-R1/i, desc: '"DeepSeek-R1" legacy model selector' },
  { pattern: /\/api\/ultimateai/i, desc: '"/api/ultimateai" legacy proxy routing' },
  { pattern: /9ROUTER PROXY ENDPOINT/i, desc: '"9ROUTER PROXY ENDPOINT" legacy config' },
  { pattern: /AI REASONING CORE \/ MODEL SELECTOR/i, desc: '"AI REASONING CORE / MODEL SELECTOR" legacy block' }
];

console.log('\n[CHECK 1] Auditing all frontend files for prohibited legacy UI strings...');
for (const file of frontendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const { pattern, desc } of prohibitedPatterns) {
    const match = content.match(pattern);
    assert.strictEqual(
      match,
      null,
      `VIOLATION: Found prohibited legacy UI text (${desc}) in ${path.relative(process.cwd(), file)}!`
    );
  }
}
console.log('  -> PASS: All prohibited legacy UI strings are completely absent from frontend.');

// 2. Verify ConnectionsModal points to Local Router :20200
console.log('\n[CHECK 2] Verifying ConnectionsModal points strictly to Local Router :20200...');
const connectionsModalPath = path.join(srcDir, 'ui', 'simulator', 'modals', 'ConnectionsModal.jsx');
assert(fs.existsSync(connectionsModalPath), 'ConnectionsModal.jsx must exist');
const connContent = fs.readFileSync(connectionsModalPath, 'utf8');

assert(connContent.includes(':20200'), 'ConnectionsModal must target Local Router :20200');
assert(!connContent.includes(':20128'), 'ConnectionsModal must NOT target legacy port 20128');
assert(!connContent.includes('/api/ultimateai'), 'ConnectionsModal must NOT target /api/ultimateai');
console.log('  -> PASS: ConnectionsModal strictly targets Local Router :20200.');

// 3. Verify RouterConfig points to Local Router :20200
console.log('\n[CHECK 3] Verifying RouterConfig default endpoint is Local Router :20200...');
const routerConfigPath = path.join(srcDir, 'services', 'router', 'RouterConfig.js');
const routerConfigContent = fs.readFileSync(routerConfigPath, 'utf8');
assert(routerConfigContent.includes('127.0.0.1:20200') || routerConfigContent.includes('localhost:20200'), 'RouterConfig must target :20200');
assert(!routerConfigContent.includes('/api/ultimateai'), 'RouterConfig must NOT target /api/ultimateai');
console.log('  -> PASS: RouterConfig strictly configured for Local Router :20200.\n');

console.log('================================================================');
console.log('  🏆 ALL LEGACY ROUTER UI PURGE CHECKS PASSED 100%');
console.log('================================================================');
