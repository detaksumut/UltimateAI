/**
 * tests/cooldown_and_streaming_test.mjs
 * Reliability Verification Part 2:
 * 1. Cooldown Recovery Verification
 * 2. Streaming Failover (Gemini -> Groq -> Hermes)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('d:/Users/ultimateai/.env') });

import { GeminiProvider } from '../server/providers/GeminiProvider.mjs';
import { ModelRoutingService } from '../server/local_router/ModelRoutingService.mjs';

async function testCooldownRecovery() {
  console.log('====================================================');
  console.log(' TEST A: COOLDOWN EXPIRATION & RECOVERY             ');
  console.log('====================================================');

  const provider = new GeminiProvider();
  const allKeys = provider._getAllApiKeys();

  // Beri key#1 cooldown 1 detik (1000ms) untuk pengujian pemulihan
  console.log('1. Memberi key#1 cooldown singkat (1000ms)...');
  provider._markKeyCooldown(0, 1000, 'TEST_SHORT_CD');
  
  let statsBefore = provider.getStats();
  console.log(`   Status cooldown key#1 aktif: ${statsBefore.activeCooldowns.keys.length > 0 ? 'YA (CD aktif)' : 'TIDAK'}`);

  // _resolveApiKey harus memprioritaskan key yang TIDAK sedang cooldown (misal key#2)
  const resolvedWhileCD = provider._resolveApiKey(allKeys);
  console.log(`2. Key terpilih saat key#1 cooldown: Key #${resolvedWhileCD.idx + 1}`);

  // Tunggu 1100ms agar cooldown expired
  console.log('3. Menunggu 1100ms hingga cooldown kedaluwarsa...');
  await new Promise(r => setTimeout(r, 1100));

  let statsAfter = provider.getStats();
  console.log(`4. Status cooldown key#1 setelah 1.1s: ${statsAfter.activeCooldowns.keys.length === 0 ? 'BERSIH / PULIH (RECOVERED)' : 'MASIH AKTIF'}`);
  console.log('   Hasil Test A: ' + (statsAfter.activeCooldowns.keys.length === 0 ? '✅ PASS' : '❌ FAIL'));
}

async function testStreamingFailover() {
  console.log('\n====================================================');
  console.log(' TEST B: STREAMING FAILOVER CHAIN (GEMINI -> GROQ) ');
  console.log('====================================================');

  const router = new ModelRoutingService();
  
  // Chunk collector
  const chunksReceived = [];
  const onChunk = (chunk) => {
    chunksReceived.push(chunk);
  };

  console.log('1. Mengirim permintaan streaming dengan model: gemini-3.6-flash');
  console.log('   (Menguji apakah streaming berhasil menerima token secara inkremental)');

  const res = await router.routeChat({
    messages: [{ role: 'user', content: 'Sebutkan 3 warna dasar dalam 3 kata' }],
    model: 'gemini-3.6-flash',
    stream: true
  }, onChunk);

  console.log(`2. Gateway penyedia : ${res.providerGateway}`);
  console.log(`3. Model aktual     : ${res.actualModel}`);
  console.log(`4. Jumlah chunks    : ${chunksReceived.length} chunks diterima secara realtime`);
  console.log(`5. Konten utuh      : "${res.content.trim()}"`);
  console.log('   Hasil Test B: ' + (chunksReceived.length > 0 ? '✅ PASS (Streaming Live Berfungsi)' : '❌ FAIL'));
  console.log('====================================================\n');
}

async function run() {
  await testCooldownRecovery();
  await testStreamingFailover();
}

run().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
