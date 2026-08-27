const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 }
  });
  
  // Load the extracted HTML file
  const fileUrl = 'file://' + path.resolve('test_layout.html');
  await page.goto(fileUrl);
  
  // Since it's just the HTML, we need to show the subpage-public because it might be hidden by default
  // Actually, wait, the layout has `id="screen-app"` and it's active when the app shows, but since it's just HTML, let's make sure it's visible.
  await page.evaluate(() => {
    document.getElementById('screen-app').classList.add('active');
    document.getElementById('subpage-public').style.display = 'block';
  });
  
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test_layout.png', fullPage: true });
  await browser.close();
})();
