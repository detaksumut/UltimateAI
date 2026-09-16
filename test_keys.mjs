import fs from 'fs';

const env = fs.readFileSync('d:/Users/ultimateai/.env', 'utf8');
const allKeys = [];
for (let i = 1; i <= 10; i++) {
  const m = env.match(new RegExp(`GEMINI_API_KEY_${i}\\s*=\\s*([^\\r\\n#]+)`));
  if (m) allKeys.push({ idx: i, key: m[1].trim() });
}

async function testAll() {
  for (const item of allKeys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${item.key}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: 'A presentation slide icon' }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      console.log(`Key #${item.idx}: Status ${res.status}`);
      if (res.status === 200) {
        console.log(`>>> Key #${item.idx} SUCCESS! <<<`);
        const data = await res.json();
        console.log('Candidates:', data.candidates?.length);
        break;
      }
    } catch (e) {
      console.log(`Key #${item.idx}: Error ${e.message}`);
    }
  }
}

testAll();
