import dotenv from 'dotenv';
dotenv.config();

import handler from '../api/trading/visual-chart-analysis.js';

const testImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function createMockRes() {
  return {
    statusCode: null, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
}

console.log('=== LATENCY TEST (post-fix: no gemini-3.8-flash, 20s per-model timeout) ===\n');
const t0 = Date.now();
const req = { method: 'POST', body: { instrument: 'XAUUSD', timeframe: 'H4', image: testImg } };
const res = createMockRes();
await handler(req, res);
const ms = Date.now() - t0;
console.log(`Status: ${res.statusCode}  Time: ${ms}ms`);
console.log(`Model: ${res.body?.model}  Quality: ${res.body?.data?.data_quality}`);
console.log(`Within 60s budget: ${ms < 60000 ? 'YES ✓' : 'NO ✗'}`);
console.log(`Within 90s client timeout: ${ms < 90000 ? 'YES ✓' : 'NO ✗'}`);
