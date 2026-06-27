const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log("Navigating to http://localhost:5177...");
  try {
    await page.goto('http://localhost:5177', { waitUntil: 'networkidle', timeout: 10000 });
    console.log("Page loaded. Taking screenshot...");
    await page.screenshot({ path: 'debug-screenshot.png' });
  } catch (err) {
    console.log("Navigation error:", err.message);
  }
  
  await browser.close();
})();
