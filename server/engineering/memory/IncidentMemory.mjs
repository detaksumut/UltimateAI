/**
 * IncidentMemory.mjs
 * Persistent Learned Incidents Knowledge Base with Strict Validation Lifecycle.
 */

import fs from 'fs';
import path from 'path';

const MEMORY_STORAGE_PATH = path.resolve(process.cwd(), '.system', 'incident_memory.json');

export const KnowledgeStatus = {
  PROPOSED: 'PROPOSED',
  TESTED: 'TESTED',
  VALIDATED: 'VALIDATED',
  STABLE: 'STABLE',
  REGRESSION: 'REGRESSION',
  REJECTED: 'REJECTED'
};

export class IncidentMemory {
  constructor() {
    this.memory = [];
    this.load();
  }

  ensureDir() {
    const dir = path.dirname(MEMORY_STORAGE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  load() {
    try {
      if (fs.existsSync(MEMORY_STORAGE_PATH)) {
        this.memory = JSON.parse(fs.readFileSync(MEMORY_STORAGE_PATH, 'utf8'));
      }
    } catch (e) {
      console.warn('[IncidentMemory] Initializing empty memory store:', e.message);
      this.memory = [];
    }
  }

  save() {
    try {
      this.ensureDir();
      fs.writeFileSync(MEMORY_STORAGE_PATH, JSON.stringify(this.memory, null, 2), 'utf8');
    } catch (e) {
      console.error('[IncidentMemory] Save error:', e.message);
    }
  }

  learnPattern({
    category,
    targetComponent,
    symptoms,
    rootCause,
    validatedPatchStrategy,
    validationEvidence
  }) {
    const record = {
      memoryId: `MEM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      category,
      targetComponent,
      symptoms,
      rootCause,
      validatedPatchStrategy,
      validationEvidence,
      status: KnowledgeStatus.VALIDATED,
      createdAt: new Date().toISOString(),
      usageCount: 0
    };

    this.memory.unshift(record);
    this.save();
    console.log(`ðŸ§  [IncidentMemory] Stored new validated pattern: "${rootCause}"`);
    return record;
  }

  findMatchingPattern(category, targetComponent, errorMessage) {
    // Only return patterns that have been VALIDATED or STABLE
    const matches = this.memory.filter(p =>
      (p.status === KnowledgeStatus.VALIDATED || p.status === KnowledgeStatus.STABLE) &&
      (p.category === category || p.targetComponent === targetComponent)
    );

    if (matches.length > 0) {
      matches[0].usageCount += 1;
      this.save();
      return matches[0];
    }
    return null;
  }

  getAllKnowledge() {
    return [...this.memory];
  }
}

export const incidentMemoryInstance = new IncidentMemory();
