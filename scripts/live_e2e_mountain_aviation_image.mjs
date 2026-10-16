/**
 * live_e2e_mountain_aviation_image.mjs
 * ONE real end-to-end IMAGE_GENERATION run for the prompt
 *   "pesawat terbang melintas gunung"   (airplane flying across a mountain range)
 *
 * Uses the EXISTING ImageGeneration pipeline (no new implementation):
 *
 *   USER PROMPT
 *   → ImageGeneration.capabilityProbe → provider (NINEROUTER gateway | local COMFYUI)
 *   → QwenVisualPlanner (llama.cpp :8080)  → visual spec (enriched prompt)
 *   → provider generation → ImageOutputSizePolicy
 *   → artifact persisted under storage/artifacts/images → IMAGE_STUDIO reference
 *   → verifyArtifact() → renderable PNG on disk
 *
 * Two CLI knobs (both optional):
 *   node scripts/live_e2e_mountain_aviation_image.mjs
 *        → provider resolved from .env (IMAGE_PROVIDER)
 *   node scripts/live_e2e_mountain_aviation_image.mjs "custom prompt"
 *        → custom prompt
 *   node scripts/live_e2e_mountain_aviation_image.mjs --provider=NINEROUTER
 *        → force the 9Router gateway (auto-falls back to ComfyUI inside the service)
 *   node scripts/live_e2e_mountain_aviation_image.mjs --provider=COMFYUI
 *        → force local Stable Diffusion 1.5 on :8188
 *
 * The script NEVER prints NINEROUTER_KEY / API keys.
 */

import fs from 'fs';
import path from 'path';

import '../server/config/env.mjs';
import { imageGenerationInstance } from '../server/agent/ImageGeneration.mjs';
import { nineRouterGatewayAdapterInstance } from '../server/agent/adapters/NineRouterGatewayAdapter.mjs';

const DEFAULT_PROMPT = 'pesawat terbang melintas gunung';

const args = process.argv.slice(2);
const providerArg = args.find((a) => a.startsWith('--provider='));
const providerOverride = providerArg ? providerArg.split('=')[1].toUpperCase() : null;
const prompt = args.find((a) => !a.startsWith('--')) || DEFAULT_PROMPT;

async function main() {
  console.log('===============================================================');
  console.log('  LIVE E2E: IMAGE GENERATION — "pesawat terbang melintas gunung"');
  console.log('===============================================================');
  console.log(`[INPUT] prompt="${prompt}"`);
  console.log(`[INPUT] providerOverride=${providerOverride || '(auto from .env)'}`);

  // 0. Preflight — what the pipeline itself would select.
  const capability = await imageGenerationInstance.capabilityProbe();
  console.log(`[PREFLIGHT] capabilityProbe: available=${capability.available} provider=${capability.provider}`);
  console.log(`[PREFLIGHT] reason: ${capability.reason}`);

  // 0B. Fast-profile gate: the LCM submit sends a loose clip weight
  // (LoraLoader strength_clip 1.1). ComfyUI validates clip strengths strictly
  // against [-10, 10] with zero tolerance; one decimal place over either
  // boundary aborts the whole queue. Fail the run here, before the slow engine
  // spends minutes, whenever the operator sets a strength outside (-3, 3).
  const fastCfgVal = Number(process.env.COMFYUI_FAST_CFG ?? 1.5);
  const loraVal = Number(process.env.COMFYUI_FAST_LORA_STRENGTH ?? 1.0);
  if ((Number.isFinite(fastCfgVal) && Math.abs(fastCfgVal) > 5) || (Number.isFinite(loraVal) && Math.abs(loraVal) > 3)) {
    console.error(`[PREFLIGHT] FAILED: COMFYUI_FAST_CFG=${process.env.COMFYUI_FAST_CFG} / COMFYUI_FAST_LORA_STRENGTH=${process.env.COMFYUI_FAST_LORA_STRENGTH} outside the stable LCM window (CFG -5..5, LoRA -3..3).`);
    console.log('LIVE RESULT: BLOCKED');
    process.exit(2);
  }
  if (!capability.available) {
    console.error('[PREFLIGHT] FAILED: no image provider is online. Nothing will be generated.');
    console.log('LIVE RESULT: BLOCKED');
    process.exit(2);
  }

  // Optional discovery telemetry for the 9Router gateway (key never printed).
  if ((providerOverride || capability.provider) === 'NINEROUTER') {
    const probe = await nineRouterGatewayAdapterInstance.probe();
    console.log(`[PREFLIGHT] 9Router models discovered (${probe.models.length}): ${probe.models.join(', ') || '(none)'}`);
  }

  // 1. Real generation through the existing service.
  const startedAt = Date.now();
  const result = await imageGenerationInstance.generateImage({
    prompt,
    aspectRatio: '16:9',
    providerOverride,
    generationId: `gid-aviation-${Date.now()}`,
    messageId: `mid-aviation-${Date.now()}`,
    signal: null,
  });
  const elapsedMs = Date.now() - startedAt;

  const artifact = result?.artifact;
  if (!result?.success || !artifact) {
    console.error(`\n[E2E] FAILED (${elapsedMs}ms): ${result?.error || 'no artifact'}`);
    console.log('LIVE RESULT: FAILED');
    process.exit(1);
  }

  // 2. Independent verification of the produced artifact.
  const verify = imageGenerationInstance.verifyArtifact(artifact);
  const w = Number(artifact.width) || 0;
  const h = Number(artifact.height) || 0;
  const localPath = path.resolve(artifact.localPath || '');
  const fileExists = fs.existsSync(localPath);
  const fileBytes = fileExists ? fs.statSync(localPath).size : 0;
  const magic = fileExists
    ? fs.readFileSync(localPath).subarray(0, 8).toString('hex')
    : '';
  const isPng = magic === '89504e470d0a1a0a';

  console.log(`\n[E2E] SUCCESS in ${elapsedMs}ms`);
  console.log(`      provider    : ${artifact.provider}`);
  console.log(`      gateway     : ${artifact.gateway}`);
  console.log(`      model       : ${artifact.model}`);
  console.log(`      planner     : ${artifact.visualPlanner || '(n/a)'}`);
  console.log(`      dimensions  : ${w} x ${h}`);
  console.log(`      format      : ${artifact.format} (${fileBytes} bytes on disk)`);
  console.log(`      url         : ${artifact.url}`);
  console.log(`      localPath   : ${localPath}`);
  console.log(`      studio ref  : ${artifact.studio?.projectId || '(none)'}`);
  console.log(`      verify      : renderable=${verify.renderable} (${verify.reason})`);
  console.log(`      png magic   : ${isPng ? 'VALID PNG' : magic}`);

  const ok = verify.renderable === true && fileExists && isPng && fileBytes > 0;
  console.log(`\nLIVE RESULT: ${ok ? 'PASS' : 'FAILED'}`);

  console.log('RESULT_JSON: ' + JSON.stringify({
    ok,
    elapsedMs,
    prompt,
    provider: artifact.provider,
    gateway: artifact.gateway,
    model: artifact.model,
    width: w,
    height: h,
    bytes: fileBytes,
    isPng,
    localPath,
    url: artifact.url,
    verify,
  }));

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('LIVE E2E crashed:', err.message);
  process.exit(1);
});
