/**
 * ContextManager.js
 * Tracks active context, user intent, domain focus, and operational variables.
 */

export class ContextManager {
  constructor() {
    this.context = {
      userRole: 'Enterprise Admin',
      activeDomain: 'Research & Intelligence',
      currentIntent: 'GENERAL_INQUIRY',
      activeTopic: 'JIN Assistant Core',
      entities: {},
      lastInteractionTime: new Date()
    };
    this.listeners = new Set();
  }

  getContext() {
    return { ...this.context };
  }

  updateContext(partial) {
    this.context = {
      ...this.context,
      ...partial,
      lastInteractionTime: new Date()
    };
    this.notify();
  }

  detectIntent(input) {
    const text = input.toLowerCase();
    let intent = 'GENERAL_CONVERSATION';

    if (text.includes('buat') || text.includes('build') || text.includes('create') || text.includes('aplikasi') || text.includes('app')) {
      intent = 'APP_GENERATION';
    } else if (text.includes('cari') || text.includes('search') || text.includes('google') || text.includes('global')) {
      intent = 'GLOBAL_SEARCH';
    } else if (text.includes('analisis') || text.includes('analyze') || text.includes('hitung') || text.includes('data')) {
      intent = 'DATA_ANALYSIS';
    } else if (text.includes('ingat') || text.includes('simpan') || text.includes('vault') || text.includes('memory')) {
      intent = 'MEMORY_VAULT';
    }

    this.updateContext({ currentIntent: intent });
    return intent;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.getContext()));
  }
}

export const contextManagerInstance = new ContextManager();
export default contextManagerInstance;
