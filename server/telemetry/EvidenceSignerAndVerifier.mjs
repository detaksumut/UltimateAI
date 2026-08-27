/**
 * EvidenceSignerAndVerifier.mjs (Enterprise Ed25519 Cryptographic Attestation Edition)
 * PHASE 5.3 - Asymmetric Ed25519 Digital Signing, Tamper-Evident Hashing & Authenticity Verification.
 * 
 * DUAL-LAYER ASSURANCE:
 * 1. Integrity Layer: SHA-256 Content Hashes (Answers: "Did files change?")
 * 2. Authenticity Layer: Ed25519 Asymmetric Signature (Answers: "Who authorized this manifest?")
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class EvidenceSignerAndVerifier {
  /**
   * Generates or loads Ed25519 Keypair, signs the manifest, and saves public key.
   */
  static signManifest(manifestObject, evidenceDir = null) {
    const targetDir = evidenceDir || path.resolve(process.cwd(), 'certification-evidence');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const keyPath = path.join(targetDir, 'attestation-private-key.pem');
    const pubKeyPath = path.join(targetDir, 'attestation-public-key.pem');

    let privateKeyPem;
    let publicKeyPem;

    if (fs.existsSync(keyPath) && fs.existsSync(pubKeyPath)) {
      privateKeyPem = fs.readFileSync(keyPath, 'utf-8');
      publicKeyPem = fs.readFileSync(pubKeyPath, 'utf-8');
    } else {
      // Generate new Ed25519 Keypair
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' }
      });
      privateKeyPem = privateKey;
      publicKeyPem = publicKey;
      fs.writeFileSync(keyPath, privateKeyPem, 'utf-8');
      fs.writeFileSync(pubKeyPath, publicKeyPem, 'utf-8');
    }

    // Canonical payload string to sign (excluding signature block itself)
    const payloadToSign = JSON.stringify({
      certificationId: manifestObject.certificationId,
      timestamp: manifestObject.timestamp,
      environmentSnapshot: manifestObject.environmentSnapshot,
      cryptographicHashes: manifestObject.cryptographicHashes,
      threeTierVerdict: manifestObject.threeTierVerdict
    });

    const signatureBuffer = crypto.sign(null, Buffer.from(payloadToSign, 'utf-8'), privateKeyPem);
    const signatureHex = signatureBuffer.toString('hex');

    const signedManifest = {
      ...manifestObject,
      digitalAttestation: {
        algorithm: 'Ed25519',
        signerKeyId: 'JIN-ATTESTATION-KEY-001',
        publicKeyPath: 'attestation-public-key.pem',
        signature: signatureHex,
        signedAt: new Date().toISOString()
      }
    };

    fs.writeFileSync(
      path.join(targetDir, 'session-manifest.json'),
      JSON.stringify(signedManifest, null, 2),
      'utf-8'
    );

    return signedManifest;
  }

  /**
   * Verifies both SHA-256 artifact hashes AND Ed25519 asymmetric signature.
   */
  static verifyEvidenceBundle(evidenceDir = null) {
    const targetDir = evidenceDir || path.resolve(process.cwd(), 'certification-evidence');
    const manifestPath = path.join(targetDir, 'session-manifest.json');
    const pubKeyPath = path.join(targetDir, 'attestation-public-key.pem');

    console.log('================================================================');
    console.log('  PHASE 5.3: ED25519 ASYMMETRIC ATTESTATION & INTEGRITY VERIFIER');
    console.log(`  Directory: ${targetDir}`);
    console.log('================================================================\n');

    if (!fs.existsSync(manifestPath)) {
      console.error('❌ Manifest Error: "session-manifest.json" not found.');
      return { isValid: false, reason: 'MANIFEST_NOT_FOUND' };
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (err) {
      console.error('❌ Manifest Error: Corrupted JSON in session-manifest.json');
      return { isValid: false, reason: 'MANIFEST_CORRUPTED' };
    }

    // --- STEP 1: VERIFY INDIVIDUAL SHA-256 HASHES ---
    console.log('--- Step 1: Verifying SHA-256 Hashes of All Artifacts ---');
    const hashes = manifest.cryptographicHashes || {};
    let passedHashes = 0;
    let failedHashes = 0;

    for (const [filename, expectedHash] of Object.entries(hashes)) {
      const filePath = path.join(targetDir, filename);

      if (!fs.existsSync(filePath)) {
        console.error(`  [FAIL] Missing Artifact: ${filename}`);
        failedHashes++;
        continue;
      }

      const fileContent = fs.readFileSync(filePath);
      const actualHash = crypto.createHash('sha256').update(fileContent).digest('hex');

      if (actualHash === expectedHash) {
        console.log(`  [PASS] ${filename} -> SHA-256 Validated (${actualHash.substring(0, 16)}...)`);
        passedHashes++;
      } else {
        console.error(`  [TAMPER DETECTED] ${filename} -> Hash Mismatch!`);
        failedHashes++;
      }
    }

    const hashIntegrityPassed = failedHashes === 0 && passedHashes > 0;
    console.log(`\n  Hash Integrity Status: ${hashIntegrityPassed ? 'EVIDENCE_INTEGRITY_VERIFIED ✅' : 'INTEGRITY_FAILED ❌'}\n`);

    // --- STEP 2: VERIFY ED25519 ASYMMETRIC DIGITAL SIGNATURE ---
    console.log('--- Step 2: Verifying Ed25519 Digital Signature Authenticity ---');
    const attestation = manifest.digitalAttestation;

    if (!attestation || !attestation.signature) {
      console.error('  [FAIL] No Ed25519 digital attestation block found in manifest.');
      return {
        isValid: false,
        hashIntegrity: hashIntegrityPassed,
        signatureAuthenticity: false,
        reason: 'ATTESTATION_BLOCK_MISSING'
      };
    }

    if (!fs.existsSync(pubKeyPath)) {
      console.error('  [FAIL] Public key "attestation-public-key.pem" missing from directory.');
      return {
        isValid: false,
        hashIntegrity: hashIntegrityPassed,
        signatureAuthenticity: false,
        reason: 'PUBLIC_KEY_MISSING'
      };
    }

    const publicKeyPem = fs.readFileSync(pubKeyPath, 'utf-8');
    const payloadToVerify = JSON.stringify({
      certificationId: manifest.certificationId,
      timestamp: manifest.timestamp,
      environmentSnapshot: manifest.environmentSnapshot,
      cryptographicHashes: manifest.cryptographicHashes,
      threeTierVerdict: manifest.threeTierVerdict
    });

    const isSignatureValid = crypto.verify(
      null,
      Buffer.from(payloadToVerify, 'utf-8'),
      publicKeyPem,
      Buffer.from(attestation.signature, 'hex')
    );

    if (isSignatureValid) {
      console.log(`  [PASS] Ed25519 Signature Verified (Signer: ${attestation.signerKeyId})`);
      console.log(`  [PASS] Signer Public Key Algorithm: ${attestation.algorithm}`);
    } else {
      console.error('  [FAIL] Ed25519 Digital Signature Verification Failed (Signature Mismatch)');
    }

    const overallAttestationPassed = hashIntegrityPassed && isSignatureValid;

    console.log('\n================================================================');
    console.log(`  OVERALL ATTESTATION DECISION:`);
    console.log(`  - Artifact Tamper-Evidence: ${hashIntegrityPassed ? 'EVIDENCE_INTEGRITY_VERIFIED ✅' : 'FAILED ❌'}`);
    console.log(`  - Signer Authenticity:      ${isSignatureValid ? 'CRYPTOGRAPHICALLY_SIGNED_CHAIN_OF_CUSTODY ✍️' : 'FAILED ❌'}`);
    console.log(`  - Final Verdict:            ${overallAttestationPassed ? 'VERIFIED_ATTRIBUTABLE_EVIDENCE_BUNDLE 🏆' : 'ATTESTATION_FAILED ❌'}`);
    console.log('================================================================\n');

    return {
      isValid: overallAttestationPassed,
      certificationId: manifest.certificationId,
      hashIntegrity: hashIntegrityPassed,
      signatureAuthenticity: isSignatureValid,
      signerKeyId: attestation.signerKeyId,
      verdict: overallAttestationPassed ? 'VERIFIED_ATTRIBUTABLE_EVIDENCE_BUNDLE' : 'ATTESTATION_FAILED'
    };
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].includes('EvidenceSignerAndVerifier')) {
  const result = EvidenceSignerAndVerifier.verifyEvidenceBundle();
  process.exit(result.isValid ? 0 : 1);
}

export default EvidenceSignerAndVerifier;
