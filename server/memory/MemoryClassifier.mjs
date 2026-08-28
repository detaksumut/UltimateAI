/**
 * MemoryClassifier.mjs
 * Phase 8 / Active Memory Core: Contextual Classifier & Standard Memory Schema Formatter.
 * 
 * Standardized Schema:
 * {
 *   "id": "mem_...",
 *   "timestamp": "ISO_STRING",
 *   "category": "IDENTITY_CORE | SYSTEM_CONFIG | RESEARCH_DATA | OPERATIONAL_RULE | USER_PREFERENCE | GENERAL_FACT | ...",
 *   "priority": "CRITICAL | HIGH | MEDIUM | LOW",
 *   "tags": ["..."],
 *   "content": "...",
 *   "source": { "provenance": "...", "sourceTool": "..." },
 *   "confidence": 0.95,
 *   "status": "ACTIVE",
 *   "updatedAt": "ISO_STRING"
 * }
 */

export const MEMORY_CATEGORIES = {
  IDENTITY_CORE: 'IDENTITY_CORE',       // Core JIN persona and self-definition
  SYSTEM_CONFIG: 'SYSTEM_CONFIG',       // Operating environment, hardware, local endpoints
  OPERATIONAL_RULE: 'OPERATIONAL_RULE', // User constraints, policy directives ("jangan pakai internet")
  RESEARCH_DATA: 'RESEARCH_DATA',       // Verified facts from web.fetch, papers, or threat feeds
  USER_PREFERENCE: 'USER_PREFERENCE',   // Operator habits, formatting preferences, voice settings
  GENERAL_FACT: 'GENERAL_FACT',         // Generic facts & entity knowledge
  EPISODIC_SUMMARY: 'EPISODIC_SUMMARY'  // Multi-turn interaction recaps
};

export const MEMORY_PRIORITIES = {
  CRITICAL: 'CRITICAL', // System invariants, security directives, core policies
  HIGH: 'HIGH',         // User persistent preferences, key project definitions
  MEDIUM: 'MEDIUM',     // Verified research findings, general domain knowledge
  LOW: 'LOW'            // Ephemeral notes, session-specific context
};

export class MemoryClassifier {
  /**
   * Formats and contextually classifies raw memory inputs into the standard schema
   */
  static classify({
    id = null,
    key = '',
    content = '',
    category = null,
    priority = null,
    tags = [],
    source = {},
    confidence = 0.95,
    status = 'ACTIVE'
  }) {
    const rawText = `${key} ${content}`.toLowerCase();
    const now = new Date().toISOString();

    // 1. Automatic Category Inference if not explicitly assigned
    let finalCategory = category;
    if (!finalCategory) {
      if (/identitas|identity|jin|siapa kamu|siapa anda|persona/i.test(rawText)) {
        finalCategory = MEMORY_CATEGORIES.IDENTITY_CORE;
      } else if (/config|port|host|drive f|path|endpoint|server|koneksi/i.test(rawText)) {
        finalCategory = MEMORY_CATEGORIES.SYSTEM_CONFIG;
      } else if (/aturan|rule|jangan|wajib|harus|kebijakan|doktrin|policy|larangan/i.test(rawText)) {
        finalCategory = MEMORY_CATEGORIES.OPERATIONAL_RULE;
      } else if (/riset|penelitian|analisis|data|laporan|cve|vulnerab|keuangan|market/i.test(rawText)) {
        finalCategory = MEMORY_CATEGORIES.RESEARCH_DATA;
      } else if (/preferensi|suka|gaya|format|operator|nama saya|panggil saya/i.test(rawText)) {
        finalCategory = MEMORY_CATEGORIES.USER_PREFERENCE;
      } else {
        finalCategory = MEMORY_CATEGORIES.GENERAL_FACT;
      }
    }

    // 2. Automatic Priority Assignment
    let finalPriority = priority;
    if (!finalPriority) {
      if (finalCategory === MEMORY_CATEGORIES.IDENTITY_CORE || finalCategory === MEMORY_CATEGORIES.OPERATIONAL_RULE) {
        finalPriority = MEMORY_PRIORITIES.HIGH;
        if (/kritis|security|keamanan|dilarang keras|rahasia|vault/i.test(rawText)) {
          finalPriority = MEMORY_PRIORITIES.CRITICAL;
        }
      } else if (finalCategory === MEMORY_CATEGORIES.USER_PREFERENCE || finalCategory === MEMORY_CATEGORIES.SYSTEM_CONFIG) {
        finalPriority = MEMORY_PRIORITIES.HIGH;
      } else if (finalCategory === MEMORY_CATEGORIES.RESEARCH_DATA) {
        finalPriority = MEMORY_PRIORITIES.MEDIUM;
      } else {
        finalPriority = MEMORY_PRIORITIES.LOW;
      }
    }

    // 3. Automatic Tag Generation
    const extractedTags = new Set(Array.isArray(tags) ? tags : []);
    extractedTags.add(finalCategory.toLowerCase());

    const keywords = rawText.match(/[a-zA-Z0-9_\-]{4,}/g) || [];
    for (const kw of keywords.slice(0, 6)) {
      if (!['yang', 'pada', 'dari', 'untuk', 'dengan', 'dalam', 'adalah'].includes(kw)) {
        extractedTags.add(kw);
      }
    }

    const memoryId = id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return {
      id: memoryId,
      key: key || finalCategory.toLowerCase(),
      timestamp: now,
      category: finalCategory,
      priority: finalPriority,
      tags: Array.from(extractedTags),
      content: content.trim(),
      source: typeof source === 'object' ? { provenance: 'USER_EXPLICIT_STORE', sourceTool: 'active_memory_core', ...source } : { provenance: String(source) },
      confidence: Math.min(Math.max(confidence, 0.0), 1.0),
      status,
      updatedAt: now
    };
  }
}

export default MemoryClassifier;
