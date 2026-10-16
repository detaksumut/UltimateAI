/**
 * DomainContract.mjs
 * FASE 0 — Unified JIN Cognitive Core + Modular Intelligence Domains.
 *
 * Satu JIN utuh, setiap domain kecerdasan berdiri sendiri.
 * Tidak boleh ada import silang antar-domain. Semua komunikasi:
 *   JIN Core -> CapabilityRegistry -> domain.execute(input)
 *   domain -> { status, data, meta, error } -> JIN Core (verify -> respond -> memory)
 *
 * Status baku perception:
 *   OK       — teks/artifact valid, siap dianalisis
 *   EMPTY    — input kosong, tidak ada yang bisa dibaca
 *   NEED_OCR — PDF scan/gambar, butuh jalur OCR/vision (jujur, bukan '')
 *   FAILED   — error teknis dengan alasan eksplisit
 */

export const DOMAIN_STATUS = Object.freeze({
  OK: 'OK',
  EMPTY: 'EMPTY',
  NEED_OCR: 'NEED_OCR',
  FAILED: 'FAILED'
});

export const DOMAIN_NAMES = Object.freeze({
  DOC_READ: 'doc.read',
  DOC_ANALYZE: 'doc.analyze',
  IMAGE_GENERATE: 'image.generate',
  IMAGE_EDIT: 'image.edit',
  IMAGE_ANALYZE: 'image.analyze',
  MUSIC_COMPOSE: 'music.compose',
  WEB_TRACE: 'web.trace',
  DEVICE_FORMAL: 'device.formal'
});

/**
 * Validasi hasil domain. Setiap domain WAJIB mengembalikan { status, data }.
 */
export function assertDomainResult(result, domainName = 'unknown') {
  if (!result || typeof result !== 'object' || !result.status) {
    throw new Error(`[DomainContract] ${domainName} returned invalid result (missing status)`);
  }
  if (!Object.values(DOMAIN_STATUS).includes(result.status)) {
    throw new Error(`[DomainContract] ${domainName} returned unknown status: ${result.status}`);
  }
  return true;
}

export default { DOMAIN_STATUS, DOMAIN_NAMES, assertDomainResult };
