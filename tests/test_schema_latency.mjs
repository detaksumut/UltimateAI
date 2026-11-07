import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;
const testImg = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const prompt = 'Extract chart data. Return JSON.';
const schema = {
  type: 'OBJECT',
  properties: {
    instrument: { type: 'STRING' }, timeframe: { type: 'STRING' },
    symbol_match: { type: 'BOOLEAN' }, timeframe_match: { type: 'BOOLEAN' },
    visible_candles: { type: 'INTEGER' }, ohlc_readable: { type: 'BOOLEAN' },
    last_price: { type: 'NUMBER', nullable: true }, open: { type: 'NUMBER', nullable: true },
    high: { type: 'NUMBER', nullable: true }, low: { type: 'NUMBER', nullable: true },
    close: { type: 'NUMBER', nullable: true }, trend: { type: 'STRING' },
    momentum: { type: 'STRING' }, support: { type: 'NUMBER', nullable: true },
    resistance: { type: 'NUMBER', nullable: true }, volatility: { type: 'STRING' },
    scenario: { type: 'STRING' }, confidence: { type: 'NUMBER' },
    data_quality: { type: 'STRING' }, note: { type: 'STRING' }
  },
  required: ['instrument','timeframe','symbol_match','timeframe_match','visible_candles','ohlc_readable','last_price','open','high','low','close','trend','momentum','support','resistance','volatility','scenario','confidence','data_quality','note']
};

for (const model of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash']) {
  const t0 = Date.now();
  console.log(`Testing ${model} with schema + image ...`);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/png', data: testImg } }
        ] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      }),
      signal: AbortSignal.timeout(30000)
    });
    console.log(`[${model}] Status:`, res.status, `Time: ${Date.now() - t0}ms`);
    const txt = await res.text();
    console.log(`[${model}] Response snippet:`, txt.slice(0, 200));
  } catch (e) {
    console.error(`[${model}] ERROR after ${Date.now() - t0}ms:`, e.message);
  }
}
