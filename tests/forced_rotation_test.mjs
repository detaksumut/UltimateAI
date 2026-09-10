/**
 * tests/forced_rotation_test.mjs
 * Reliability Verification: Forced Rotation Test (10 Key × 6 Model Engine)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('d:/Users/ultimateai/.env') });

import { GeminiProvider } from '../server/providers/GeminiProvider.mjs';

async function runForcedRotationTest() {
  const provider = new GeminiProvider();
  const allKeys = provider._getAllApiKeys();

  console.log('====================================================');
  console.log('   FORCED ROTATION TEST (10 KEY × 6 MODEL ENGINE)   ');
  console.log('====================================================');
  console.log(`Pool keys loaded : ${allKeys.length}`);
  console.log(`Model chain      : ${JSON.stringify(provider._modelChain)}`);
  console.log('Target Scenario  : Fail M1 with all 10 keys (429),');
  console.log('                   then on M2 fail Key#1 & Key#2 (429),');
  console.log('                   then SUCCESS on Key#3 (200 OK).');
  console.log('----------------------------------------------------');

  let callCount = 0;
  const history = [];

  // Intercept _nonStreamRequest to inject controlled 429 vs 200 OK
  provider._nonStreamRequest = async (model, key, idx, requestBody, t0) => {
    callCount++;
    const keyNumber = idx + 1;
    const callRecord = { call: callCount, keyNumber, model };

    // Skenario: M1 (gemini-3.6-flash) -> semua 10 key kena 429
    if (model === 'gemini-3.6-flash') {
      const err = new Error('HTTP 429 RESOURCE_EXHAUSTED (Quota exceeded for test)');
      err._geminiErrorType = 'QUOTA';
      callRecord.result = '429 QUOTA';
      history.push(callRecord);
      throw err;
    }

    // Skenario: M2 (gemini-3.8-flash) -> Key#1 & Key#2 kena 429
    if (model === 'gemini-3.8-flash' && (keyNumber === 1 || keyNumber === 2)) {
      const err = new Error('HTTP 429 RESOURCE_EXHAUSTED (Quota exceeded for test)');
      err._geminiErrorType = 'QUOTA';
      callRecord.result = '429 QUOTA';
      history.push(callRecord);
      throw err;
    }

    // Sukses di Key#3 pada M2 (gemini-3.8-flash)
    callRecord.result = '200 OK (SUCCESS)';
    history.push(callRecord);
    return `Halo! Respons sukses dari Key#${keyNumber} pada model ${model}`;
  };

  const startTime = Date.now();
  const result = await provider.sendChat({
    messages: [{ role: 'user', content: 'Tes Forced Rotation' }],
    model: 'gemini-3.6-flash'
  });
  const elapsed = Date.now() - startTime;

  console.log('\n----------------------------------------------------');
  console.log('HASIL EKSEKUSI STEP-BY-STEP:');
  history.forEach(h => {
    console.log(
      `  Step #${String(h.call).padStart(2, ' ')}: Key #${String(h.keyNumber).padStart(2, ' ')} | Model: ${h.model.padEnd(18, ' ')} -> ${h.result}`
    );
  });

  console.log('\n----------------------------------------------------');
  console.log('HASIL RESPON AKHIR:');
  console.log(`  Respon : "${result}"`);
  console.log(`  Total panggilan API : ${callCount}`);
  console.log(`  Waktu eksekusi      : ${elapsed}ms`);

  console.log('\n----------------------------------------------------');
  console.log('INSPEKSI getStats():');
  const stats = provider.getStats();
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n----------------------------------------------------');
  console.log('AUDIT KEAMANAN LOG & DATA:');
  const dumped = JSON.stringify(stats) + JSON.stringify(history);
  const leakedKey = allKeys.some(k => dumped.includes(k));
  console.log(`  Apakah ada API key bocor di stats/log? ${leakedKey ? '❌ YA (BOCOR)' : '✅ TIDAK (AMAN TERLINDUNGI)'}`);
  console.log('====================================================\n');
}

runForcedRotationTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
