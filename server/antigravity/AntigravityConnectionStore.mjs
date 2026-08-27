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
   * Retrieves all connection records (with decrypted secrets for internal runtime use)
   * @param {boolean} maskSecrets - If true, strips all credentials for public/API exposure
   */
  getAllConnections(maskSecrets = false) {
    try {
      this._ensureStorageDirectory();
      const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      const records = JSON.parse(raw || '[]');

      return records.map(record => {
        if (maskSecrets) {
          const { encryptedAccessToken, encryptedRefreshToken, ...safeMetadata } = record;
          return {
            ...safeMetadata,
            hasAccessToken: Boolean(encryptedAccessToken),
            hasRefreshToken: Boolean(encryptedRefreshToken)
          };
        }

        return {
          ...record,
          accessToken: record.encryptedAccessToken ? this.vault.decrypt(record.encryptedAccessToken) : '',
          refreshToken: record.encryptedRefreshToken ? this.vault.decrypt(record.encryptedRefreshToken) : ''
        };
      });
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

    const existingIndex = records.findIndex(r => r.id === id);

    // Encrypt sensitive tokens
    const recordToStore = {
      id,
      connectionId: id,
      accountAlias: connectionData.accountAlias || `antigravity-${id.replace('ag-', '')}`,
      label: connectionData.label || `Antigravity Connection ${id}`,
      provider: 'ANTIGRAVITY',
      authType: 'oauth',
      isActive: connectionData.isActive !== false,
      priority: connectionData.priority || 1,
      projectId: connectionData.projectId || '',
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
