/**
 * MemoryVaultEngine.mjs
 * PHASE 7 - Multi-Tier Persistent Memory Vault & Episodic Recall Engine for JIN.
 * Tiers: Short-Term, Long-Term, Episodic, and Semantic Knowledge with Confidence & Provenance.
 */

import fs from 'fs';
import path from 'path';

export const MEMORY_TIERS = {
  SHORT_TERM: 'SHORT_TERM', // Rolling conversational buffer
  LONG_TERM: 'LONG_TERM',   // Permanent facts & preferences
  EPISODIC: 'EPISODIC',     // Interaction events & summaries
  SEMANTIC: 'SEMANTIC'      // Concepts, rules & domain definitions
};

export class MemoryVaultEngine {
  constructor(vaultPath = null) {
    this.vaultPath = vaultPath || path.resolve(process.cwd(), 'server', 'data', 'memory-vault.json');
    this.memories = [];
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.vaultPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(this.vaultPath)) {
        const raw = fs.readFileSync(this.vaultPath, 'utf-8');
        this.memories = JSON.parse(raw);
      } else {
        // Seed initial default core system memories
        this.memories = [
          {
            id: 'MEM-CORE-001',
            key: 'system_identity',
            content: 'JIN (Joint Intelligence Network) is an advanced Holographic Cyber-AI Assistant created by UltimateAI.',
            tier: MEMORY_TIERS.SEMANTIC,
            confidence: 1.0,
            provenance: 'SYSTEM_BOOTSTRAP',
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            accessCount: 1
          },
          {
            id: 'MEM-CORE-002',
            key: 'communication_style',
            content: 'Honest, precise, Cyber-HUD aesthetic, Zero Camouflage, full-duplex responsive.',
            tier: MEMORY_TIERS.LONG_TERM,
            confidence: 0.98,
            provenance: 'USER_PREFERENCE',
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            accessCount: 1
          }
        ];
        this.persist();
      }
    } catch {
      this.memories = [];
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.vaultPath, JSON.stringify(this.memories, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MEMORY VAULT] Failed to persist memories:', err.message);
    }
  }

  storeMemory({ key, content, tier = MEMORY_TIERS.LONG_TERM, confidence = 0.95, provenance = 'USER_SESSION' }) {
    const id = `MEM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newEntry = {
      id,
      key,
      content,
      tier,
      confidence: Math.min(Math.max(confidence, 0.0), 1.0),
      provenance,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      accessCount: 1
    };

    this.memories.push(newEntry);
    this.persist();
    return newEntry;
  }

  queryMemories(queryText = '', limit = 5, minConfidence = 0.5) {
    if (!queryText || !queryText.trim()) {
      return this.memories.slice(-limit);
    }

    const keywords = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const scored = this.memories
      .filter(m => m.confidence >= minConfidence)
      .map(m => {
        const text = `${m.key} ${m.content} ${m.tier}`.toLowerCase();
        let matchScore = 0;
        for (const kw of keywords) {
          if (text.includes(kw)) matchScore += 1;
        }
        return { memory: m, score: matchScore };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.memory.confidence - a.memory.confidence);

    const results = scored.slice(0, limit).map(item => {
      item.memory.lastAccessedAt = new Date().toISOString();
      item.memory.accessCount++;
      return item.memory;
    });

    this.persist();
    return results;
  }

  deleteMemory(id) {
    const initialLen = this.memories.length;
    this.memories = this.memories.filter(m => m.id !== id);
    if (this.memories.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  getAllMemories() {
    return [...this.memories];
  }
}

export const memoryVaultEngineInstance = new MemoryVaultEngine();
export default memoryVaultEngineInstance;
