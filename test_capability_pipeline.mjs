/**
 * test_capability_pipeline.mjs
 * Verification test for AgentExecutor → CapabilityRegistry → web.* / system.* architecture.
 */

import { capabilityRegistryInstance } from './server/grounding/CapabilityRegistry.mjs';
import { toolRegistryInstance } from './server/tools/ToolRegistry.mjs';
import { agentExecutorInstance } from './server/agent/AgentExecutor.mjs';
import assert from 'assert';

console.log('═══════════════════════════════════════════════════════════════════');
console.log(' TEST: AgentExecutor → CapabilityRegistry → web.* / system.* ');
console.log('═══════════════════════════════════════════════════════════════════\n');

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
  }
}

async function checkAsync(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
  }
}

async function run() {
  // 1. Registry Inspection
  check('CapabilityRegistry lists registered capabilities', () => {
    const list = capabilityRegistryInstance.listCapabilities();
    assert.ok(list.length > 5, 'Should list multiple capabilities');
    assert.ok(capabilityRegistryInstance.hasCapability('web.search'), 'Must have web.search');
    assert.ok(capabilityRegistryInstance.hasCapability('web.open'), 'Must have web.open');
    assert.ok(capabilityRegistryInstance.hasCapability('system.inspect'), 'Must have system.inspect');
    assert.ok(capabilityRegistryInstance.hasCapability('system.sandbox'), 'Must have system.sandbox');
  });

  // 2. Capability Execution: system.inspect
  await checkAsync('CapabilityRegistry.executeCapability("system.inspect")', async () => {
    const res = await capabilityRegistryInstance.executeCapability('system.inspect', { scope: 'overview' });
    assert.ok(res, 'Should return inspect result');
    assert.strictEqual(res.service, 'DEVICE_INTELLIGENCE', 'Service should match');
  });

  // 3. Capability Execution: system.sandbox
  await checkAsync('CapabilityRegistry.executeCapability("system.sandbox")', async () => {
    const res = await capabilityRegistryInstance.executeCapability('system.sandbox', {
      code: 'console.log("HELLO_FROM_SYSTEM_SANDBOX");',
      runtime: 'node'
    });
    assert.strictEqual(res.exitCode, 0, 'Exit code should be 0');
    assert.ok(res.stdout.includes('HELLO_FROM_SYSTEM_SANDBOX'), 'Output should contain executed log');
  });

  // 4. Capability Execution: web.search
  await checkAsync('CapabilityRegistry.executeCapability("web.search")', async () => {
    const res = await capabilityRegistryInstance.executeCapability('web.search', { query: 'Indonesia', maxResults: 2 });
    assert.ok(res, 'Should return search result');
    assert.strictEqual(typeof res.sourcesCount, 'number', 'Should have sourcesCount');
    assert.ok(Array.isArray(res.sources), 'Sources should be array');
  });

  // 5. Capability Execution: web.open rejecting invalid protocol
  await checkAsync('CapabilityRegistry.executeCapability("web.open") rejects non-http protocol', async () => {
    let thrown = false;
    try {
      await capabilityRegistryInstance.executeCapability('web.open', { url: 'file:///etc/passwd' });
    } catch (err) {
      thrown = true;
      assert.ok(err.message.includes('INVALID_PROTOCOL') || err.message.includes('CAPABILITY_EXECUTION_ERROR'), 'Must block file://');
    }
    assert.ok(thrown, 'Must throw error on file protocol');
  });

  // 6. Capability Execution: explicitly unavailable capability fails closed
  await checkAsync('CapabilityRegistry rejects unavailable capability (speaker_diarization)', async () => {
    let thrown = false;
    try {
      await capabilityRegistryInstance.executeCapability('speaker_diarization', {});
    } catch (err) {
      thrown = true;
      assert.ok(err.message.includes('CAPABILITY_UNAVAILABLE'), 'Must throw CAPABILITY_UNAVAILABLE');
    }
    assert.ok(thrown, 'Must throw on disabled capability');
  });

  // 7. AgentExecutor Integration: executeStep with system.inspect
  await checkAsync('AgentExecutor.executeStep dispatches system.inspect', async () => {
    const stepResult = await agentExecutorInstance.executeStep({
      id: 'step_1',
      tool: 'system.inspect',
      params: { scope: 'overview' }
    });
    assert.ok(stepResult.success, 'Step execution should succeed');
    assert.ok(stepResult.result.artifactId, 'Artifact must be generated');
  });

  // 8. AgentExecutor Integration: executeStep with system.sandbox
  await checkAsync('AgentExecutor.executeStep dispatches system.sandbox', async () => {
    const stepResult = await agentExecutorInstance.executeStep({
      id: 'step_2',
      tool: 'system.sandbox',
      params: { code: 'console.log("AGENT_EXEC_OK");', runtime: 'node' }
    });
    assert.ok(stepResult.success, 'Step execution should succeed');
    assert.ok(stepResult.result.stdout.includes('<<<SANDBOX_OUTPUT_UNTRUSTED>>>'), 'Untrusted boundary must be present');
  });

  // 9. Backward Compatibility Shim: toolRegistryInstance
  await checkAsync('ToolRegistryAdapter backwards compatibility', async () => {
    assert.ok(toolRegistryInstance.hasTool('web.search'), 'Should have web.search');
    const tool = toolRegistryInstance.get('system.inspect');
    assert.ok(tool, 'Should retrieve tool');
    const tools = toolRegistryInstance.listTools();
    assert.ok(tools.length > 0, 'Should list tools');
  });

  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  FINAL RESULT: ${passed}/${total} TESTS PASSED`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);

  if (passed < total) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
