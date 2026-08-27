const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5177/simulator');
  await page.waitForTimeout(1000);
  
  // Click Generate
  await page.click('button:has-text("Generate Journal Instance")');
  await page.waitForTimeout(3000); // Wait for processing

  // Get the iframe
  const iframeElement = await page.$('iframe');
  const frame = await iframeElement.contentFrame();

  // Show the app screen directly in the frame
  await frame.evaluate(() => {
    // We are inside the frame now!
    if(typeof showScreen === 'function') {
      showScreen('screen-app');
    } else {
      document.getElementById('screen-app').classList.add('active');
      document.getElementById('screen-building').classList.remove('active');
    }
  });
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'layout_test.png', fullPage: true });
  await browser.close();
})();
