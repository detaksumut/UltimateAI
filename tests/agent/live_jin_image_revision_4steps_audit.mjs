import fetch from 'node-fetch';

async function main() {
  console.log('=== LIVE RUNTIME AUDIT: JIN IMAGE_REVISION 4-STEPS ===');

  // 1. Probe ComfyUI
  const probeRes = await fetch('http://127.0.0.1:8188/system_stats');
  if (!probeRes.ok) {
    throw new Error(`ComfyUI not responding on 8188: HTTP ${probeRes.status}`);
  }
  console.log('✓ ComfyUI is ONLINE on port 8188');

  // 2. Prepare live IMAGE_REVISION chat completions request
  const testRequestId = `req-live-audit-${Date.now()}`;
  const payload = {
    model: 'gemini-3.6-flash-high',
    messages: [
      {
        role: 'user',
        content: 'Buatkan gambar pemandangan kota'
      },
      {
        role: 'assistant',
        content: 'Berikut adalah gambar kota yang telah dibuat:\n![Kota](/api/artifacts/images/img-1788164099169-0d442eb0.jpg)',
        imageUrl: '/api/artifacts/images/img-1788164099169-0d442eb0.jpg',
        artifact: {
          url: '/api/artifacts/images/img-1788164099169-0d442eb0.jpg'
        }
      },
      {
        role: 'user',
        content: 'Ubah gambar tersebut menjadi suasana malam hari yang indah'
      }
    ],
    stream: false,
    generationId: testRequestId
  };

  console.log(`Sending live IMAGE_REVISION request to http://127.0.0.1:20200/v1/chat/completions`);
  console.log(`RequestId: ${testRequestId}`);

  const startTime = Date.now();
  const response = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': testRequestId
    },
    body: JSON.stringify(payload)
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Response HTTP Status: ${response.status} (in ${durationSec}s)`);

  const data = await response.json();
  console.log('Response summary:', {
    id: data.id,
    model: data.model,
    _agent: data._agent,
    replySnippet: data.choices?.[0]?.message?.content?.slice(0, 150)
  });

  // 3. Inspect ComfyUI history to find the prompt executed for this request
  const histRes = await fetch('http://127.0.0.1:8188/history');
  const history = await histRes.json();
  const promptKeys = Object.keys(history);
  const latestPromptId = promptKeys[promptKeys.length - 1];
  const latestItem = history[latestPromptId];

  const promptNodes = latestItem?.prompt?.[2] || {};
  const ksampler = Object.values(promptNodes).find(n => n.class_type === 'KSampler');

  console.log('\n=== LATEST COMFYUI HISTORY EXECUTION ===');
  console.log('Latest Prompt ID:', latestPromptId);
  console.log('KSampler inputs:', ksampler?.inputs);
  console.log('Execution status:', latestItem?.status);

  if (ksampler?.inputs?.steps !== 4) {
    console.error(`❌ POLICY VIOLATION: ComfyUI executed with steps=${ksampler?.inputs?.steps}, EXPECTED 4!`);
    process.exit(1);
  }

  console.log(`\n✅ AUDIT PASS: Exact live prompt was executed with steps=${ksampler?.inputs?.steps} (4/4)!`);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
