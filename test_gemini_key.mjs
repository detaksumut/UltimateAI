import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('d:/Users/ultimateai/.env', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY_1\s*=\s*([^\r\n#]+)/);
const key = keyMatch ? keyMatch[1].trim() : null;
console.log('Testing Key:', key ? key.slice(0, 15) + '...' : 'NONE');

async function testKey() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  try {
    const res = await fetch(url);
    console.log('Status with ?key=:', res.status);
    const text = await res.text();
    console.log('Body:', text.slice(0, 200));
  } catch (e) {
    console.error('Fetch error:', e.message);
  }

  // Also test with Authorization: Bearer
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    console.log('Status with Bearer:', res.status);
    const text = await res.text();
    console.log('Body with Bearer:', text.slice(0, 200));
  } catch (e) {
    console.error('Bearer fetch error:', e.message);
  }
}

testKey();
