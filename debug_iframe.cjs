const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to simulator
  await page.goto('http://localhost:5177/simulator');
  await page.waitForTimeout(2000);
  
  // Fill input
  await page.fill('input[type="text"]', 'buatkan aplikasi OJS');
  
  // Click send button
  await page.click('button:has(svg.lucide-send)');
  
  // Wait for 6 seconds for streaming to complete
  await page.waitForTimeout(6000);
  
  // Extract iframe content
  const iframeElement = await page.$('iframe');
  if (iframeElement) {
    const frame = await iframeElement.contentFrame();
    
    // Evaluate inside frame
    const layoutOuterHTML = await frame.evaluate(() => {
      // Force switch to app screen just in case
      if (document.getElementById('screen-app')) {
        document.getElementById('screen-app').classList.add('active');
        document.getElementById('screen-setup').classList.remove('active');
        document.getElementById('screen-building').classList.remove('active');
      }
      
      const el = document.querySelector('.desktop-layout');
      return el ? el.outerHTML : "NO .desktop-layout FOUND!";
    });
    
    fs.writeFileSync('layout_debug.html', layoutOuterHTML);
    console.log("Saved iframe layout HTML to layout_debug.html");
  } else {
    console.log("NO IFRAME FOUND!");
  }
  
  await browser.close();
})();
