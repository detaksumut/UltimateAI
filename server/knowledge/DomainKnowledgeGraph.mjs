/**
 * DomainKnowledgeGraph.mjs
 * Phase 5A: Deep Multi-Disciplinary Domain Knowledge Graph Engine.
 * 
 * Manages domain-aware entities, typed relations, claims with rich provenance,
 * and cross-domain semantic query traversal.
 */

import { DomainOntologyAdapters, DOMAINS } from './DomainOntologyAdapters.mjs';

export class DomainKnowledgeGraph {
  constructor() {
    this.entities = new Map(); // entityId -> { id, domain, entityType, name, attributes, createdAt, updatedAt }
    this.relations = [];       // [{ id, sourceId, targetId, relationType, metadata, createdAt }]
    this.claims = [];          // [{ id, claim, source, retrievedAt, domain, jurisdiction, confidence, verificationState, entityRefs }]
    this._initDomainBaselines();
  }

  _initDomainBaselines() {
    // Law Baseline
    this.registerClaim({
      claim: 'Peraturan Perlindungan Data Pribadi (UU PDP) mewajibkan pemrosesan data lokal dan persetujuan eksplisit pemilik data.',
      domain: DOMAINS.LAW_REGULATION,
      jurisdiction: 'ID',
      source: 'UU No. 27 Tahun 2022',
      confidence: 1.0,
      verificationState: 'VERIFIED'
    });

    // Finance Baseline
    this.registerClaim({
      claim: 'Return on Investment (ROI) dihitung dengan formula ((Net Profit / Cost of Investment) * 100).',
      domain: DOMAINS.FINANCE_QUANT,
      source: 'Financial Standard Metrics',
      confidence: 1.0,
      verificationState: 'VERIFIED'
    });

    // Software Baseline
    this.registerClaim({
      claim: 'LocalRouter 9Router proxy beroperasi pada port 20200 dengan 7 pool Antigravity OAuth aktif.',
      domain: DOMAINS.SOFTWARE_CLOUD,
      source: 'UltimateAI System Architecture',
      confidence: 1.0,
      verificationState: 'VERIFIED'
    });
  }

  /**
   * Registers a domain-specific entity using ontology adapter
   */
  addDomainEntity(domain, rawData = {}) {
    const adapted = DomainOntologyAdapters.adapt(domain, rawData);
    const entityId = `dent_${domain.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const entity = {
      id: entityId,
      domain: adapted.domain,
      entityType: adapted.entityType,
      name: adapted.name,
      attributes: adapted.attributes,
      createdAt: now,
      updatedAt: now
    };

    this.entities.set(entityId, entity);
    return entity;
  }

  /**
   * Registers a verified fact or claim with full provenance
   */
  registerClaim({
    claim,
    domain = 'GENERAL',
    jurisdiction = null,
    source = 'unknown',
    confidence = 0.95,
    verificationState = 'UNVERIFIED',
    entityRefs = []
  }) {
    if (!claim || !claim.trim()) return null;

    const claimId = `clm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      id: claimId,
      claim: claim.trim(),
      domain,
      jurisdiction,
      source: typeof source === 'object' ? source : { name: String(source) },
      retrievedAt: new Date().toISOString(),
      confidence: Math.min(Math.max(confidence, 0.0), 1.0),
      verificationState, // 'VERIFIED' | 'UNVERIFIED' | 'DISPUTED'
      entityRefs
    };

    this.claims.push(record);
    return record;
  }

  /**
   * Connects two entities or claims with a typed relationship (including cross-domain links)
   */
  linkRelationship(sourceId, targetId, relationType, metadata = {}) {
    const relation = {
      id: `drel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId,
      targetId,
      relationType, // 'governs' | 'impacts' | 'derives_from' | 'contradicts' | 'requires' | 'implements'
      metadata,
      createdAt: new Date().toISOString()
    };

    this.relations.push(relation);
    return relation;
  }

  /**
   * Cross-domain query matching keywords and domain filters
   */
  queryDomainKnowledge({ queryText = '', domain = null, minConfidence = 0.5, limit = 5 } = {}) {
    const keywords = (queryText || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const filtered = this.claims.filter(c => {
      if (domain && c.domain !== domain) return false;
      if (c.confidence < minConfidence) return false;
      return true;
    });

    if (keywords.length === 0) return filtered.slice(0, limit);

    const scored = filtered.map(c => {
      const text = `${c.domain} ${c.jurisdiction || ''} ${c.claim}`.toLowerCase();
      let matchCount = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) matchCount++;
      }
      return { claim: c, score: matchCount * c.confidence };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(item => item.claim);
  }

  getDomainStats() {
    const domainCounts = {};
    for (const c of this.claims) {
      domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1;
    }
    return {
      totalEntities: this.entities.size,
      totalClaims: this.claims.length,
      totalRelations: this.relations.length,
      domainDistribution: domainCounts
    };
  }
}

export const domainKnowledgeGraphInstance = new DomainKnowledgeGraph();
export default domainKnowledgeGraphInstance;
