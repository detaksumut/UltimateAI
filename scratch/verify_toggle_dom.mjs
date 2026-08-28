import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 800 } });
  const page = await context.newPage();

  console.log('[1] Navigating to http://localhost:5177/simulator...');
  await page.goto('http://localhost:5177/simulator', { waitUntil: 'networkidle' });

  console.log('[2] Opening Connections Modal...');
  const connectionsSidebarBtn = page.locator('button').filter({ hasText: /CONNECTIONS/i }).first();
  if (await connectionsSidebarBtn.count() > 0) {
    await connectionsSidebarBtn.click();
  }

  await page.waitForTimeout(2000);

  const artifactsDir = 'C:\\Users\\BI News\\.gemini\\antigravity-ide\\brain\\6c1d4e1b-74d6-40f3-93c0-de7389a0d3d3';

  // Find the toggle button on AG-01
  const toggleBtn = page.locator('[data-testid="toggle-ag-01"]').first();
  await toggleBtn.waitFor({ state: 'visible', timeout: 5000 });

  const initialClass = await toggleBtn.getAttribute('class');
  console.log('[DOM 1] Initial Class:', initialClass);
  await page.screenshot({ path: path.join(artifactsDir, 'dom_toggle_state1_on.png') });

  console.log('[3] Clicking toggle button to switch OFF...');
  await toggleBtn.click();
  await page.waitForTimeout(1500);

  const offBtn = page.locator('[data-testid="toggle-ag-01"]').first();
  const offClass = await offBtn.getAttribute('class');
  console.log('[DOM 2] OFF Class:', offClass);
  await page.screenshot({ path: path.join(artifactsDir, 'dom_toggle_state2_off.png') });

  console.log('[4] Clicking toggle button to switch back ON...');
  await offBtn.click();
  await page.waitForTimeout(1500);

  const onBtn = page.locator('[data-testid="toggle-ag-01"]').first();
  const onClass = await onBtn.getAttribute('class');
  console.log('[DOM 3] Back ON Class:', onClass);
  await page.screenshot({ path: path.join(artifactsDir, 'dom_toggle_state3_on.png') });

  await browser.close();
  console.log('\n[SUCCESS] DOM verification complete!');
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
