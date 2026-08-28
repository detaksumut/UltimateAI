/**
 * MemoryVaultTool.mjs
 * Phase 8 / Active Memory Core: Unified Tool Contract for Active Memory Operations.
 * 
 * Actions:
 *  - STORE: Auto-classifies into standard schema, writes to 05_Vault, updates SQLite index
 *  - QUERY: Fast multi-factor ranking search via SQLite index
 *  - UPDATE: Updates existing memory while preserving provenance
 *  - INVALIDATE: Soft-deactivates memory without destroying audit history
 *  - DELETE: Removes memory record from vault and index
 *  - REBUILD_INDEX: Reindexes all JSON records in 05_Vault
 *  - HEALTH: Runs health check diagnostics on Drive F:\ and index consistency
 *  - BACKUP: Triggers automated backup snapshot
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { activeMemoryCoreInstance } from '../memory/ActiveMemoryCore.mjs';
import { MEMORY_CATEGORIES, MEMORY_PRIORITIES } from '../memory/MemoryClassifier.mjs';

export class MemoryVaultTool extends ToolContract {
  constructor() {
    super({
      name: 'memory.vault',
      version: '3.0.0',
      description: 'Active Memory Core tool for storing, indexed querying, updating, and maintaining persistent memories on Drive F:.',
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
      timeoutMs: 8000,
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['STORE', 'QUERY', 'UPDATE', 'INVALIDATE', 'DELETE', 'REBUILD_INDEX', 'HEALTH', 'BACKUP', 'LIST'], default: 'QUERY' },
          key: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string' },
          priority: { type: 'string' },
          query: { type: 'string' },
          id: { type: 'string' },
          limit: { type: 'number', default: 5 }
        }
      }
    });
  }

  async execute({ action = 'QUERY', query = '', key = '', content = '', id = '', category = null, priority = null, limit = 5 } = {}) {
    const startTime = Date.now();
    const act = (action || 'QUERY').toUpperCase();

    // 1. STORE
    if (act === 'STORE') {
      if (!content || !content.trim()) {
        throw new Error('INVALID_ARGUMENT: Memory content cannot be empty.');
      }

      const stored = activeMemoryCoreInstance.store({
        key,
        content,
        category,
        priority,
        source: { provenance: 'USER_EXPLICIT_STORE', tool: 'memory.vault' }
      });

      return {
        status: 'SUCCESS',
        action: 'STORE',
        storedMemory: stored,
        durationMs: Date.now() - startTime
      };
    }

    // 2. UPDATE
    if (act === 'UPDATE') {
      if (!id) throw new Error('INVALID_ARGUMENT: Memory ID is required for update.');
      const updated = activeMemoryCoreInstance.update(id, { content, category, priority });
      return {
        status: 'SUCCESS',
        action: 'UPDATE',
        updatedMemory: updated,
        durationMs: Date.now() - startTime
      };
    }

    // 3. INVALIDATE
    if (act === 'INVALIDATE') {
      if (!id) throw new Error('INVALID_ARGUMENT: Memory ID is required for invalidation.');
      const invalidated = activeMemoryCoreInstance.invalidate(id);
      return {
        status: 'SUCCESS',
        action: 'INVALIDATE',
        memoryId: id,
        invalidated,
        durationMs: Date.now() - startTime
      };
    }

    // 4. DELETE
    if (act === 'DELETE') {
      if (!id) throw new Error('INVALID_ARGUMENT: Memory ID is required for deletion.');
      const deleted = activeMemoryCoreInstance.delete(id);
      return {
        status: deleted ? 'SUCCESS' : 'NOT_FOUND',
        action: 'DELETE',
        memoryId: id,
        durationMs: Date.now() - startTime
      };
    }

    // 5. REBUILD_INDEX
    if (act === 'REBUILD_INDEX') {
      const rebuildResult = activeMemoryCoreInstance.rebuildIndex();
      return {
        status: rebuildResult.success ? 'SUCCESS' : 'ERROR',
        action: 'REBUILD_INDEX',
        result: rebuildResult,
        durationMs: Date.now() - startTime
      };
    }

    // 6. HEALTH
    if (act === 'HEALTH') {
      const diagnostics = await activeMemoryCoreInstance.healthCheck();
      return {
        status: 'SUCCESS',
        action: 'HEALTH',
        diagnostics,
        durationMs: Date.now() - startTime
      };
    }

    // 7. BACKUP
    if (act === 'BACKUP') {
      const backupResult = activeMemoryCoreInstance.backup();
      return {
        status: backupResult.success ? 'SUCCESS' : 'ERROR',
        action: 'BACKUP',
        backupResult,
        durationMs: Date.now() - startTime
      };
    }

    // 8. QUERY (Default)
    const results = activeMemoryCoreInstance.query({
      queryText: query || content || key || '',
      category,
      priority,
      limit
    });

    return {
      status: 'SUCCESS',
      action: 'QUERY',
      query: query || content || key || null,
      count: results.length,
      memories: results,
      durationMs: Date.now() - startTime
    };
  }
}

export const memoryVaultToolInstance = new MemoryVaultTool();
export default memoryVaultToolInstance;
