/**
 * MemoryGraph.mjs
 * Phase 4C: Structured Knowledge Graph & Semantic Entity-Relation Memory Vault.
 * 
 * Features:
 *  - Entities: Person, Organization, Project, Domain, Document, Fact, Finding, Decision, Preference.
 *  - Relations: related_to, mentioned_in, derived_from, contradicts, supports, updated_by.
 *  - Provenance: timestamp, sourceTool, confidence, sourceUrl, verificationState.
 *  - Task-Relevance Semantic Search: Injects only relevant entities (not blind memory dumps).
 */

export class MemoryGraph {
  constructor() {
    this.entities = new Map(); // entityId -> { id, type, name, attributes, createdAt, updatedAt }
    this.relations = [];       // [{ id, sourceId, targetId, relationType, metadata, createdAt }]
    this.facts = [];           // [{ id, entityId, claim, evidence, confidence, source, createdAt }]

    // Seed baseline entities
    this._initializeBaseline();
  }

  _initializeBaseline() {
    this.addEntity({
      id: 'ent_jin_core',
      type: 'Project',
      name: 'UltimateAI JIN Core',
      attributes: { domain: 'autonomous_ai_platform', version: '4.0', status: 'ACTIVE' }
    });
  }

  /**
   * Adds or updates a structured entity
   */
  addEntity({ id, type, name, attributes = {}, source = 'system' }) {
    const entityId = id || `ent_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const existing = this.entities.get(entityId);
    const entity = {
      id: entityId,
      type, // 'Person' | 'Organization' | 'Project' | 'Domain' | 'Document' | 'Fact' | 'Finding' | 'Decision' | 'Preference'
      name,
      attributes: { ...(existing?.attributes || {}), ...attributes },
      source,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    this.entities.set(entityId, entity);
    return entity;
  }

  /**
   * Adds a relation between two entities
   */
  addRelation({ sourceId, targetId, relationType, metadata = {} }) {
    const relation = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId,
      targetId,
      relationType, // 'related_to' | 'mentioned_in' | 'derived_from' | 'contradicts' | 'supports' | 'updated_by'
      metadata,
      createdAt: new Date().toISOString()
    };

    this.relations.push(relation);
    return relation;
  }

  /**
   * Records a verified fact or finding with provenance
   */
  recordFact({ entityId, claim, evidence = null, source = 'agent_runtime', confidence = 1.0, relationWith = null }) {
    const factId = `fact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fact = {
      id: factId,
      entityId,
      claim,
      evidence,
      source,
      confidence,
      createdAt: new Date().toISOString()
    };

    this.facts.push(fact);

    if (relationWith) {
      this.addRelation({
        sourceId: factId,
        targetId: relationWith.targetId,
        relationType: relationWith.relationType || 'supports'
      });
    }

    return fact;
  }

  /**
   * Semantic retrieval of relevant knowledge graph subgraph for an active query/task
   */
  queryRelevantGraph(queryText = '', { maxEntities = 5, minConfidence = 0.5 } = {}) {
    const qLower = (queryText || '').toLowerCase();
    const queryTokens = qLower.split(/\s+/).filter(t => t.length > 2);

    const scoredEntities = Array.from(this.entities.values()).map(ent => {
      let score = 0;
      const nameLower = ent.name.toLowerCase();
      const attrStr = JSON.stringify(ent.attributes).toLowerCase();

      for (const token of queryTokens) {
        if (nameLower.includes(token)) score += 15;
        if (attrStr.includes(token)) score += 8;
      }

      return { ...ent, score };
    });

    // Sort by relevance score
    scoredEntities.sort((a, b) => b.score - a.score);
    const topEntities = scoredEntities.filter(e => e.score > 0 || queryTokens.length === 0).slice(0, maxEntities);
    const topEntityIds = new Set(topEntities.map(e => e.id));

    // Find connected relations
    const connectedRelations = this.relations.filter(r => 
      topEntityIds.has(r.sourceId) || topEntityIds.has(r.targetId)
    );

    // Find connected facts
    const connectedFacts = this.facts.filter(f => 
      (topEntityIds.has(f.entityId) || topEntityIds.has(f.id)) && f.confidence >= minConfidence
    );

    return {
      query: queryText,
      entities: topEntities,
      relations: connectedRelations,
      facts: connectedFacts,
      summary: topEntities.map(e => `[${e.type}] ${e.name}`).join('; ')
    };
  }

  getAllEntities() {
    return Array.from(this.entities.values());
  }

  getAllRelations() {
    return [...this.relations];
  }

  getAllFacts() {
    return [...this.facts];
  }
}

export const memoryGraphInstance = new MemoryGraph();
export default memoryGraphInstance;
