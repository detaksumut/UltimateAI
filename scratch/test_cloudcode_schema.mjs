import { AntigravityConnectionStore } from '../server/antigravity/AntigravityConnectionStore.mjs';

async function main() {
  const store = new AntigravityConnectionStore();
  const conn = store.getConnection('ag-01', false);
  const token = conn.accessToken;
  const baseUrl = 'https://cloudcode-pa.googleapis.com';

  console.log('[1] Probing schema with wrapped request object...');

  const body = {
    project: 'antigravity-ag-01-project',
    model: 'gemini-3.6-flash-high',
    request: {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Balas persis: LIVE-AG-01-TEST' }]
        }
      ]
    }
  };

  const res = await fetch(`${baseUrl}/v1internal:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}

main().catch(console.error);
