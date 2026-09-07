const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting DOM Click Automated Diagnostics with Playwright...');
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();

    console.log('🌐 Navigating to http://localhost:5177/simulator ...');
    await page.goto('http://localhost:5177/simulator', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const buttons = [
      { id: '#btn-nav-memory_vault', label: 'MEMORY VAULT', expectedText: 'MEMORY VAULT HUD EXPLORER' },
      { id: '#btn-nav-activity_feed', label: 'ACTIVITY FEED', expectedText: 'EXECUTION TELEMETRY HUD' },
      { id: '#btn-nav-connections', label: 'CONNECTIONS', expectedText: 'Antigravity Pools' },
      { id: '#btn-nav-control_center', label: 'CONTROL CENTER', expectedText: 'CONTROL CENTER' }
    ];

    for (const item of buttons) {
      const t0 = Date.now();
      console.log(`👉 Testing Click on: [${item.label}] (${item.id})`);
      
      await page.waitForSelector(item.id, { state: 'visible' });
      await page.click(item.id);
      
      // Wait for modal text to appear
      await page.waitForFunction(
        (text) => document.body.innerText.includes(text),
        item.expectedText,
        { timeout: 4000 }
      );
      
      const latency = Date.now() - t0;
      console.log(`✅ [${item.label}] Modal opened successfully in ${latency}ms! Verified content: "${item.expectedText}".`);

      // Close modal by clicking X button
      await page.evaluate(() => {
        const closeButtons = Array.from(document.querySelectorAll('button'));
        const closeBtn = closeButtons.find(b => b.querySelector('svg.lucide-x') || b.innerText.includes('×'));
        if (closeBtn) closeBtn.click();
      });

      await page.waitForTimeout(300);
    }

    console.log('\n🎉 ALL DOM CLICK TESTS PASSED WITH 100% SUCCESS!');
    await browser.close();
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
})();
