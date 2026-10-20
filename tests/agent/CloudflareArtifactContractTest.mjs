import assert from 'node:assert/strict';
import { ImageGeneration } from '../../server/agent/ImageGeneration.mjs';
import { imageOutputSizePolicyInstance, MAX_IMAGE_BYTES } from '../../server/agent/ImageOutputSizePolicy.mjs';
import zlib from 'node:zlib';

const service = new ImageGeneration();

// ── Build a minimal valid PNG buffer (1x1 magenta) ──
function encodePng(width, height) {
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c;
  }
  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const writeChunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, color type 2 (RGB)
  const idatRaw = [];
  for (let y = 0; y < height; y++) {
    idatRaw.push(0); // filter none
    for (let x = 0; x < width; x++) { idatRaw.push(255, 0, 255); }
  }
  const raw = Buffer.from(idatRaw);
  const compressed = zlib.deflateSync(raw);
  const idat = writeChunk('IDAT', compressed);
  const iend = writeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, writeChunk('IHDR', ihdr), idat, iend]);
}

const fakeImageBytes = encodePng(512, 512);

// ── Mock fetch that returns Cloudflare image/png bytes ──
const mockFetch = async (url, init) => {
  return new Response(fakeImageBytes, {
    status: 200,
    headers: { 'content-type': 'image/png' }
  });
};

// Force Cloudflare credentials present so the adapter proceeds past the config guard.
process.env.CLOUDFLARE_API_TOKEN = 'cfut_test_dummy';
process.env.CLOUDFLARE_ACCOUNT_ID = 'test_account_id';
process.env.CLOUDFLARE_IMAGE_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';

const result = await service.generateImage({
  prompt: 'a simple red circle on white background',
  aspectRatio: '16:9',
  size: '512x512',
  providerOverride: 'CLOUDFLARE_WORKERS_AI',
  generationId: 'cf-contract-test-1',
  messageId: 'cf-contract-msg-1'
}, { fetch: mockFetch });

console.log('RESULT success=', result.success);
console.log('RESULT error=', result.error || result.reasonCode || '');

assert.equal(result.success, true, 'Cloudflare generation should succeed');
assert.ok(result.artifact, 'result.artifact must be defined (contract fix)');
assert.ok(result.artifact.url, 'artifact.url must be present');
assert.equal(result.artifact.provider, 'CLOUDFLARE_WORKERS_AI');
assert.ok(result.artifact.sizeBytes > 0, 'artifact.sizeBytes must be > 0');
assert.ok(result.artifact.sizeBytes < MAX_IMAGE_BYTES, 'artifact.sizeBytes must be < 1 MB');
assert.equal(result.artifact.renderable, true, 'artifact.renderable must be true');

// Compliance: physical file passes validatePersistedFile
const postCheck = imageOutputSizePolicyInstance.validatePersistedFile(result.artifact.localPath);
assert.ok(postCheck.valid, `persisted artifact must validate: ${postCheck.reason}`);
assert.ok(postCheck.sizeBytes < MAX_IMAGE_BYTES, 'persisted file must be < 1 MB');

// LocalRouterServer compliance check mirror
const verify = service.verifyArtifact(result.artifact);
assert.equal(verify.renderable, true, `verifyArtifact renderable must be true (reason: ${verify.reason})`);

console.log('Artifact:', {
  id: result.artifact.id,
  url: result.artifact.url,
  provider: result.artifact.provider,
  model: result.artifact.model,
  sizeBytes: result.artifact.sizeBytes,
  width: result.artifact.width,
  height: result.artifact.height,
  mimeType: result.artifact.mimeType,
  localPath: result.artifact.localPath
});

console.log('CloudflareArtifactContractTest: PASS');
