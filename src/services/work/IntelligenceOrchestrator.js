/**
 * IntelligenceOrchestrator.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Intelligence Orchestrator
 *
 * The brain of the work system. Decides WHAT to do.
 * Separated from WorkExecutor which decides HOW to execute.
 *
 * Responsibilities:
 *   1. Classify intent → domain
 *   2. Plan task breakdown (LLM or template)
 *   3. Route tasks to domain services
 *   4. Build WorkSession orchestration
 *
 * Flow:
 *   Goal → DomainRouter.classify() → TaskPlanner.plan() → Orchestration
 * ═══════════════════════════════════════════════════════════════════════
 */

import { DomainRouter, DOMAIN_KEYWORDS } from './DomainRouter.js';
import { TaskPlanner, DOMAIN_TASK_TEMPLATES } from './TaskPlanner.js';

class IntelligenceOrchestrator {
  constructor(options = {}) {
    this.domainRouter = options.domainRouter || new DomainRouter();
    this.taskPlanner = options.taskPlanner || new TaskPlanner(options);
    this.llmClient = options.llmClient || null;
  }

  /**
   * Orchestrate a goal into a work plan
   * Returns: { domain, objective, tasks, routing }
   */
  async orchestrate(goal, context = {}) {
    // 1. Detect multi-domain requests
    const detectedDomains = await this._detectMultiDomain(goal);

    if (detectedDomains.length > 1) {
      // Multi-domain: create tasks for each domain
      return await this._orchestrateMultiDomain(goal, detectedDomains, context);
    }

    // 2. Single domain: classify and plan
    const domain = detectedDomains[0] || this.classifyDomain(goal, context);
    const plan = await this.taskPlanner.plan(goal, domain);
    const routing = this.domainRouter.routeAll(plan.tasks, goal, domain);

    this._validateDAG(plan.tasks);

    return {
      domain,
      objective: goal,
      tasks: plan.tasks,
      routing,
      metadata: {
        intent: context.intent,
        complexity: context.complexity,
        multiDomain: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Detect multiple domains from goal text
   * Fast regex first; LLM understanding only when regex is ambiguous (no keywords).
   */
  async _detectMultiDomain(goal) {
    const lower = goal.toLowerCase();
    const domains = [];
    if (/riset|research|analisis|analyze|telusuri|investigate|study/i.test(lower)) domains.push('RESEARCH');
    if (/ppt|slide|presentasi|powerpoint/i.test(lower)) domains.push('CONTENT');
    if (/visual|grafik|chart|diagram|infografik/i.test(lower)) domains.push('DATA');
    if (/laporan|report|dokumen/i.test(lower)) domains.push('DOCUMENT');
    if (/otomasi|automation|workflow|jadwal|schedule/i.test(lower)) domains.push('AUTOMATION');
    if (/suara|voice|speak|audio|transkripsi|rekaman/i.test(lower)) domains.push('VOICE');
    if (/tulis|artikel|blog|konten|content/i.test(lower)) domains.push('CONTENT');

    const detected = [...new Set(domains)].filter(d => d !== 'GENERAL');

    // Fast path: regex already identified one or more domains
    if (detected.length > 0) return detected;

    // Ambiguous: let the LLM understand the request
    if (this.llmClient) {
      try {
        const llmDomains = await this._llmDetectDomains(goal);
        if (llmDomains.length > 0) return llmDomains;
      } catch (err) {
        console.warn('[IntelligenceOrchestrator] LLM domain detection failed:', err.message);
      }
    }

    return [];
  }

  /**
   * Use LLM to understand which work domains a request involves.
   * Returns array of domain codes (e.g. ['RESEARCH','CONTENT','DATA']).
   */
  async _llmDetectDomains(goal) {
    const response = await this.llmClient.sendChat({
      messages: [
        {
          role: 'system',
          content: 'Kamu menganalisis permintaan pekerjaan multi-domain. Tentukan domain pekerjaan apa saja yang terlibat dari permintaan user. Domain yang tersedia: RESEARCH, DOCUMENT, CONTENT, DATA, AUTOMATION, VOICE, CREATIVE. Keluarkan JSON array saja, contoh: ["RESEARCH","CONTENT","DATA"]. Jika hanya satu domain atau tidak jelas, keluarkan array dengan satu item. Gunakan bahasa Indonesia.'
        },
        { role: 'user', content: `Permintaan: "${goal}"\n\nDomain yang terlibat (array JSON):` }
      ],
      model: 'qwen3:8b',
      temperature: 0.2
    });
    const content = (response.message?.content || response.content || '').trim();
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);

    // Only keep valid registered domains
    const valid = this.domainRouter.getRegisteredDomains();
    const filtered = Array.isArray(parsed) ? parsed.filter(d => valid.includes(d)) : [];
    return [...new Set(filtered)];
  }

  /**
   * Orchestrate multi-domain request
   */
  async _orchestrateMultiDomain(goal, domains, context) {
    const allTasks = [];
    let taskId = 1;

    // Create tasks for each domain
    for (const domain of domains) {
      const plan = await this.taskPlanner.plan(goal, domain);
      for (const task of plan.tasks) {
        allTasks.push({
          ...task,
          id: `T${taskId++}`,
          domain,
        });
      }
    }

    // Build dependency chain: each domain's tasks depend on previous domain's last task
    let prevDomainLastTask = null;
    const domainGroups = {};
    for (const task of allTasks) {
      if (!domainGroups[task.domain]) {
        domainGroups[task.domain] = [];
      }
      domainGroups[task.domain].push(task);
    }

    for (const [domain, tasks] of Object.entries(domainGroups)) {
      if (prevDomainLastTask) {
        // First task of this domain depends on last task of previous domain
        tasks[0].dependencies = [prevDomainLastTask.id];
      }
      prevDomainLastTask = tasks[tasks.length - 1];
    }

    const routing = this.domainRouter.routeAll(allTasks, goal, domains[0]);
    this._validateDAG(allTasks);

    return {
      domain: domains.join('+'),
      objective: goal,
      tasks: allTasks,
      routing,
      metadata: {
        intent: context.intent,
        complexity: context.complexity,
        multiDomain: true,
        domains,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Classify the domain for a goal
   */
  classifyDomain(goal, context = {}) {
    // 1. Use explicit domain from context
    if (context.domain && this.domainRouter.hasDomain(context.domain)) {
      return context.domain;
    }

    // 2. Use intent mapping
    if (context.intent) {
      const mapped = this._intentToDomain(context.intent);
      if (mapped) return mapped;
    }

    // 3. Classify from goal text
    const inferred = this.domainRouter._inferDomainFromText(goal);
    if (inferred) return inferred;

    // 4. Fallback
    return 'GENERAL';
  }

  /**
   * Map semantic intent to domain
   */
  _intentToDomain(intent) {
    const intentMap = {
      'RESEARCH': 'RESEARCH',
      'WEB_SEARCH': 'RESEARCH',
      'DOCUMENT_PROCESSING': 'DOCUMENT',
      'CONTENT_CREATION': 'CONTENT',
      'DATA_ANALYSIS': 'DATA',
      'IMAGE_GENERATION': 'CREATIVE',
      'CREATIVE_WORK': 'CREATIVE',
      'AUTOMATION': 'AUTOMATION',
      'WORKFLOW': 'AUTOMATION',
    };

    return intentMap[intent] || null;
  }

  /**
   * Validate dependency graph is a valid DAG
   */
  _validateDAG(tasks) {
    const taskIds = new Set(tasks.map(t => t.id));
    const visited = new Set();
    const inStack = new Set();

    const hasCycle = (taskId) => {
      if (inStack.has(taskId)) return true;
      if (visited.has(taskId)) return false;

      visited.add(taskId);
      inStack.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        for (const dep of (task.dependencies || [])) {
          if (!taskIds.has(dep)) {
            throw new Error(`Task ${taskId} depends on unknown task ${dep}`);
          }
          if (hasCycle(dep)) return true;
        }
      }

      inStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (hasCycle(task.id)) {
        throw new Error(`Circular dependency detected involving task ${task.id}`);
      }
    }
  }

  /**
   * Get available domains
   */
  getAvailableDomains() {
    return this.domainRouter.getRegisteredDomains();
  }

  /**
   * Register a domain service
   */
  registerDomain(domain, service) {
    this.domainRouter.register(domain, service);
    return this;
  }
}

export { IntelligenceOrchestrator };
export default IntelligenceOrchestrator;
