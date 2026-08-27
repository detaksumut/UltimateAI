/**
 * MemoryAdapter.js
 * Pluggable adapter layer connecting ConversationEngine to underlying MemoryStore.
 * Easily migratable from LocalStorage -> Remote Database -> Vector Store.
 */

import { memoryStoreInstance, MEMORY_CATEGORIES } from './MemoryStore.js';

export class MemoryAdapter {
  constructor() {
    this.store = memoryStoreInstance;
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
    return this.store.addMemory({ key, value, category });
  }

  search(query) {
    return this.store.searchMemories(query);
  }

  deleteFact(id) {
    this.store.deleteMemory(id);
  }

  togglePin(id) {
    this.store.togglePin(id);
  }

  clearSession() {
    this.store.clearSession();
  }
}

export const memoryAdapterInstance = new MemoryAdapter();
export default memoryAdapterInstance;
