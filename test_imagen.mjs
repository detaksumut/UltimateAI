import fs from 'fs';

const env = fs.readFileSync('d:/Users/ultimateai/.env', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY_1\s*=\s*([^\r\n#]+)/);
const key = keyMatch ? keyMatch[1].trim() : null;

async function checkModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  const imageModels = (data.models || []).filter(m => m.name.includes('imagen') || m.name.includes('image') || m.supportedGenerationMethods?.includes('generateImages') || m.supportedGenerationMethods?.includes('predict'));
  console.log('Image-related models:', imageModels.map(m => ({ name: m.name, methods: m.supportedGenerationMethods })));

  // Test Imagen 3 predict
  console.log('\nTesting imagen-3.0-generate-002:predict...');
  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
  const testBody = {
    instances: [{ prompt: 'A modern presentation slide infographic about academic partnership, 16:9 widescreen' }],
    parameters: { sampleCount: 1, aspectRatio: '16:9', outputOptions: { mimeType: 'image/jpeg' } }
  };

  const imgRes = await fetch(testUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testBody)
  });

  console.log('Imagen 3 status:', imgRes.status);
  const imgText = await imgRes.text();
  console.log('Imagen 3 response snippet:', imgText.slice(0, 300));
}

checkModels();
