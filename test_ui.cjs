const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:5177/simulator');
  await page.waitForTimeout(2000);
  await page.getByText('Create Platform OJS/PKP').click();
  await page.waitForTimeout(2000);
  await page.locator('input[placeholder="Ketik pesan Anda..."]').fill('buat');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  const frame = page.frameLocator('iframe');
  console.log('Clicking button...');
  await frame.locator('#btnGenerate').click();
  console.log('Button clicked! Waiting 5 seconds...');
  await page.waitForTimeout(5000);
  const activeScreen = await frame.evaluate(() => {
    return document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : 'NONE';
  });
  console.log('Active Screen:', activeScreen);
  await browser.close();
})();
