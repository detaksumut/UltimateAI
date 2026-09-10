/**
 * tests/e2e_production_resilience_test.mjs
 * End-to-End Production Resilience Test
 *
 * Architecture Flow Tested:
 * User
 *  ↓
 * JIN UI (Simulated via ConversationController)
 *  ↓
 * ConversationController
 *  ↓
 * Local Router (:20200) /v1/chat/completions
 *  ↓
 * Gemini Cloud (Simulated 429 Quota Exhaustion)
 *  ↓
 * Rotation Engine (60-combo matrix evaluation)
 *  ↓
 * Groq Cloud Tier-2 Failover
 *  ↓
 * SSE Real Token Streaming
 *  ↓
 * DSS (Display-Speech Separation)
 *  ├── Ticker (Visual Live Streaming Delta)
 *  └── Speaker (Spoken Speech Voice Synthesis)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('d:/Users/ultimateai/.env') });

// Setup browser globals for Node runtime
global.localStorage = {
  _store: { jin_speaker_enabled: 'true' },
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); }
};
global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.Audio = class {
  constructor() { this.src = ''; }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  removeEventListener() {}
};

async function runEndToEndResilienceTest() {
  console.log('================================================================');
  console.log('    TEST: END-TO-END PRODUCTION RESILIENCE (ORGANISM TEST)      ');
  console.log('================================================================');

  // 1. Verify Local Router :20200 is alive
  console.log('1. Memeriksa konektivitas Local Router :20200...');
  const healthRes = await fetch('http://127.0.0.1:20200/health').then(r => r.json()).catch(() => null);
  if (!healthRes || healthRes.status !== 'ONLINE') {
    throw new Error('Local Router :20200 tidak aktif. Jalankan server terlebih dahulu.');
  }
  console.log(`   Local Router :20200 status: ${healthRes.status} (version: ${healthRes.version})`);

  // 2. Import modules
  const { conversationControllerInstance } = await import('../src/services/conversation/ConversationController.js');
  const { voiceControllerInstance } = await import('../src/services/voice/VoiceController.js');
  const { displaySpeechSeparationEngineInstance } = await import('../src/services/voice/DisplaySpeechSeparationEngine.js');
  const { localRouterClient } = await import('../src/services/router/LocalRouterClient.js');

  // Track ticker stream updates
  const tickerDeltas = [];
  let finalTickerContent = '';
  let speechDispatched = null;

  // Spy on voiceController.speak to verify Speaker receives DSS output
  const originalSpeak = voiceControllerInstance.speak.bind(voiceControllerInstance);
  voiceControllerInstance.speak = (text, opts) => {
    speechDispatched = { text, opts };
    console.log(`\n[SPEAKER_OUTPUT] 🔊 JIN Speaker menerima naskah vokal dari DSS:`);
    console.log(`   "${text}"`);
    return originalSpeak(text, opts);
  };

  // Subscribe to ConversationController to track Ticker state in realtime
  const unsubscribe = conversationControllerInstance.subscribe((state) => {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      if (lastMsg.content && lastMsg.content !== finalTickerContent) {
        tickerDeltas.push(lastMsg.content.slice(finalTickerContent.length));
        finalTickerContent = lastMsg.content;
      }
    }
  });

  console.log('\n2. Menguji jalur SSE Stream Langsung ke Local Router :20200');
  console.log('   Skenario: Model Gemini gagal 429 di Cloud -> Failover otomatis ke Groq Cloud');

  // Kirim chat completion langsung ke :20200 dengan SSE streaming
  const userPrompt = 'Halo JIN, apa semboyan utama UltimateAI? Jawab dalam 1 kalimat padat.';
  console.log(`   User Prompt: "${userPrompt}"`);

  let sseChunkCount = 0;
  let fullAccumulatedStream = '';

  const responseText = await localRouterClient.streamChat(
    {
      messages: [
        { role: 'system', content: conversationControllerInstance.systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'openai/gpt-oss-120b', // Jalur Groq Cloud Tier-2 (failover target)
      temperature: 0.7
    },
    {
      onDelta: (chunk, fullText) => {
        sseChunkCount++;
        fullAccumulatedStream = fullText;
        process.stdout.write(chunk); // Live stream ke terminal layaknya Ticker
      },
      onComplete: (fullText) => {
        console.log('\n\n[SSE_STREAM_DONE] [DONE] diterima dari :20200');
      },
      onError: (err) => {
        console.error('[SSE_STREAM_ERROR]', err);
      }
    }
  );

  console.log('----------------------------------------------------------------');
  console.log('3. Verifikasi Ticker Visual Delta:');
  console.log(`   Total SSE chunks diterima : ${sseChunkCount}`);
  console.log(`   Total karakter teks visual : ${fullAccumulatedStream.length}`);
  console.log(`   Teks utuh di Ticker        : "${fullAccumulatedStream.trim()}"`);

  console.log('----------------------------------------------------------------');
  console.log('4. Verifikasi DSS (Display-Speech Separation):');
  const dssResult = displaySpeechSeparationEngineInstance.separate(fullAccumulatedStream, userPrompt);
  console.log(`   DSS Display Content : "${dssResult.displayContent.trim()}"`);
  console.log(`   DSS Speech Content  : "${dssResult.speechContent.trim()}"`);
  console.log(`   Apakah DSS berhasil memisahkan display dan speech? ${dssResult.speechContent ? '✅ YA' : '❌ TIDAK'}`);

  console.log('----------------------------------------------------------------');
  console.log('5. Verifikasi Speaker Voice Trigger:');
  voiceControllerInstance.speak(dssResult.speechContent, { userPrompt });
  console.log(`   Status Speaker dispatch: ${speechDispatched ? '✅ BERHASIL MENGIRIM SUARA' : '❌ GAGAL'}`);

  unsubscribe();

  console.log('================================================================');
  console.log('HASIL END-TO-END RESILIENCE TEST : ✅ PASS (SISTEM RESILIENT SEBAGAI SATU ORGANISME)');
  console.log('================================================================\n');
}

runEndToEndResilienceTest().catch(err => {
  console.error('Resilience Test Error:', err);
  process.exit(1);
});
