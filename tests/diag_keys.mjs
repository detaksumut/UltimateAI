import dotenv from 'dotenv';
dotenv.config();

function collectGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY?.trim()) keys.push(process.env.GEMINI_API_KEY.trim());
  for (let i = 1; i <= 15; i++) {
    const key = process.env['GEMINI_API_KEY_' + i];
    if (key?.trim()) keys.push(key.trim());
  }
  return [...new Set(keys)];
}

const keys = collectGeminiKeys();
console.log('Found', keys.length, 'unique Gemini keys.');

const testImg = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview'];

for (let kIdx = 0; kIdx < keys.length; kIdx++) {
  const key = keys[kIdx];
  const masked = key.slice(0, 6) + '...' + key.slice(-4);
  console.log(`\n--- Key #${kIdx + 1} (${masked}) ---`);

  for (const model of models) {
    const t0 = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [
            { text: 'Say hello in 1 word' },
            { inline_data: { mime_type: 'image/png', data: testImg } }
          ] }]
        }),
        signal: AbortSignal.timeout(15000)
      });
      const ms = Date.now() - t0;
      if (res.ok) {
        console.log(`  [OK ${res.status}] ${model} -> ${ms}ms`);
      } else {
        const txt = await res.text();
        console.log(`  [FAIL ${res.status}] ${model} -> ${ms}ms : ${txt.slice(0, 120)}`);
      }
    } catch (e) {
      console.log(`  [ERR] ${model} -> ${Date.now() - t0}ms : ${e.message}`);
    }
  }
}
