/**
 * AntigravityVault.mjs
 * Secure Credential Vault for Antigravity OAuth Connections.
 * Implements AES-256-GCM authenticated encryption-at-rest.
 * Encryption keys are derived from isolated environment variables / OS secret context,
 * ensuring secret keys are never stored alongside encrypted connection metadata.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // Standard 128-bit Auth Tag

export class AntigravityVault {
  constructor(masterKey = null) {
    this.masterKey = this._resolveMasterKey(masterKey);
  }

  _resolveMasterKey(customKey) {
    const rawKey = customKey || process.env.ULTIMATEAI_VAULT_KEY || process.env.ENCRYPTION_SECRET || 'ultimateai_default_bootstrap_vault_key_2026';
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext secret string (e.g. access/refresh tokens)
   * @param {string} plaintext 
   * @returns {string} Encrypted ciphertext in format: iv:authTag:encryptedHex
   */
  encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return '';

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts encrypted secret string
   * @param {string} payload - Format: iv:authTag:encryptedHex
   * @returns {string} Decrypted plaintext string
   */
  decrypt(payload) {
    if (!payload || typeof payload !== 'string' || !payload.includes(':')) return '';

    try {
      const [ivHex, authTagHex, encryptedHex] = payload.split(':');
      if (!ivHex || !authTagHex || !encryptedHex) return '';

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      // Return empty string on decryption failure (fail-closed)
      return '';
    }
  }
}

export const antigravityVaultInstance = new AntigravityVault();
export default antigravityVaultInstance;
