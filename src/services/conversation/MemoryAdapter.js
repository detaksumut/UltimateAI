/**
 * MemoryAdapter.js
 * Pluggable adapter layer connecting ConversationEngine to MemoryStore.
 * Bridges localStorage (fast local cache) with server-side ActiveMemoryCore (persistent SQLite vault).
 * 
 * Sync strategy:
 *  - Reads: localStorage first (instant), then merge server memories in background
 *  - Writes: write to localStorage immediately, then sync to server async
 *  - On startup: pull server memories → merge into localStorage
 */

import { memoryStoreInstance, MEMORY_CATEGORIES } from './MemoryStore.js';

export class MemoryAdapter {
  constructor() {
    this.store = memoryStoreInstance;
    this._serverSynced = false;
    this._syncQueue = [];
    this._initServerSync();
  }

  /**
   * Background sync: pull server memories into localStorage on startup
   */
  async _initServerSync() {
    try {
      const res = await fetch('/api/memory?limit=100', { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) return; // Not a JSON endpoint

      const { memories = [] } = await res.json();
      const localMemories = this.store.getMemories();
      const localIds = new Set(localMemories.map(m => m.id));

      // Merge server memories that don't exist locally
      let merged = 0;
      for (const serverMem of memories) {
        if (!localIds.has(serverMem.memoryId)) {
          this.store.addMemory({
            key: serverMem.content?.slice(0, 60) || serverMem.memoryId,
            value: serverMem.content || '',
            category: this._mapServerCategory(serverMem.category),
            isPinned: serverMem.priority === 'CRITICAL'
          });
          merged++;
        }
      }

      if (merged > 0) {
        console.log(`[MemoryAdapter] Merged ${merged} server memories into local store`);
      }

      this._serverSynced = true;

      // Process any queued sync operations
      while (this._syncQueue.length > 0) {
        const op = this._syncQueue.shift();
        await this._executeServerOp(op);
      }
    } catch (err) {
      console.warn('[MemoryAdapter] Server sync failed:', err.message);
      this._serverSynced = true; // Mark as synced anyway to unblock queue
    }
  }

  _mapServerCategory(serverCat) {
    const map = {
      'IDENTITY_CORE': MEMORY_CATEGORIES.SYSTEM,
      'SYSTEM_CONFIG': MEMORY_CATEGORIES.SYSTEM,
      'OPERATIONAL_RULE': MEMORY_CATEGORIES.USER,
      'RESEARCH_DATA': MEMORY_CATEGORIES.DOCUMENT,
      'USER_PREFERENCE': MEMORY_CATEGORIES.USER,
      'GENERAL_FACT': MEMORY_CATEGORIES.DOCUMENT,
      'EPISODIC_SUMMARY': MEMORY_CATEGORIES.SESSION
    };
    return map[serverCat] || MEMORY_CATEGORIES.USER;
  }

  async _executeServerOp(op) {
    try {
      if (op.type === 'store') {
        await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data),
          signal: AbortSignal.timeout(5000)
        });
      } else if (op.type === 'delete') {
        await fetch(`/api/memory/${op.id}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000)
        });
      }
    } catch (err) {
      console.warn(`[MemoryAdapter] Server op failed:`, err.message);
    }
  }

  _syncToServer(op) {
    if (this._serverSynced) {
      this._executeServerOp(op);
    } else {
      this._syncQueue.push(op);
    }
  }

  getFacts() {
    return this.store.getMemories().map(m => ({
      id: m.id,
      key: m.key,
      value: m.value,
      category: m.category,
      isPinned: m.isPinned
    }));
  }

  addFact(key, value, category = MEMORY_CATEGORIES.USER) {
    const local = this.store.addMemory({ key, value, category });
    // Sync to server in background
    this._syncToServer({
      type: 'store',
      data: { key, content: value, category }
    });
    return local;
  }

  search(query) {
    return this.store.searchMemories(query);
  }

  deleteFact(id) {
    this.store.deleteMemory(id);
    this._syncToServer({ type: 'delete', id });
  }

  togglePin(id) {
    this.store.togglePin(id);
  }

  clearSession() {
    this.store.clearSession();
  }

  /**
   * Force a full sync from server (e.g., after login or page refresh)
   */
  async forceSyncFromServer() {
    this._serverSynced = false;
    await this._initServerSync();
  }
}

export const memoryAdapterInstance = new MemoryAdapter();
export default memoryAdapterInstance;
