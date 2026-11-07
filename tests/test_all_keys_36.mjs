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
const testImg = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Test each key specifically with gemini-3.6-flash and log status & error
for (let i = 0; i < keys.length; i++) {
  const k = keys[i];
  const masked = k.slice(0, 6) + '...' + k.slice(-4);
  const t0 = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${k}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: 'Ping' },
          { inline_data: { mime_type: 'image/png', data: testImg } }
        ] }]
      }),
      signal: AbortSignal.timeout(10000)
    });
    console.log(`Key #${i+1} (${masked}): Status ${res.status} in ${Date.now() - t0}ms`);
    if (!res.ok) {
      const txt = await res.text();
      console.log(`   Error: ${txt.slice(0, 150)}`);
    }
  } catch (e) {
    console.log(`Key #${i+1} (${masked}): FAILED in ${Date.now() - t0}ms - ${e.message}`);
  }
}
