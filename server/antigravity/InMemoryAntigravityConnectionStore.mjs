/**
 * InMemoryAntigravityConnectionStore.mjs
 * Pure in-memory connection store for isolated test suites and simulations.
 * Implements the exact same interface as AntigravityConnectionStore without writing to disk.
 */

import { AntigravityVault } from './AntigravityVault.mjs';

export class InMemoryAntigravityConnectionStore {
  constructor(vault = new AntigravityVault('test_in_memory_master_key')) {
    this.vault = vault;
    this.connections = new Map();
  }

  getAllConnections(includeSecrets = false) {
    const list = Array.from(this.connections.values());
    if (includeSecrets) {
      return list.map(c => this._hydrateSecrets(c));
    }
    return list.map(c => this._maskSecrets(c));
  }

  getConnection(id, includeSecrets = false) {
    const conn = this.connections.get(id);
    if (!conn) return null;
    return includeSecrets ? this._hydrateSecrets(conn) : this._maskSecrets(conn);
  }

  saveConnection(connectionData) {
    const id = connectionData.id || connectionData.connectionId;
    if (!id) throw new Error('Connection must have an id or connectionId');

    const existing = this.connections.get(id) || {};
    const updated = {
      ...existing,
      ...connectionData,
      id,
      connectionId: id,
      updatedAt: new Date().toISOString()
    };

    if (connectionData.accessToken) {
      updated.encryptedAccessToken = this.vault.encrypt(connectionData.accessToken);
      delete updated.accessToken;
    }

    if (connectionData.refreshToken) {
      updated.encryptedRefreshToken = this.vault.encrypt(connectionData.refreshToken);
      delete updated.refreshToken;
    }

    this.connections.set(id, updated);
    return this.getConnection(id, false);
  }

  updateStatus(id, statusOrDetails, details = {}) {
    const conn = this.connections.get(id);
    if (!conn) return null;

    let testStatus = null;
    let cooldownUntil = null;
    let extra = {};

    if (typeof statusOrDetails === 'object' && statusOrDetails !== null) {
      testStatus = statusOrDetails.testStatus;
      cooldownUntil = statusOrDetails.cooldownUntil;
      extra = statusOrDetails;
    } else {
      testStatus = statusOrDetails;
      cooldownUntil = details.cooldownUntil;
      extra = details;
    }

    if (testStatus) conn.testStatus = testStatus;
    if (cooldownUntil !== undefined) conn.cooldownUntil = cooldownUntil;
    conn.lastTestedAt = new Date().toISOString();
    if (extra.error) conn.lastError = extra.error;
    if (extra.projectId) conn.projectId = extra.projectId;
    if (extra.projectTier) conn.projectTier = extra.projectTier;

    this.connections.set(id, conn);
    return this.getConnection(id, false);
  }

  deleteConnection(id) {
    return this.connections.delete(id);
  }

  _maskSecrets(conn) {
    const copy = { ...conn };
    delete copy.encryptedAccessToken;
    delete copy.encryptedRefreshToken;
    delete copy.accessToken;
    delete copy.refreshToken;
    copy.hasAccessToken = Boolean(conn.encryptedAccessToken || conn.accessToken);
    copy.hasRefreshToken = Boolean(conn.encryptedRefreshToken || conn.refreshToken);
    return copy;
  }

  _hydrateSecrets(conn) {
    const copy = { ...conn };
    if (conn.encryptedAccessToken) {
      copy.accessToken = this.vault.decrypt(conn.encryptedAccessToken);
    }
    if (conn.encryptedRefreshToken) {
      copy.refreshToken = this.vault.decrypt(conn.encryptedRefreshToken);
    }
    return copy;
  }
}

export const inMemoryAntigravityConnectionStoreInstance = new InMemoryAntigravityConnectionStore();
export default inMemoryAntigravityConnectionStoreInstance;
