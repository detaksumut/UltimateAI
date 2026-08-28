/**
 * AntigravityConnectionStore.mjs
 * Persistent Storage for UltimateAI Antigravity Connections.
 * Manages storage/antigravity_connections.json for non-sensitive connection metadata.
 * Uses AntigravityVault to encrypt/decrypt sensitive OAuth tokens.
 * Zero plaintext token exposure.
 */

import fs from 'fs';
import path from 'path';
import { antigravityVaultInstance } from './AntigravityVault.mjs';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const CONNECTIONS_FILE = path.join(STORAGE_DIR, 'antigravity_connections.json');

export class AntigravityConnectionStore {
  constructor(vault = antigravityVaultInstance) {
    this.vault = vault;
    this._ensureStorageDirectory();
  }

  _ensureStorageDirectory() {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONNECTIONS_FILE)) {
      fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  /**
   * Checks if a credential token is a fixture / synthetic mock string
   */
  static isSyntheticOrFixtureCredential(tokenStr) {
    if (!tokenStr || typeof tokenStr !== 'string') return true;
    const syntheticPatterns = [
      'valid_oauth_access_token_',
      'valid_oauth_refresh_token_',
      'refreshed_access_token',
      'test_secret_key',
      'ya29.auth_token_',
      '1//refresh_token_',
      'mock_',
      'dummy_',
      'test_token',
      'fake_token'
    ];
    return syntheticPatterns.some(pat => tokenStr.includes(pat));
  }

  /**
   * Retrieves all connection records (with decrypted secrets for internal runtime use)
   * @param {boolean} maskSecrets - If true, strips all credentials for public/API exposure
   */
  getAllConnections(maskSecrets = false) {
    try {
      this._ensureStorageDirectory();
      const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      const records = JSON.parse(raw || '[]');

      return records
        .map(record => {
          let decryptedAccessToken = '';
          let decryptedRefreshToken = '';
          try {
            if (record.encryptedAccessToken) decryptedAccessToken = this.vault.decrypt(record.encryptedAccessToken);
          } catch {}
          try {
            if (record.encryptedRefreshToken) decryptedRefreshToken = this.vault.decrypt(record.encryptedRefreshToken);
          } catch {}

          const isSynthetic = AntigravityConnectionStore.isSyntheticOrFixtureCredential(decryptedAccessToken)
            && AntigravityConnectionStore.isSyntheticOrFixtureCredential(decryptedRefreshToken);

          // If credential is a synthetic fixture, reject it from production runtime
          if (isSynthetic) {
            return null;
          }

          const hasValidAccess = Boolean(decryptedAccessToken && !AntigravityConnectionStore.isSyntheticOrFixtureCredential(decryptedAccessToken));
          const hasValidRefresh = Boolean(decryptedRefreshToken && !AntigravityConnectionStore.isSyntheticOrFixtureCredential(decryptedRefreshToken));

          if (maskSecrets) {
            const { encryptedAccessToken, encryptedRefreshToken, ...safeMetadata } = record;
            return {
              ...safeMetadata,
              hasAccessToken: hasValidAccess,
              hasRefreshToken: hasValidRefresh
            };
          }

          return {
            ...record,
            hasAccessToken: hasValidAccess,
            hasRefreshToken: hasValidRefresh,
            accessToken: decryptedAccessToken,
            refreshToken: decryptedRefreshToken
          };
        })
        .filter(Boolean);
    } catch (err) {
      return [];
    }
  }

  /**
   * Retrieves single connection by ID
   */
  getConnection(connectionId, maskSecrets = false) {
    const connections = this.getAllConnections(maskSecrets);
    return connections.find(c => c.id === connectionId || c.connectionId === connectionId) || null;
  }

  /**
   * Saves or updates a connection record
   */
  saveConnection(connectionData) {
    this._ensureStorageDirectory();
    const records = this._readRawRecords();
    const id = connectionData.id || connectionData.connectionId;

    const existingIndex = records.findIndex(r => r.id === id || r.connectionId === id);

    // Encrypt sensitive tokens
    const recordToStore = {
      id,
      connectionId: id,
      accountAlias: connectionData.accountAlias || connectionData.email || null,
      email: connectionData.email || connectionData.accountAlias || null,
      userName: connectionData.userName || null,
      label: connectionData.label || `Slot ${id.toUpperCase()}`,
      provider: 'ANTIGRAVITY',
      authType: 'oauth',
      isActive: connectionData.isActive !== false,
      priority: connectionData.priority || 1,
      projectId: connectionData.projectId || '',
      projectTier: connectionData.projectTier || 'STANDARD',
      expiresAt: connectionData.expiresAt || null,
      testStatus: connectionData.testStatus || 'INITIALIZED',
      cooldownUntil: connectionData.cooldownUntil || null,
      encryptedAccessToken: connectionData.accessToken ? this.vault.encrypt(connectionData.accessToken) : (existingIndex >= 0 ? records[existingIndex].encryptedAccessToken : ''),
      encryptedRefreshToken: connectionData.refreshToken ? this.vault.encrypt(connectionData.refreshToken) : (existingIndex >= 0 ? records[existingIndex].encryptedRefreshToken : ''),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      records[existingIndex] = { ...records[existingIndex], ...recordToStore };
    } else {
      records.push(recordToStore);
    }

    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(records, null, 2), 'utf8');
    return this.getConnection(id);
  }

  /**
   * Safe non-secret diagnostic metadata
   */
  getStoragePath() {
    return CONNECTIONS_FILE;
  }

  getDiagnosticInfo() {
    return {
      storagePath: CONNECTIONS_FILE,
      vault: this.vault?.getDiagnosticInfo ? this.vault.getDiagnosticInfo() : null
    };
  }

  /**
   * Deletes a connection record by ID
   */
  deleteConnection(connectionId) {
    this._ensureStorageDirectory();
    const records = this._readRawRecords();
    const filtered = records.filter(r => r.id !== connectionId && r.connectionId !== connectionId);
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
  }

  /**
   * Overwrites entire connections array
   */
  saveConnections(records) {
    this._ensureStorageDirectory();
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(records || [], null, 2), 'utf8');
  }

  /**
   * Updates operational status / cooldown for connection
   */
  updateStatus(connectionId, { testStatus, cooldownUntil = null }) {
    const records = this._readRawRecords();
    const index = records.findIndex(r => r.id === connectionId);
    if (index >= 0) {
      if (testStatus) records[index].testStatus = testStatus;
      if (cooldownUntil !== undefined) records[index].cooldownUntil = cooldownUntil;
      records[index].updatedAt = new Date().toISOString();
      fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(records, null, 2), 'utf8');
    }
  }

  _readRawRecords() {
    try {
      this._ensureStorageDirectory();
      const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    } catch {
      return [];
    }
  }
}

export const antigravityConnectionStoreInstance = new AntigravityConnectionStore();
export default antigravityConnectionStoreInstance;
