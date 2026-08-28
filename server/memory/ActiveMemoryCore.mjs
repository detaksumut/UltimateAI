/**
 * ActiveMemoryCore.mjs
 * Phase 8 / Active Memory Core: Central Autonomous Active Memory Authority for JIN.
 * 
 * ARCHITECTURE PRINCIPLES:
 *  - MemoryVault JSON on Drive F: is the canonical backing store.
 *  - SQLite is an index, FileWatcher is an event source, KnowledgeGraph is the semantic retrieval layer.
 *  - Standardized Schema + Contextual Auto-Classification + Zero Secret Leakage.
 */

import path from 'path';
import fs from 'fs';
import { memoryVaultEngineInstance } from './MemoryVaultEngine.mjs';
import { memoryIndexSQLiteInstance } from './MemoryIndexSQLite.mjs';
import { memoryGraphInstance } from './MemoryGraph.mjs';
import { MemoryClassifier, MEMORY_CATEGORIES, MEMORY_PRIORITIES } from './MemoryClassifier.mjs';
import { localDriveFStorageInstance } from './LocalDriveFStorage.mjs';
import { memoryBackupServiceInstance } from './MemoryBackupService.mjs';
import { memoryCoreHealthCheckInstance } from './MemoryCoreHealthCheck.mjs';

export class ActiveMemoryCore {
  constructor(basePath = 'F:\\UltimateAI_Memory') {
    this.basePath = basePath;
    this.vaultDir = path.join(basePath, '05_Vault');
    this.stateDir = path.join(basePath, '03_AgentState');
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(this.basePath)) {
        if (!fs.existsSync(this.vaultDir)) fs.mkdirSync(this.vaultDir, { recursive: true });
        if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });

        // Auto-rebuild index if fresh or empty
        const stats = memoryIndexSQLiteInstance.getStats();
        if (stats.isOnline && stats.totalRecords === 0) {
          memoryIndexSQLiteInstance.rebuildIndex(this.vaultDir);
        }
      }
    } catch (_) {}
  }

  /**
   * STORE: Auto-classifies and stores memory into Vault + SQLite Index + Knowledge Graph
   */
  store({ key, content, category = null, priority = null, tags = [], source = {}, confidence = 0.95 }) {
    if (!content || !content.trim()) {
      throw new Error('MEMORY_EMPTY: Memory content cannot be empty.');
    }

    // 1. Contextual Classification into Standard Schema
    const classified = MemoryClassifier.classify({
      key,
      content,
      category,
      priority,
      tags,
      source,
      confidence
    });

    // 2. Persist Canonical JSON to 05_Vault on Drive F:
    const fileName = `${classified.id}.json`;
    const fullPath = path.join(this.vaultDir, fileName);

    try {
      if (fs.existsSync(this.vaultDir)) {
        fs.writeFileSync(fullPath, JSON.stringify(classified, null, 2), 'utf-8');
      }
    } catch (_) {}

    // Also mirror to in-memory vault engine
    memoryVaultEngineInstance.storeMemory({
      key: classified.key,
      content: classified.content,
      tier: classified.category,
      confidence: classified.confidence,
      provenance: classified.source.provenance
    });

    // 3. Upsert into SQLite Index
    memoryIndexSQLiteInstance.upsert(classified, fullPath);

    // 4. Record into Knowledge Graph
    memoryGraphInstance.recordFact({
      entityId: classified.id,
      claim: classified.content,
      source: classified.source.provenance,
      confidence: classified.confidence
    });

    // 5. Audit Log
    localDriveFStorageInstance.appendLog('vault_operations.log', `STORE: id="${classified.id}" cat="${classified.category}" prio="${classified.priority}"`);

    return classified;
  }

  /**
   * QUERY: Fast indexed retrieval with multi-factor ranking
   */
  query({
    queryText = '',
    category = null,
    priority = null,
    minConfidence = 0.4,
    limit = 5,
    includeInactive = false
  } = {}) {
    // 1. Fast SQLite Index Query
    const stats = memoryIndexSQLiteInstance.getStats();
    if (stats.isOnline) {
      return memoryIndexSQLiteInstance.query({
        queryText,
        category,
        priority,
        minConfidence,
        limit,
        includeInactive
      });
    }

    // 2. Fallback to MemoryVault in-memory linear query only if SQLite is offline
    return memoryVaultEngineInstance.queryMemories(queryText, limit, minConfidence);
  }

  /**
   * UPDATE: Updates existing memory while preserving timestamp & history
   */
  update(memoryId, updates = {}) {
    if (!memoryId) throw new Error('MEMORY_ID_REQUIRED');

    const filePath = path.join(this.vaultDir, `${memoryId}.json`);
    let existing = null;

    if (fs.existsSync(filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (_) {}
    }

    if (!existing) {
      throw new Error(`MEMORY_NOT_FOUND: Record ${memoryId} not found in vault.`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      timestamp: existing.timestamp, // Original creation
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    memoryIndexSQLiteInstance.upsert(updated, filePath);
    localDriveFStorageInstance.appendLog('vault_operations.log', `UPDATE: id="${memoryId}"`);

    return updated;
  }

  /**
   * INVALIDATE: Soft-deactivates memory without destroying provenance/audit history
   */
  invalidate(memoryId, reason = 'SUPERSEDED_OR_USER_REQUEST') {
    return this.update(memoryId, {
      status: 'INVALIDATED',
      invalidationReason: reason,
      invalidatedAt: new Date().toISOString()
    });
  }

  /**
   * DELETE: Removes from Vault and SQLite index
   */
  delete(memoryId) {
    if (!memoryId) return false;

    const filePath = path.join(this.vaultDir, `${memoryId}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_) {}

    memoryIndexSQLiteInstance.delete(memoryId);
    localDriveFStorageInstance.appendLog('vault_operations.log', `DELETE: id="${memoryId}"`);
    return true;
  }

  /**
   * SNAPSHOT: Persists current active task state without leaking secrets
   */
  snapshotActiveState({
    taskId = null,
    goal = '',
    currentStep = null,
    planHash = null,
    activeMemoryRefs = [],
    activeTools = [],
    selectedPool = 'POOL_HYBRID',
    selectedModel = 'gemini-3.6-flash-high'
  } = {}) {
    const snapshot = {
      taskId: taskId || `task_${Date.now()}`,
      goal,
      currentStep,
      planHash,
      activeMemoryRefs,
      activeTools,
      selectedPool,
      selectedModel,
      lastUpdate: new Date().toISOString()
    };

    const targetPath = path.join(this.stateDir, 'active_state.json');
    try {
      if (fs.existsSync(this.stateDir)) {
        fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      }
    } catch (_) {}

    return snapshot;
  }

  rebuildIndex() {
    return memoryIndexSQLiteInstance.rebuildIndex(this.vaultDir);
  }

  verifyIndex() {
    return memoryIndexSQLiteInstance.verifyIndex(this.vaultDir);
  }

  backup(options = {}) {
    return memoryBackupServiceInstance.performBackup(options);
  }

  rotateLogs() {
    return memoryBackupServiceInstance.rotateLogs();
  }

  async healthCheck() {
    return memoryCoreHealthCheckInstance.runDiagnostics();
  }
}

export const activeMemoryCoreInstance = new ActiveMemoryCore();
export default activeMemoryCoreInstance;
