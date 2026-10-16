/**
 * test_capacity_escalation.mjs
 * Verification suite for the JIN capacity-maximization changes:
 *
 *   CAP-01: DEEP_REASONING escalates to the cloud frontier model (explicit, labelled)
 *   CAP-02: APP_SYNTHESIS escalates too (the real /production-synthesis caller)
 *   CAP-03: FAST_CHAT still stays LOCAL (sovereignty/default path preserved)
 *   CAP-04: ROUTER_HEAVY_ESCALATION=false keeps heavy work local (offline mode)
 *   CAP-05: prompt ceiling has ONE source of truth (28000), truncation aligns
 *   CAP-06: getProviderConfigStatus() reports the REAL runtime (no 'AMPUTATED' stub)
 *   CAP-07: AgentPolicy specialists reference installed models (no dead 'qwen3:8b')
 *   CAP-08: memory health surface returns a real HEALTHY/DEGRADED/CRITICAL verdict
 *
 * Usage: node tests/agent/test_capacity_escalation.mjs
 */

import assert from 'assert';
import '../../server/config/env.mjs';
import { modelRoutingServiceInstance } from '../../server/local_router/ModelRoutingService.mjs';
import { getProviderConfigStatus, config } from '../../server/config/env.mjs';
import { JIN_OPERATING_DOCTRINE, LOCAL_MODEL, CLOUD_MODEL } from '../../server/agent/AgentPolicy.mjs';
import { memoryCoreHealthCheckInstance } from '../../server/memory/MemoryCoreHealthCheck.mjs';
import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';

let pass = 0;
let fail = 0;

function check(id, label, fn) {
  try {
    fn();
    pass++;
    console.log(`  [PASS] ${id}: ${label}`);
  } catch (err) {
    fail++;
    console.error(`  [FAIL] ${id}: ${label}\n         -> ${err.message}`);
  }
}

console.log('\n===============================================================');
console.log('  JIN CAPACITY ESCALATION — VERIFICATION');
console.log('===============================================================\n');

const deep = modelRoutingServiceInstance.determineRoute({ messages: [{ role: 'user', content: 'analisis mendalam' }], capability: 'DEEP_REASONING' });
const synth = modelRoutingServiceInstance.determineRoute({ messages: [{ role: 'user', content: 'buatkan aplikasi' }], capability: 'APP_SYNTHESIS' });
const chat = modelRoutingServiceInstance.determineRoute({ messages: [{ role: 'user', content: 'halo' }], capability: 'FAST_CHAT' });

check('CAP-01', 'DEEP_REASONING -> cloud frontier (explicit escalation)', () => {
  assert.strictEqual(deep.provider, 'gemini', `expected gemini, got ${deep.provider}`);
  assert.strictEqual(deep.escalated, true, 'escalated flag must be set');
  assert.strictEqual(deep.label, 'CLOUD_GEMINI_HEAVY', `label=${deep.label}`);
  assert.strictEqual(deep.strategy, 'heavy_cloud_escalation');
  console.log(`         -> ${deep.strategy} (${deep.escalationReason})`);
});

check('CAP-02', 'APP_SYNTHESIS -> cloud frontier (real synthesis caller)', () => {
  assert.strictEqual(synth.provider, 'gemini', `expected gemini, got ${synth.provider}`);
  assert.strictEqual(synth.escalated, true);
});

check('CAP-03', 'FAST_CHAT stays LOCAL (sovereignty default preserved)', () => {
  assert.strictEqual(chat.provider, 'llamacpp', `expected llamacpp, got ${chat.provider}`);
  assert.ok(!chat.escalated, 'light chat must not be escalated');
  console.log(`         -> ${chat.strategy} / ${chat.candidates[0].model}`);
});
check('CAP-04', 'ROUTER_HEAVY_ESCALATION=false keeps heavy work local', () => {
  const saved = process.env.ROUTER_HEAVY_ESCALATION;
  process.env.ROUTER_HEAVY_ESCALATION = 'false';
  try {
    const routed = modelRoutingServiceInstance.determineRoute({ messages: [], capability: 'DEEP_REASONING' });
    assert.strictEqual(routed.provider, 'llamacpp', `offline mode must stay local, got ${routed.provider}`);
  } finally {
    if (saved === undefined) delete process.env.ROUTER_HEAVY_ESCALATION;
    else process.env.ROUTER_HEAVY_ESCALATION = saved;
  }
});

check('CAP-05', 'prompt ceiling unified at 28000 + truncation aligned', () => {
  const ceiling = modelRoutingServiceInstance._maxPromptChars();
  assert.strictEqual(ceiling, 28000, `ceiling=${ceiling}`);
  const long = 'x'.repeat(30000);
  const out = modelRoutingServiceInstance._truncateForLocal([{ role: 'user', content: long }]);
  assert.ok(out[0].content.length <= 28080, `truncated length=${out[0].content.length}`);
  assert.ok(out[0].content.includes('dipotong oleh router'), 'truncation must be announced');
  const short = 'y'.repeat(1000);
  const kept = modelRoutingServiceInstance._truncateForLocal([{ role: 'user', content: short }]);
  assert.strictEqual(kept[0].content, short, 'short prompts must pass through untouched');
});

check('CAP-06', 'getProviderConfigStatus() reports the REAL runtime', () => {
  const st = getProviderConfigStatus();
  assert.strictEqual(st.llamacpp.configured, true, 'llamacpp must be configured (LLAMACPP_HOST set)');
  assert.strictEqual(st.llamacpp.disabled, false, 'llamacpp must NOT be reported disabled');
  assert.notStrictEqual(st.llamacpp.model, 'AMPUTATED', 'must not return the legacy AMPUTATED stub');
  assert.ok(st.llamacpp.model.includes('qwen2.5-3b'), `model=${st.llamacpp.model}`);
  assert.strictEqual(config.localLLM.enabled, true, 'config.localLLM.enabled must be true');
  console.log(`         -> primary=${st.llamacpp.model} ctx=${st.llamacpp.ctxSize} heavyEscalation=${st.heavyEscalation}`);
});

check('CAP-07', 'AgentPolicy specialists reference installed models', () => {
  const pol = JIN_OPERATING_DOCTRINE.SPECIALIST_ROUTING_POLICY;
  for (const [k, models] of Object.entries(pol)) {
    for (const m of models) {
      assert.ok(!String(m).startsWith('qwen3:'), `${k} still references dead Ollama model ${m}`);
    }
  }
  assert.strictEqual(pol.DEEP_REASONING[0], CLOUD_MODEL, 'DEEP_REASONING should lead with the frontier model');
  assert.ok(pol.FAST_RESEARCH.includes(LOCAL_MODEL), 'FAST_RESEARCH should include the local engine');
});

/** CAP-09: COMFYUI_LCM_LORA missing from disk, COMFYUI_FAST_PROFILE forced true,
    and the submit path must emit the legacy graph (no LoraLoader). */
check('CAP-09', 'forced fast without LoRA falls back to legacy graph', async () => {
  // Note: env cannot be deleted here without touching dotenv-loaded state, so
  // request an unknown LoRA filename instead — identical resolution branch.
  process.env.COMFYUI_LCM_LORA = 'this-file-does-not-exist.safetensors';
  try {
    const got = []; let hist = 0;
    const fetchFn = async (url, opts) => {
      if (String(url).endsWith('/prompt') && opts?.method === 'POST') {
        got.push(JSON.parse(opts.body).prompt);
        return { ok: true, json: async () => ({ prompt_id: 'cap09' }) };
      }
      if (String(url).includes('/history/')) {
        hist++;
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false, status: 404, text: async () => '' };
    };
    await imageGenerationInstance.generateImage(
      { prompt: 'fallback probe', aspectRatio: '16:9', providerOverride: 'COMFYUI', signal: AbortSignal.timeout(500) },
      { fetch: fetchFn }
    );
    assert.ok(got.length >= 1, 'need at least the LCM attempt');
    const first = got[0];
    const loader = Object.values(first).find(n => n.class_type === 'LoraLoader');
    assert.ok(!loader, 'forced fast without LoRA must NOT send LoraLoader');
    const sampler = Object.values(first).find(n => n.class_type === 'KSampler');
    assert.ok(sampler, 'legacy KSampler must still be present');
    assert.strictEqual(sampler.inputs.sampler_name, 'dpmpp_2m', 'legacy sampler preserved');
  } finally {
    delete process.env.COMFYUI_LCM_LORA;
  }
});

const mem = await memoryCoreHealthCheckInstance.runDiagnostics();
check('CAP-08', 'memory health returns a real verdict + counts', () => {
  assert.ok(['HEALTHY', 'DEGRADED', 'CRITICAL'].includes(mem.status), `status=${mem.status}`);
  assert.strictEqual(typeof mem.checks.totalVaultFiles, 'number');
  assert.ok(mem.checks.totalVaultFiles > 0, 'vault must contain memories');
  console.log(`         -> ${mem.summary}`);
  if (mem.issues.length) console.log(`         -> issues: ${mem.issues.join(' | ')}`);
});

console.log('\n===============================================================');
console.log(`  RESULT: ${pass} PASS / ${fail} FAIL`);
console.log('===============================================================\n');

process.exit(fail === 0 ? 0 : 1);