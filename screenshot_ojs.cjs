const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('http://localhost:5177/simulator');
  await page.waitForTimeout(1000);
  
  // We don't even need to use the ChatSimulator UI to get the HTML.
  // The backend server is at http://localhost:3001
  // Let's just fetch the HTML directly from the backend API if we can, or just mock the frontend!
  // Actually, we can just change the mode in the ChatSimulator by clicking the Settings/Mode dropdown!
  
  // Let's just send the exact message that triggers OJS Generation!
  await page.fill('input[type="text"]', 'buatkan aplikasi OJS');
  
  // We also need to switch the activeMode to 'OjsPkp'. 
  // There's a dropdown or select for this. Let's find it.
  const selects = await page.$$('select');
  if(selects.length > 0) {
    // try to select OjsPkp in the first select
    try {
      await page.selectOption('select', 'OjsPkp');
    } catch(e) {}
  }

  await page.click('button:has(svg.lucide-send)'); // click the send button
  await page.waitForTimeout(4000); // Wait for the AI streaming to finish

  // Now the iframe is populated with the OJS setup screen!
  const iframeElement = await page.$('iframe');
  const frame = await iframeElement.contentFrame();

  // Show the app screen directly in the frame
  await frame.evaluate(() => {
    if(typeof showScreen === 'function') {
      showScreen('screen-app');
    } else {
      document.getElementById('screen-app').classList.add('active');
      document.getElementById('screen-setup').classList.remove('active');
    }
    if(typeof switchPreviewPage === 'function') {
      switchPreviewPage('public');
    }
  });
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'sinta_desktop_test.png', fullPage: true });
  await browser.close();
  console.log("Screenshot saved as sinta_desktop_test.png");
})();
