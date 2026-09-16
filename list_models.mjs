import fs from 'fs';

const env = fs.readFileSync('d:/Users/ultimateai/.env', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY_1\s*=\s*([^\r\n#]+)/);
const key = keyMatch ? keyMatch[1].trim() : null;

async function listAllModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  for (const m of (data.models || [])) {
    console.log(m.name, '-->', m.supportedGenerationMethods);
  }
}

listAllModels();
