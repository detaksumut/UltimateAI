import fs from 'fs';

const env = fs.readFileSync('d:/Users/ultimateai/.env', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY_1\s*=\s*([^\r\n#]+)/);
const key = keyMatch ? keyMatch[1].trim() : null;

async function testGenerateContentImage(modelName) {
  console.log(`Testing generateContent with model ${modelName}...`);
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${key}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Generate an image of a clean, corporate 16:9 presentation slide infographic for UNISSA and ADAI academic partnership with icons of globe and handshake.' }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT']
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log(`Status (${modelName}):`, res.status);
    const data = await res.json();
    console.log(`Response structure:`, JSON.stringify(data, (k, v) => (typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '...' : v), 2));
  } catch (e) {
    console.error(`Error (${modelName}):`, e.message);
  }
}

async function run() {
  await testGenerateContentImage('models/gemini-2.5-flash-image');
  await testGenerateContentImage('models/gemini-3.1-flash-image');
}

run();
