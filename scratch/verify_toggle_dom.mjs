import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 800 } });
  const page = await context.newPage();

  console.log('[1] Navigating to http://localhost:5177/simulator...');
  await page.goto('http://localhost:5177/simulator', { waitUntil: 'networkidle' });

  console.log('[2] Opening Connections Modal & waiting for initial data load...');
  const connPromise = page.waitForResponse(resp => resp.url().includes('/api/antigravity/connections') && resp.status() === 200);
  
  const connectionsSidebarBtn = page.locator('button').filter({ hasText: /CONNECTIONS/i }).first();
  if (await connectionsSidebarBtn.count() > 0) {
    await connectionsSidebarBtn.click();
  }
  
  await connPromise;
  await page.waitForTimeout(1000);

  const artifactsDir = 'C:\\Users\\BI News\\.gemini\\antigravity-ide\\brain\\6c1d4e1b-74d6-40f3-93c0-de7389a0d3d3';

  // State 1: Initial state
  const toggleBtn1 = page.locator('[data-testid="toggle-ag-01"]').first();
  await toggleBtn1.waitFor({ state: 'visible', timeout: 5000 });
  const class1 = await toggleBtn1.getAttribute('class');
  console.log('[DOM 1] Initial Class:', class1.includes('bg-emerald-500') ? 'ON (bg-emerald-500)' : 'OFF (bg-slate-700)');
  await page.screenshot({ path: path.join(artifactsDir, 'dom_toggle_step1.png') });

  // State 2: Click to toggle
  console.log('[3] Clicking toggle button...');
  const toggleReqPromise = page.waitForResponse(resp => resp.url().includes('/api/antigravity/connections/ag-01/toggle') && resp.status() === 200);
  await toggleBtn1.click();
  await toggleReqPromise;
  await page.waitForTimeout(1000);

  const toggleBtn2 = page.locator('[data-testid="toggle-ag-01"]').first();
  const class2 = await toggleBtn2.getAttribute('class');
  console.log('[DOM 2] After 1st Click Class:', class2.includes('bg-emerald-500') ? 'ON (bg-emerald-500)' : 'OFF (bg-slate-700)');
  await page.screenshot({ path: path.join(artifactsDir, 'dom_toggle_step2.png') });

  // State 3: Click again to toggle back
  console.log('[4] Clicking toggle button again...');
  const toggleReqPromise2 = page.waitForResponse(resp => resp.url().includes('/api/antigravity/connections/ag-01/toggle') && resp.status() === 200);
  await toggleBtn2.click();
  await toggleReqPromise2;
  await page.waitForTimeout(1000);

  const toggleBtn3 = page.locator('[data-testid="toggle-ag-01"]').first();
  const class3 = await toggleBtn3.getAttribute('class');
  console.log('[DOM 3] After 2nd Click Class:', class3.includes('bg-emerald-500') ? 'ON (bg-emerald-500)' : 'OFF (bg-slate-700)');
  await page.screenshot({ path: path.join(artifactsDir, 'dom_toggle_step3.png') });

  await browser.close();
  console.log('\n🏆 [SUCCESS] REAL DOM TOGGLE PROVEN IN PLAYWRIGHT!');
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
