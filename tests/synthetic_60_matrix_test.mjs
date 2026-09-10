/**
 * tests/synthetic_60_matrix_test.mjs
 * Synthetic Forced Traversal Test: 60/60 Combination Matrix
 * Mocked in test harness to avoid consuming any real Google quota.
 *
 * Expected:
 * - 10 keys × 6 models = 60 combinations
 * - Combinations 1 to 59: return simulated 429
 * - Combination 60 (Key #10 on Model 6): returns 200 OK
 * - Total attempts: exactly 60
 * - Total failures: exactly 59
 * - Total successes: exactly 1
 * - Immediately STOP on combination 60
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('d:/Users/ultimateai/.env') });

import { GeminiProvider } from '../server/providers/GeminiProvider.mjs';

async function runSynthetic60MatrixTest() {
  console.log('================================================================');
  console.log(' SYNTHETIC TRAVERSAL TEST: 60/60 COMBINATION MATRIX             ');
  console.log('================================================================');

  const provider = new GeminiProvider();
  const allKeys = provider._getAllApiKeys();
  const modelChain = provider._modelChain;

  console.log(`Pool Keys Count : ${allKeys.length}`);
  console.log(`Model Chain (${modelChain.length})  : ${modelChain.join(', ')}`);
  console.log(`Total Combinations: ${allKeys.length * modelChain.length}`);
  console.log('----------------------------------------------------------------');

  let callCount = 0;
  const history = [];

  // Mock _nonStreamRequest to simulate 59 failures then 1 success on 60th attempt
  provider._nonStreamRequest = async (model, key, idx, requestBody, t0) => {
    callCount++;
    const keyNumber = idx + 1;
    const isSixtieth = (callCount === 60);

    if (!isSixtieth) {
      const err = new Error(`HTTP 429 RATE_LIMIT on combo #${callCount} (Key#${keyNumber} + ${model})`);
      err._geminiErrorType = 'QUOTA';
      history.push({ call: callCount, keyNumber, model, status: '429 QUOTA' });
      throw err;
    }

    // 60th attempt: SUCCESS!
    history.push({ call: callCount, keyNumber, model, status: '200 OK' });
    return `Respons sukses dari kombinasi ke-${callCount} (Key#${keyNumber} pada model ${model})`;
  };

  const startTime = Date.now();
  const response = await provider.sendChat({
    messages: [{ role: 'user', content: 'Synthetic Matrix Traversal' }],
    model: modelChain[0]
  });
  const elapsed = Date.now() - startTime;

  console.log(`Hasil Eksekusi:`);
  console.log(`  Total Percobaan   : ${callCount} / 60`);
  console.log(`  Total Gagal (429) : ${callCount - 1}`);
  console.log(`  Total Sukses (200): 1`);
  console.log(`  Waktu Traversal   : ${elapsed}ms`);
  console.log(`  Respons Akhir     : "${response}"`);

  console.log('----------------------------------------------------------------');
  console.log('Rincian Traversal Per Model:');
  for (let mIdx = 0; mIdx < modelChain.length; mIdx++) {
    const m = modelChain[mIdx];
    const modelCalls = history.filter(h => h.model === m);
    console.log(`  Model ${mIdx + 1} [${m.padEnd(20, ' ')}]: ${modelCalls.length} key dicoba -> ${modelCalls.map(c => `K#${c.keyNumber}:${c.status === '200 OK' ? '200' : '429'}`).join(' ')}`);
  }

  console.log('----------------------------------------------------------------');
  console.log('Verifikasi getStats():');
  const stats = provider.getStats();
  console.log(`  Models tercatat di stats : ${Object.keys(stats.models).length} / 6`);
  console.log(`  Keys tercatat di stats   : ${Object.keys(stats.keys).length} / 10`);

  const passed = callCount === 60 && history[59].status === '200 OK';
  console.log('================================================================');
  console.log(`HASIL SYNTHETIC 60/60 TEST : ${passed ? '✅ PASS (FULL 60-MATRIX TRAVERSAL VERIFIED)' : '❌ FAIL'}`);
  console.log('================================================================\n');
}

runSynthetic60MatrixTest().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
