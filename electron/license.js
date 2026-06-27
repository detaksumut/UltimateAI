// electron/license.js — License Manager
// ─────────────────────────────────────────────────────
// Handles hardware fingerprinting, license file encryption,
// validation, and activation.
// ─────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

const LICENSE_FILE = 'license.dat';
const ENCRYPTION_ALGO = 'aes-256-gcm';
const APP_SECRET = 'UltimateAI-2026-Research-Platform'; // Embedded app secret

class LicenseManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.licensePath = path.join(userDataPath, LICENSE_FILE);
    this._licenseData = null;
  }

  // ── Hardware Fingerprint ────────────────────────────────────────────────
  getHardwareId() {
    const components = [];

    // CPU ID
    try {
      const cpuInfo = os.cpus()[0]?.model || 'unknown-cpu';
      components.push(`cpu:${cpuInfo}`);
    } catch { components.push('cpu:unknown'); }

    // OS hostname + username (stable across reboots)
    components.push(`host:${os.hostname()}`);
    components.push(`user:${os.userInfo().username}`);

    // Platform + arch
    components.push(`platform:${os.platform()}-${os.arch()}`);

    // Total memory (rounded to GB — stable)
    const memGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    components.push(`mem:${memGB}GB`);

    // Windows-specific: try to get motherboard serial
    if (os.platform() === 'win32') {
      try {
        const mbSerial = execSync('wmic baseboard get SerialNumber', { timeout: 5000 })
          .toString().trim().split('\n').pop().trim();
        if (mbSerial && mbSerial !== '' && mbSerial !== 'To Be Filled By O.E.M.') {
          components.push(`mb:${mbSerial}`);
        }
      } catch { /* ignore */ }

      try {
        const diskSerial = execSync('wmic diskdrive get SerialNumber', { timeout: 5000 })
          .toString().trim().split('\n')[1]?.trim();
        if (diskSerial) {
          components.push(`disk:${diskSerial}`);
        }
      } catch { /* ignore */ }
    }

    const fingerprint = crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');

    return {
      fingerprint,
      components: components.length,
      displayId: fingerprint.substring(0, 16).toUpperCase(),
    };
  }

  // ── Encryption ──────────────────────────────────────────────────────────
  _deriveKey() {
    const { fingerprint } = this.getHardwareId();
    return crypto
      .createHash('sha256')
      .update(`${APP_SECRET}:${fingerprint}`)
      .digest();
  }

  _encrypt(data) {
    const key = this._deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  _decrypt(encryptedObj) {
    const key = this._deriveKey();
    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const authTag = Buffer.from(encryptedObj.authTag, 'hex');
    const encrypted = Buffer.from(encryptedObj.data, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  // ── Read / Write License ────────────────────────────────────────────────
  _readLicense() {
    if (this._licenseData) return this._licenseData;
    if (!fs.existsSync(this.licensePath)) return null;

    try {
      const raw = fs.readFileSync(this.licensePath, 'utf8');
      const encryptedObj = JSON.parse(raw);
      this._licenseData = this._decrypt(encryptedObj);
      return this._licenseData;
    } catch (err) {
      console.error('[License] Failed to read license:', err.message);
      return null;
    }
  }

  _writeLicense(data) {
    const encryptedObj = this._encrypt(data);
    // Ensure directory exists
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }
    fs.writeFileSync(this.licensePath, JSON.stringify(encryptedObj, null, 2));
    this._licenseData = data;
  }

  // ── Validation ──────────────────────────────────────────────────────────
  validate() {
    const license = this._readLicense();
    if (!license) return false;

    // Check expiry
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      console.warn('[License] License expired');
      return false;
    }

    // Check hardware fingerprint matches
    const { fingerprint } = this.getHardwareId();
    if (license.hardwareFingerprint !== fingerprint) {
      console.warn('[License] Hardware fingerprint mismatch');
      return false;
    }

    return true;
  }

  // ── Activation ──────────────────────────────────────────────────────────
  async activate(licenseKey) {
    // Validate key format: UAIP-XXXX-XXXX-XXXX-XXXX or UAIR-... or UAIU-...
    const keyPattern = /^UAI[PRU]-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyPattern.test(licenseKey)) {
      return { success: false, error: 'Invalid license key format' };
    }

    const { fingerprint, displayId } = this.getHardwareId();
    const tier = licenseKey.startsWith('UAIP') ? 'personal'
      : licenseKey.startsWith('UAIR') ? 'professional'
      : 'university';

    // In production, this would call the license server:
    // POST https://api.ultimateai.id/activate { key, fingerprint }
    // For now, we do offline activation (accept any valid-format key)

    const licenseData = {
      licenseKey,
      tier,
      hardwareFingerprint: fingerprint,
      hardwareDisplayId: displayId,
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      maxProjects: tier === 'personal' ? 50 : tier === 'professional' ? -1 : -1,
      aiQuota: {
        monthlyRequests: tier === 'personal' ? 5000 : tier === 'professional' ? 20000 : 100000,
        used: 0,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      },
      features: ['research-builder', 'blueprint-gen', 'artifact-gen', 'export'],
    };

    this._writeLicense(licenseData);
    return { success: true, tier, displayId };
  }

  // ── Info ─────────────────────────────────────────────────────────────────
  getInfo() {
    const license = this._readLicense();
    if (!license) return null;
    return {
      tier: license.tier,
      activatedAt: license.activatedAt,
      expiresAt: license.expiresAt,
      maxProjects: license.maxProjects,
      aiQuota: license.aiQuota,
      hardwareDisplayId: license.hardwareDisplayId,
    };
  }
}

module.exports = { LicenseManager };
