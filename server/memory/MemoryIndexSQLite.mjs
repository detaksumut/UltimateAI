/**
 * MemoryIndexSQLite.mjs
 * Phase 8 / Active Memory Core: Fast SQLite Semantic Index for Persistent Memory.
 * 
 * ARCHITECTURAL RULE:
 *  - SQLite is STRICTLY AN INDEX for fast querying and ranking.
 *  - The JSON files in F:\UltimateAI_Memory\05_Vault remain the canonical source of truth.
 *  - Supports incremental indexing, upsert, delete, query with multi-factor scoring,
 *    and automatic consistency check / rebuild against disk records.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class MemoryIndexSQLite {
  constructor(dbPath = null) {
    this.primaryDbPath = dbPath || 'F:\\UltimateAI_Memory\\05_Vault\\index.sqlite';
    this.fallbackDbPath = path.resolve(process.cwd(), 'server', 'data', 'memory_index.sqlite');
    this.db = null;
    this.activePath = null;
    this.init();
  }

  init() {
    let targetPath = this.primaryDbPath;
    try {
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
    } catch (_) {
      targetPath = this.fallbackDbPath;
    }

    try {
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

      this.db = new Database(targetPath);
      this.activePath = targetPath;
      this._createSchema();
    } catch (err) {
      // Fallback to local data dir if Drive F is temporarily unavailable
      try {
        const localDir = path.dirname(this.fallbackDbPath);
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        this.db = new Database(this.fallbackDbPath);
        this.activePath = this.fallbackDbPath;
        this._createSchema();
      } catch (fallbackErr) {
        console.error('[MemoryIndexSQLite] Failed to initialize SQLite index:', fallbackErr.message);
      }
    }
  }

  _createSchema() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_index (
        memoryId TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        tags TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        confidence REAL DEFAULT 1.0,
        status TEXT DEFAULT 'ACTIVE',
        filePath TEXT,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mem_category ON memory_index(category);
      CREATE INDEX IF NOT EXISTS idx_mem_priority ON memory_index(priority);
      CREATE INDEX IF NOT EXISTS idx_mem_timestamp ON memory_index(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mem_status ON memory_index(status);
    `);
  }

  /**
   * Upsert a memory record into the index
   */
  upsert(memoryRecord, filePath = '') {
    if (!this.db || !memoryRecord || !memoryRecord.id) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO memory_index (
          memoryId, timestamp, category, priority, tags, content, source, confidence, status, filePath, updatedAt
        ) VALUES (
          @memoryId, @timestamp, @category, @priority, @tags, @content, @source, @confidence, @status, @filePath, @updatedAt
        )
        ON CONFLICT(memoryId) DO UPDATE SET
          timestamp = excluded.timestamp,
          category = excluded.category,
          priority = excluded.priority,
          tags = excluded.tags,
          content = excluded.content,
          source = excluded.source,
          confidence = excluded.confidence,
          status = excluded.status,
          filePath = excluded.filePath,
          updatedAt = excluded.updatedAt
      `);

      const tagsJson = Array.isArray(memoryRecord.tags) ? JSON.stringify(memoryRecord.tags) : JSON.stringify([]);
      const sourceJson = typeof memoryRecord.source === 'object' ? JSON.stringify(memoryRecord.source) : String(memoryRecord.source || '');

      stmt.run({
        memoryId: memoryRecord.id,
        timestamp: memoryRecord.timestamp || memoryRecord.createdAt || new Date().toISOString(),
        category: memoryRecord.category || 'GENERAL_FACT',
        priority: memoryRecord.priority || 'MEDIUM',
        tags: tagsJson,
        content: memoryRecord.content || '',
        source: sourceJson,
        confidence: memoryRecord.confidence ?? 1.0,
        status: memoryRecord.status || 'ACTIVE',
        filePath: filePath || memoryRecord.filePath || '',
        updatedAt: memoryRecord.updatedAt || new Date().toISOString()
      });

      return true;
    } catch (err) {
      console.warn(`[MemoryIndexSQLite] Upsert failed for ${memoryRecord.id}:`, err.message);
      return false;
    }
  }

  /**
   * Remove a memory from index
   */
  delete(memoryId) {
    if (!this.db || !memoryId) return false;
    try {
      const stmt = this.db.prepare('DELETE FROM memory_index WHERE memoryId = ?');
      const info = stmt.run(memoryId);
      return info.changes > 0;
    } catch (err) {
      return false;
    }
  }

  /**
   * Search indexed memories with multi-factor ranking:
   *  - Semantic / keyword match
   *  - Priority weight (CRITICAL: 4x, HIGH: 3x, MEDIUM: 2x, LOW: 1x)
   *  - Recency decay
   *  - Category filter
   */
  query({
    queryText = '',
    category = null,
    priority = null,
    minConfidence = 0.4,
    limit = 5,
    includeInactive = false
  } = {}) {
    if (!this.db) return [];

    try {
      let baseSql = `SELECT * FROM memory_index WHERE confidence >= ?`;
      const params = [minConfidence];

      if (!includeInactive) {
        baseSql += ` AND status = 'ACTIVE'`;
      }

      if (category) {
        baseSql += ` AND category = ?`;
        params.push(category);
      }

      if (priority) {
        baseSql += ` AND priority = ?`;
        params.push(priority);
      }

      const rows = this.db.prepare(baseSql).all(...params);
      if (rows.length === 0) return [];

      const keywords = (queryText || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const priorityWeights = { CRITICAL: 4.0, HIGH: 3.0, MEDIUM: 2.0, LOW: 1.0 };
      const now = Date.now();

      const scored = rows.map(row => {
        let contentScore = 0;
        const textContent = `${row.category} ${row.content} ${row.tags}`.toLowerCase();

        if (keywords.length === 0) {
          contentScore = 1.0;
        } else {
          for (const kw of keywords) {
            if (textContent.includes(kw)) {
              contentScore += 2.0;
            }
          }
        }

        // Priority boost
        const pWeight = priorityWeights[row.priority] || 1.5;

        // Recency score (decays over 30 days)
        const ageMs = Math.max(0, now - new Date(row.timestamp).getTime());
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0.2, 1.0 - (ageDays / 30));

        const finalScore = (contentScore * 3.0) + (pWeight * 2.0) + (recencyScore * 1.5) + (row.confidence * 2.0);

        return {
          ...row,
          contentScore,
          tags: JSON.parse(row.tags || '[]'),
          source: JSON.parse(row.source || '{}'),
          rankingScore: finalScore
        };
      });

      return scored
        .filter(r => keywords.length === 0 || r.contentScore > 0)
        .sort((a, b) => b.rankingScore - a.rankingScore)
        .slice(0, limit);
    } catch (err) {
      console.warn('[MemoryIndexSQLite] Query error:', err.message);
      return [];
    }
  }

  /**
   * Rebuild index from all JSON files in Vault directory
   */
  rebuildIndex(vaultDir = 'F:\\UltimateAI_Memory\\05_Vault') {
    if (!this.db) return { success: false, error: 'Database not initialized' };

    try {
      if (!fs.existsSync(vaultDir)) return { success: false, error: `Vault directory not found: ${vaultDir}` };

      // Clear existing records in index
      this.db.exec('DELETE FROM memory_index');

      const files = fs.readdirSync(vaultDir).filter(f => f.endsWith('.json'));
      let indexedCount = 0;
      let corruptCount = 0;

      for (const file of files) {
        const fullPath = path.join(vaultDir, file);
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(raw);
          if (data && data.id) {
            this.upsert(data, fullPath);
            indexedCount++;
          }
        } catch (_) {
          corruptCount++;
        }
      }

      return {
        success: true,
        totalFiles: files.length,
        indexedCount,
        corruptCount,
        indexPath: this.activePath
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Verifies consistency between SQLite index and disk JSON files
   */
  verifyIndex(vaultDir = 'F:\\UltimateAI_Memory\\05_Vault') {
    if (!this.db) return { isConsistent: false, error: 'DB_NOT_INITIALIZED' };

    try {
      if (!fs.existsSync(vaultDir)) {
        return { isConsistent: false, error: 'VAULT_DIR_NOT_FOUND', vaultDir };
      }

      const files = fs.readdirSync(vaultDir).filter(f => f.endsWith('.json'));
      const diskIds = new Set();
      const corruptedFiles = [];

      for (const file of files) {
        const fullPath = path.join(vaultDir, file);
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(raw);
          if (data && data.id) diskIds.add(data.id);
          else corruptedFiles.push(file);
        } catch (_) {
          corruptedFiles.push(file);
        }
      }

      const indexedRows = this.db.prepare('SELECT memoryId FROM memory_index').all();
      const indexedIds = new Set(indexedRows.map(r => r.memoryId));

      const missingInIndex = Array.from(diskIds).filter(id => !indexedIds.has(id));
      const orphanedInIndex = Array.from(indexedIds).filter(id => !diskIds.has(id));

      const isConsistent = missingInIndex.length === 0 && orphanedInIndex.length === 0 && corruptedFiles.length === 0;

      return {
        isConsistent,
        totalDiskFiles: files.length,
        totalIndexedRows: indexedRows.length,
        missingInIndexCount: missingInIndex.length,
        orphanedInIndexCount: orphanedInIndex.length,
        corruptedFilesCount: corruptedFiles.length,
        missingInIndex,
        orphanedInIndex,
        corruptedFiles
      };
    } catch (err) {
      return { isConsistent: false, error: err.message };
    }
  }

  /**
   * Repair inconsistencies
   */
  repairIndex(vaultDir = 'F:\\UltimateAI_Memory\\05_Vault') {
    return this.rebuildIndex(vaultDir);
  }

  getStats() {
    if (!this.db) return { totalRecords: 0, activePath: this.activePath, isOnline: false };
    try {
      const count = this.db.prepare('SELECT COUNT(*) as total FROM memory_index').get()?.total || 0;
      const categories = this.db.prepare('SELECT category, COUNT(*) as count FROM memory_index GROUP BY category').all();
      return {
        totalRecords: count,
        activePath: this.activePath,
        categories,
        isOnline: true
      };
    } catch (err) {
      return { totalRecords: 0, activePath: this.activePath, isOnline: false, error: err.message };
    }
  }
}

export const memoryIndexSQLiteInstance = new MemoryIndexSQLite();
export default memoryIndexSQLiteInstance;
