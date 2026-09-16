import fs from 'fs';

const env = fs.readFileSync('d:/Users/ultimateai/.env', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY_1\s*=\s*([^\r\n#]+)/);
const key = keyMatch ? keyMatch[1].trim() : null;

async function testNanoBanana() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${key}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: 'Draw a presentation slide graphic' }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log(`nano-banana Status: ${res.status}`);
    const text = await res.text();
    console.log('Response:', text.slice(0, 300));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testNanoBanana();
