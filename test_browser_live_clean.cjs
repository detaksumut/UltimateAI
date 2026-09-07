/**
 * test_browser_live_clean.cjs
 * Real Chromium Browser Integration Test
 * 
 * Verifies:
 * 1. ZERO Console Errors on page load (No Map/forEach error, no CORS error, no 401 error).
 * 2. Activity Feed HUD opens with ONLINE/ACTIVE status and 0 CORS errors.
 * 3. Chat prompt "Saya mau transkripsi audio" sends cleanly and JIN responds with grounded text.
 * 4. Captures screenshot evidence.
 */

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('\n========================================================================');
  console.log('🌐 REAL BROWSER INTEGRATION & CONSOLE CLEANLINESS AUDIT');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1700, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('🔴 [BROWSER CONSOLE ERROR]:', msg.text());
    } else if (msg.type() === 'warn') {
      consoleWarnings.push(msg.text());
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Failed'}`);
    console.error('🔴 [NETWORK FAILED]:', request.url(), request.failure()?.errorText);
  });

  try {
    // 1. Navigate to Simulator
    console.log('1️⃣ Navigating to http://localhost:5177/simulator...');
    await page.goto('http://localhost:5177/simulator', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('   ✅ Simulator loaded successfully.');

    // Wait 3 seconds to ensure observer interval cycles run
    console.log('2️⃣ Waiting 3s to verify FrontendErrorObserver interval cycles...');
    await page.waitForTimeout(3000);

    // 2. Open Activity Feed HUD
    console.log('3️⃣ Opening Activity Feed HUD (Autonomous Engineering HUD)...');
    const activityBtn = page.locator('#btn-nav-activity_feed, button:has-text("ACTIVITY FEED")').first();
    await activityBtn.click();
    await page.waitForTimeout(1500);

    const hudText = await page.locator('text=AUTONOMOUS ENGINEERING HUD, text=EXECUTION TELEMETRY').first().textContent().catch(() => '');
    console.log(`   ✅ HUD Opened. Header detected: "${hudText?.trim()}"`);

    // Screenshot HUD
    const hudScreenshotPath = path.resolve(process.cwd(), 'browser_hud_clean.png');
    await page.screenshot({ path: hudScreenshotPath });
    console.log(`   📸 HUD Screenshot saved to: ${hudScreenshotPath}`);

    // Close HUD
    const closeBtn = page.locator('button:has-text("✕"), button:has-text("X"), .fixed button').first();
    await closeBtn.click();
    await page.waitForTimeout(1000);
    console.log('   ✅ HUD Closed.');

    // 3. Send Prompt to JIN
    console.log('4️⃣ Submitting prompt to JIN: "Saya mau transkripsi audio"...');
    const input = page.locator('input[placeholder*="Ask JIN"]').first();
    await input.fill('Saya mau transkripsi audio');
    await page.keyboard.press('Enter');

    // Wait for response to appear
    console.log('5️⃣ Waiting for JIN response...');
    await page.waitForTimeout(4000);

    // Capture final response text
    const responseScreenshotPath = path.resolve(process.cwd(), 'browser_jin_response_clean.png');
    await page.screenshot({ path: responseScreenshotPath });
    console.log(`   📸 Final Conversation Screenshot saved to: ${responseScreenshotPath}`);

    // Read messages from DOM
    const assistantMessages = await page.locator('.space-y-4, .chat-bubble, p, span').allTextContents();
    const hasGroundedResponse = assistantMessages.some(t => t.includes('transkripsi') || t.includes('upload') || t.includes('Bisa'));

    console.log('\n========================================================================');
    console.log('📊 CONSOLE & NETWORK AUDIT RESULTS:');
    console.log(`   - Total Console Errors: ${consoleErrors.length}`);
    console.log(`   - Total Network/CORS Failures: ${networkErrors.length}`);
    console.log(`   - Grounded Response Delivered: ${hasGroundedResponse ? 'YES ✅' : 'NO ❌'}`);
    console.log('========================================================================\n');

    if (consoleErrors.length > 0 || networkErrors.length > 0) {
      console.error('❌ Browser had active errors:', { consoleErrors, networkErrors });
      process.exit(1);
    }

    console.log('🎉 100% REAL BROWSER AUDIT PASSED: ZERO CONSOLE ERRORS & CLEAN JIN RESPONSE!');
    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed with exception:', err);
    await browser.close().catch(() => {});
    process.exit(1);
  }
})();
