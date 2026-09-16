/**
 * live_e2e_9router_image.mjs
 * ONE real end-to-end 9Router image generation through the full JIN pipeline:
 *
 *   USER PROMPT ("buatkan image pesawat terbang untuk presentasi enterprise")
 *   → ImageGeneration capabilityProbe → 9Router discovery
 *   → QwenVisualPlanner (llama.cpp :8080)
 *   → NineRouterGatewayAdapter.select (discovery-driven)
 *   → NineRouterGatewayAdapter.generateImage (REAL 9Router)
 *   → ImageOutputSizePolicy → artifact → IMAGE_STUDIO reference → verifyArtifact
 *
 * Usage: node scripts/live_e2e_9router_image.mjs
 * Prereqs: 9Router running at NINEROUTER_URL, llama.cpp at LLAMACPP_HOST,
 *          NINEROUTER_KEY configured in .env.
 *
 * The script NEVER prints the NINEROUTER_KEY.
 */

import fs from 'fs';
import path from 'path';

import '../server/config/env.mjs';
import { imageGenerationInstance } from '../server/agent/ImageGeneration.mjs';
import { nineRouterGatewayAdapterInstance } from '../server/agent/adapters/NineRouterGatewayAdapter.mjs';

const PROMPT = 'buatkan image pesawat terbang untuk presentasi enterprise';

async function main() {
  console.log('===============================================================');
  console.log('  LIVE E2E: 9ROUTER IMAGE PIPELINE (pesawat terbang enterprise)');
  console.log('===============================================================');

  // 0. Preflight: discovery probe against the REAL 9Router.
  const probe = await nineRouterGatewayAdapterInstance.probe();
  console.log(`[PREFLIGHT] 9Router probe: available=${probe.available} models=${probe.models.length}`);
  if (!probe.available) {
    console.error('[PREFLIGHT] FAILED: NINEROUTER_URL not reachable or empty model list.');
    console.error(`            reason: ${probe.reason}`);
    console.log('LIVE RESULT: BLOCKED');
    process.exit(2);
  }
  console.log(`[PREFLIGHT] Discovered models: ${probe.models.join(', ')}`);

  // 1. Real generation through the full pipeline.
  console.log(`\n[E2E] Prompt: "${PROMPT}"`);
  const startedAt = Date.now();
  const result = await imageGenerationInstance.generateImage({
    prompt: PROMPT,
    providerOverride: 'NINEROUTER',
    aspectRatio: '16:9',
    generationId: `gid-live-${Date.now()}`,
    messageId: `mid-live-${Date.now()}`,
    signal: null
  });
  const elapsedMs = Date.now() - startedAt;

  const artifact = result?.artifact;
  if (!result?.success || !artifact) {
    console.error(`\n[E2E] FAILED (${elapsedMs}ms): ${result?.error || 'no artifact'}`);
    console.log('LIVE RESULT: FAILED');
    process.exit(1);
  }

  const verify = imageGenerationInstance.verifyArtifact(artifact);
  const w = Number(artifact.width) || 0;
  const h = Number(artifact.height) || 0;
  const actualRatio = w > 0 && h > 0 ? w / h : null;
  const requestedRatio = 16 / 9; // strict 16:9 ratio (≈1.7778)
  const aspectOk = actualRatio !== null && Math.abs(actualRatio - requestedRatio) / requestedRatio <= 0.05;
  const sizeOk = Number(artifact.bytesSize) > 0 && Number(artifact.bytesSize) <= 1_000_000;
  const viaNineRouter = artifact.provider === 'NINEROUTER' && artifact.gateway === '9ROUTER';
  console.log(`\n[E2E] SUCCESS in ${elapsedMs}ms`);
  console.log(`      model        : ${artifact.model}`);
  console.log(`      gateway      : ${artifact.gateway}`);
  console.log(`      planner      : ${artifact.visualPlanner}`);
  console.log(`      width(x)     : ${w} x ${h}`);
  console.log(`      aspect       : ${w}:${h} (${actualRatio !== null ? actualRatio.toFixed(4) : 'n/a'})`);
  console.log(`      requestedAspect : 16:9 strict -> actual=${aspectOk ? '16:9 OK' : 'NOT 16:9'}`);
  console.log(`      format       : ${artifact.format} (${artifact.bytesSize} bytes) -> within 1 MB = ${sizeOk}`);
  console.log(`      url          : ${artifact.url}`);
  console.log(`      localPath    : ${artifact.localPath}`);
  console.log(`      studio ref   : ${artifact.studio?.projectId || '(none)'}`);
  console.log(`      verify       : renderable=${verify.renderable} (${verify.reason})`);

  const fileExists = fs.existsSync(artifact.localPath) && fs.statSync(artifact.localPath).size > 1024;
  const finalOk = verify.renderable === true && fileExists && aspectOk && sizeOk && viaNineRouter;
  console.log(`\nLIVE RESULT: ${finalOk ? 'PASS' : 'FAILED'}${aspectOk ? '' : ' (strict 16:9 box NOT satisfied by actual artifact dimensions)'}${sizeOk ? '' : ' (artifact > 1 MB)'}${viaNineRouter ? '' : ' (artifact not generated through 9ROUTER)'}`);
  if (finalOk) {
    console.log(`Artifact file  : ${path.resolve(artifact.localPath)}`);
  }
  process.exit(finalOk ? 0 : 1);
}

main().catch((err) => {
  console.error('LIVE E2E crashed:', err.message);
  process.exit(1);
});