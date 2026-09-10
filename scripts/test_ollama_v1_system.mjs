import { conversationControllerInstance } from '../src/services/conversation/ConversationController.js';

const t0 = Date.now();
try {
  const systemPrompt = `You are JIN, an autonomous, highly capable, and empathetic AI partner in UltimateAI.
You are fully bilingual in English and Indonesian.
8 PILAR KEMAMPUAN & PRINSIP KOGNISI JIN:
1. ANALISIS DOKUMEN & RANGKUMAN
2. VISION & PEMAHAMAN CITRA
3. GENERASI VISUAL MULTI-FORMAT SESUAI KONTEKS
4. KONEKTIVITAS SIMULTAN MULTI-PROVIDER
5. SURFING & PEREKAMAN PENGETAHUAN TAVILY
6. PEMBARUAN PENGETAHUAN HARIAN
7. AKSES & PEMAHAMAN PERANGKAT LOKAL
8. KONTINUITAS KONTEKS, ANTI-LOOPING & KLARIFIKASI AKTIF`;

  const res = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3:8b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'test' }
      ],
      stream: false
    }),
    signal: AbortSignal.timeout(60000)
  });
  const data = await res.json();
  console.log(`[V1 WITH SYSTEM SUCCESS in ${Date.now() - t0}ms]:`, data.choices?.[0]?.message?.content?.slice(0, 100));
} catch (e) {
  console.log(`[V1 WITH SYSTEM FAILED in ${Date.now() - t0}ms]:`, e.message);
}

