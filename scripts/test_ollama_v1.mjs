const t0 = Date.now();
try {
  const res = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3:8b',
      messages: [{ role: 'user', content: 'test' }],
      stream: false
    }),
    signal: AbortSignal.timeout(60000)
  });
  const data = await res.json();
  console.log(`[V1 SUCCESS in ${Date.now() - t0}ms]:`, data.choices?.[0]?.message?.content);
} catch (e) {
  console.log(`[V1 FAILED in ${Date.now() - t0}ms]:`, e.message);
}

