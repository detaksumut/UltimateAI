/**
 * MemoryStore.js
 * Categorized memory vault storage interface.
 * Categories: SESSION | USER | DOCUMENT | SYSTEM
 */

export const MEMORY_CATEGORIES = {
  SESSION: 'SESSION',
  USER: 'USER',
  DOCUMENT: 'DOCUMENT',
  SYSTEM: 'SYSTEM'
};

export class MemoryStore {
  constructor() {
    this.storageKey = 'ultimateai_jin_categorized_memory_v2';
    this.memories = this.loadInitialMemories();
    this.listeners = new Set();
  }

  loadInitialMemories() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) return JSON.parse(stored);
      }
    } catch {
      // LocalStorage access fallback
    }

    return [
      {
        id: 'mem_sys_1',
        category: MEMORY_CATEGORIES.SYSTEM,
        key: 'Core Intelligence Engine',
        value: 'UltimateAI 9Router (9 Active Autonomous Reasoning Engines)',
        isPinned: true,
        timestamp: new Date().toISOString()
      },
      {
        id: 'mem_user_1',
        category: MEMORY_CATEGORIES.USER,
        key: 'Primary Operator Persona',
        value: 'Rahman (Enterprise Admin, Research Architecture Domain)',
        isPinned: true,
        timestamp: new Date().toISOString()
      },
      {
        id: 'mem_sys_2',
        category: MEMORY_CATEGORIES.SYSTEM,
        key: 'Embodied Persona Interface',
        value: 'JIN (Holographic Cyber-HUD Interactive J.A.R.V.I.S layer)',
        isPinned: false,
        timestamp: new Date().toISOString()
      }
    ];
  }

  save() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.memories));
      }
    } catch {
      // Safe catch
    }
    this.notify();
  }

  getMemories(category = null) {
    if (!category) return [...this.memories];
    return this.memories.filter(m => m.category === category);
  }

  addMemory({ key, value, category = MEMORY_CATEGORIES.USER, isPinned = false }) {
    const item = {
      id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      key: key.trim(),
      value: value.trim(),
      category,
      isPinned,
      timestamp: new Date().toISOString()
    };
    this.memories.unshift(item);
    this.save();
    return item;
  }

  deleteMemory(id) {
    this.memories = this.memories.filter(m => m.id !== id);
    this.save();
  }

  togglePin(id) {
    const item = this.memories.find(m => m.id === id);
    if (item) {
      item.isPinned = !item.isPinned;
      this.save();
    }
  }

  searchMemories(query) {
    if (!query || !query.trim()) return this.getMemories();
    const q = query.toLowerCase();
    return this.memories.filter(m =>
      m.key.toLowerCase().includes(q) ||
      m.value.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  }

  clearCategory(category) {
    this.memories = this.memories.filter(m => m.category !== category);
    this.save();
  }

  clearSession() {
    this.clearCategory(MEMORY_CATEGORIES.SESSION);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getMemories());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const all = this.getMemories();
    this.listeners.forEach(cb => cb(all));
  }
}

export const memoryStoreInstance = new MemoryStore();
export default memoryStoreInstance;
