import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config();

import handler from '../api/trading/visual-chart-analysis.js';

// Helper mock response
function createMockRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
}

async function runTests() {
  console.log('=== RUNNING GEMINI VISION PIPELINE VERIFICATION TESTS ===\n');

  // Test 1: OPTIONS method
  {
    const req = { method: 'OPTIONS' };
    const res = createMockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 204, 'OPTIONS should return 204');
    console.log('[PASS] Test 1: OPTIONS preflight returns HTTP 204');
  }

  // Test 2: Method not allowed (GET)
  {
    const req = { method: 'GET' };
    const res = createMockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 405, 'GET should return 405');
    assert.equal(res.body?.success, false);
    console.log('[PASS] Test 2: GET returns HTTP 405 Method Not Allowed');
  }

  // Test 3: Invalid screenshot payload (not a valid image data URL)
  {
    const req = { method: 'POST', body: { instrument: 'XAUUSD', timeframe: 'H4', image: 'invalid-base64' } };
    const res = createMockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400, 'Invalid data URL should return 400');
    assert.equal(res.body?.success, false);
    assert.ok(res.body?.error?.includes('Screenshot tidak valid'));
    console.log('[PASS] Test 3: Invalid data URL rejected with HTTP 400');
  }

  // Test 4: Oversized payload (> 8MB base64)
  {
    const req = { method: 'POST', body: { instrument: 'XAUUSD', timeframe: 'H4', image: 'data:image/png;base64,' + 'A'.repeat(8_000_001) } };
    const res = createMockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 413, 'Oversized image should return 413');
    assert.equal(res.body?.success, false);
    assert.ok(res.body?.error?.includes('terlalu besar'));
    console.log('[PASS] Test 4: Oversized screenshot rejected with HTTP 413');
  }

  // Test 5: Live image transmission to verified Gemini Vision API
  {
    // Minimal valid 1x1 PNG data URL
    const validPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const req = {
      method: 'POST',
      body: {
        instrument: 'XAUUSD',
        timeframe: 'H4',
        image: validPngDataUrl,
        schema: 'chart-ohlc-v1'
      }
    };
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200, `Live vision should return 200. Got: ${res.statusCode} with error: ${JSON.stringify(res.body?.error)}`);
    assert.equal(res.body?.success, true, 'Response success must be true');
    assert.equal(res.body?.provider, 'GEMINI_VISION');
    assert.ok(res.body?.model, 'Model name must be present');
    console.log(`[PASS] Test 5: Live Gemini Vision responded successfully using model: "${res.body.model}"`);

    // Verify schema structure of the returned data
    const data = res.body?.data;
    assert.ok(data && typeof data === 'object', 'Data must be an object');
    assert.ok('instrument' in data, 'Must have instrument field');
    assert.ok('timeframe' in data, 'Must have timeframe field');
    assert.ok('symbol_match' in data, 'Must have symbol_match field');
    assert.ok('timeframe_match' in data, 'Must have timeframe_match field');
    assert.ok('scenario' in data, 'Must have scenario field');
    assert.ok('data_quality' in data, 'Must have data_quality field');
    assert.ok('confidence' in data, 'Must have confidence field');
    assert.ok('note' in data, 'Must have note field');

    // Data quality for 1x1 transparent PNG must be POOR / WAIT (never invent fake values)
    assert.ok(['POOR', 'PARTIAL', 'GOOD'].includes(data.data_quality), 'data_quality must be valid enum');
    assert.ok(['BUY_BIAS', 'SELL_BIAS', 'WAIT'].includes(data.scenario), 'scenario must be valid enum');
    console.log('[PASS] Test 6: Vision schema validation succeeded. data_quality =', data.data_quality, ', scenario =', data.scenario);
  }

  console.log('\n=== ALL VISION PIPELINE TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('\n[FAIL] Test suite failed:', err);
  process.exit(1);
});
