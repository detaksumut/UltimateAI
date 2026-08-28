/**
 * MemoryVaultTool.mjs
 * PHASE 7 - Tool Contract for JIN Memory Vault Operations.
 * Actions: QUERY, STORE, DELETE, LIST
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { memoryVaultEngineInstance, MEMORY_TIERS } from '../memory/MemoryVaultEngine.mjs';
import { localDriveFStorageInstance } from '../memory/LocalDriveFStorage.mjs';

export class MemoryVaultTool extends ToolContract {
  constructor() {
    super({
      name: 'memory.vault',
      version: '2.0.0',
      description: 'Stores, retrieves, searches, and manages persistent semantic and episodic memories for JIN.',
      inputSchema: { action: 'string', query: 'string', key: 'string', content: 'string', id: 'string', tier: 'string' },
      outputSchema: { status: 'string', result: 'any', memories: 'array' },
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
      timeoutMs: 5000
    });
  }

  async execute({ action = 'QUERY', query = '', key = '', content = '', id = '', tier = MEMORY_TIERS.LONG_TERM }, signal = null) {
    const startTime = Date.now();
    const act = action.toUpperCase();

    if (act === 'STORE') {
      if (!content || !content.trim()) {
        throw new Error('Memory content cannot be empty.');
      }
      const stored = memoryVaultEngineInstance.storeMemory({
        key: key || 'user_note',
        content,
        tier: MEMORY_TIERS[tier] || MEMORY_TIERS.LONG_TERM,
        confidence: 0.95,
        provenance: 'USER_EXPLICIT_STORE'
      });

      // Mirror directly to Drive F: (Local Air-Gapped Storage)
      localDriveFStorageInstance.writeRecord('05_Vault', `mem_${Date.now()}.json`, stored);
      localDriveFStorageInstance.appendLog('vault_operations.log', `STORE: key="${key || 'user_note'}" tier="${tier}"`);

      return { status: 'SUCCESS', action: 'STORE', storedMemory: stored, latencyMs: Date.now() - startTime };
    }

    if (act === 'DELETE') {
      if (!id) throw new Error('Memory ID required for deletion.');
      const deleted = memoryVaultEngineInstance.deleteMemory(id);
      return { status: deleted ? 'SUCCESS' : 'NOT_FOUND', action: 'DELETE', memoryId: id, latencyMs: Date.now() - startTime };
    }

    if (act === 'LIST') {
      const all = memoryVaultEngineInstance.getAllMemories();
      return { status: 'SUCCESS', action: 'LIST', count: all.length, memories: all, latencyMs: Date.now() - startTime };
    }

    // Default: QUERY / SEARCH
    const matched = memoryVaultEngineInstance.queryMemories(query, 5, 0.4);
    return {
      status: 'SUCCESS',
      action: 'QUERY',
      query,
      count: matched.length,
      memories: matched,
      latencyMs: Date.now() - startTime
    };
  }
}

export const memoryVaultToolInstance = new MemoryVaultTool();
export default memoryVaultToolInstance;
