/**
 * DomainRouter.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Domain Router
 *
 * Routes tasks to the appropriate domain service based on:
 * - Task type
 * - Goal keywords
 * - Domain classification
 *
 * Domain Registry pattern: services register themselves, router dispatches.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DOMAIN_KEYWORDS = {
  DESIGN: ['desain', 'design', 'blueprint', 'specification'],
  RESEARCH: ['riset', 'research', 'analisis', 'analyze', 'telusuri', 'search', 'cari', 'investigate', 'study'],
  DOCUMENT: ['dokumen', 'document', 'pdf', 'laporan', 'report', 'resume', 'summarize', 'convert'],
  CONTENT: ['konten', 'content', 'artikel', 'article', 'tulis', 'write', 'blog', 'post', 'copy'],
  DATA: ['data', 'grafik', 'chart', 'visualisasi', 'visualization', 'tabel', 'table', 'statistik'],
  CREATIVE: ['kreatif', 'creative', 'gambar', 'image', 'ilustrasi', 'logo'],
  AUTOMATION: ['otomasi', 'automation', 'workflow', 'jadwal', 'schedule', 'proses', 'process', 'bot'],
};

class DomainRouter {
  constructor() {
    this.registeredDomains = new Map();
    this.fallbackDomain = 'GENERAL';
  }

  /**
   * Register a domain service
   */
  register(domain, service) {
    this.registeredDomains.set(domain, service);
    return this;
  }

  /**
   * Check if a domain has a registered service
   */
  hasDomain(domain) {
    return this.registeredDomains.has(domain);
  }

  /**
   * Get a domain service
   */
  getDomain(domain) {
    return this.registeredDomains.get(domain) || null;
  }

  /**
   * Get all registered domains
   */
  getRegisteredDomains() {
    return Array.from(this.registeredDomains.keys());
  }

  /**
   * Route a task to the appropriate domain
   */
  route(task, objective, currentDomain) {
    // 1. If task specifies a domain, use it
    if (task.domain && this.hasDomain(task.domain)) {
      return task.domain;
    }

    // 2. Use current session domain if available
    if (currentDomain && this.hasDomain(currentDomain)) {
      return currentDomain;
    }

    // 3. Try to infer from task type
    const inferred = this._inferDomainFromType(task.type);
    if (inferred && this.hasDomain(inferred)) {
      return inferred;
    }

    // 4. Try to infer from task description
    const descInferred = this._inferDomainFromText(task.description || '');
    if (descInferred && this.hasDomain(descInferred)) {
      return descInferred;
    }

    // 5. Try to infer from objective
    const objInferred = this._inferDomainFromText(objective || '');
    if (objInferred && this.hasDomain(objInferred)) {
      return objInferred;
    }

    // 6. Fallback to current domain or GENERAL
    if (this.hasDomain(currentDomain)) return currentDomain;
    if (this.hasDomain(this.fallbackDomain)) return this.fallbackDomain;

    // 7. Return first available domain
    const domains = this.getRegisteredDomains();
    return domains.length > 0 ? domains[0] : null;
  }

  /**
   * Infer domain from task type
   */
  _inferDomainFromType(type) {
    if (!type) return null;
    const t = type.toUpperCase();

    if (['SEARCH', 'FIND', 'LOOKUP', 'INVESTIGATE'].includes(t)) return 'RESEARCH';
    if (['PARSE', 'READ', 'EXTRACT', 'CONVERT'].includes(t)) return 'DOCUMENT';
    if (['WRITE', 'DRAFT', 'EDIT', 'COMPOSE'].includes(t)) return 'CONTENT';
    if (['CHART', 'GRAPH', 'TABLE', 'STATS'].includes(t)) return 'DATA';
    if (['DRAW', 'ILLUSTRATE', 'DESIGN', 'LOGO'].includes(t)) return 'CREATIVE';
    if (['BUILD', 'AUTOMATE', 'SCHEDULE', 'WORKFLOW'].includes(t)) return 'AUTOMATION';

    return null;
  }

  /**
   * Infer domain from text content
   */
  _inferDomainFromText(text) {
    if (!text) return null;
    const lower = text.toLowerCase();

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return domain;
        }
      }
    }

    return null;
  }

  /**
   * Build task-to-domain mapping for a set of tasks
   */
  routeAll(tasks, objective, sessionDomain) {
    const routing = {};
    for (const task of tasks) {
      routing[task.id] = this.route(task, objective, sessionDomain);
    }
    return routing;
  }
}

export { DomainRouter, DOMAIN_KEYWORDS };
export default DomainRouter;
