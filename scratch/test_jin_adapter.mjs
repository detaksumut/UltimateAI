import { providerRegistryInstance } from '../server/providers/ProviderRegistry.mjs';

async function testJINAdapter() {
  console.log('=== TESTING JIN ADAPTER INTEGRATION ===');

  // 1. Check registry resolution
  const resolved = providerRegistryInstance.resolveProviderForStrategy('general');
  console.log('Resolved Provider:', resolved.gateway, '| Model:', resolved.model);
  if (resolved.gateway !== 'LLAMA_CPP') {
    throw new Error(`Expected LLAMA_CPP gateway, got ${resolved.gateway}`);
  }

  // 2. Health check
  const health = await providerRegistryInstance.getHealthStatus();
  console.log('Health Status:', JSON.stringify(health, null, 2));

  // 3. Test generate via LlamaCppAdapter
  console.log('\nTesting generate() via LlamaCppAdapter...');
  const t0 = Date.now();
  const resp = await resolved.provider.generate({
    prompt: 'Apa itu metode ilmiah? Jawab dalam 1 kalimat.',
    temperature: 0.0,
    maxTokens: 100
  });
  console.log('Response in', Date.now() - t0, 'ms:');
  console.log('Success:', resp.success);
  console.log('Content:', resp.content?.trim());
  console.log('Usage:', JSON.stringify(resp.usage));

  // 4. Assert NO hidden fallback
  console.log('\nAsserting NO hidden fallback on bad host...');
  const brokenAdapter = new (resolved.provider.constructor)({ host: 'http://127.0.0.1:9999' });
  const failedResp = await brokenAdapter.generate({ prompt: 'test' });
  console.log('Broken host response:', failedResp);
  if (failedResp.success !== false || !failedResp.error.includes('LlamaCppAdapter Failure')) {
    throw new Error('Expected clean failure without hidden fallback!');
  }
  console.log('Zero hidden fallback verified: PASS');

  console.log('\n=== ALL JIN ADAPTER INTEGRATION TESTS PASSED ===');
}

testJINAdapter().catch(console.error);
