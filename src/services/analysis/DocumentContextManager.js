/**
 * DocumentContextManager.js
 * Ingestion and context management for documents analyzed by UltimateAI 9Router.
 */

import { conversationEngineInstance } from '../conversation/ConversationEngine.js';

export class DocumentContextManager {
  constructor() {
    this.activeDocuments = [];
    this.listeners = new Set();
  }

  addDocument(docData) {
    const doc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      fileName: docData.fileName,
      type: docData.type,
      size: docData.size,
      content: docData.content,
      preview: docData.preview,
      dataUrl: docData.dataUrl || null,
      uploadedAt: new Date().toISOString()
    };

    this.activeDocuments.push(doc);
    this.notify();

    // Augment Conversation Context directly
    conversationEngineInstance.addMessage('system', `[DOCUMENT ATTACHED: ${doc.fileName} (${doc.type})]\nPreview: ${doc.preview}\n\nContent:\n${doc.content.substring(0, 4000)}`);

    return doc;
  }

  getDocuments() {
    return [...this.activeDocuments];
  }

  removeDocument(id) {
    this.activeDocuments = this.activeDocuments.filter(d => d.id !== id);
    this.notify();
  }

  clearDocuments() {
    this.activeDocuments = [];
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getDocuments());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const docs = this.getDocuments();
    this.listeners.forEach(cb => cb(docs));
  }
}

export const documentContextManagerInstance = new DocumentContextManager();
export default documentContextManagerInstance;
