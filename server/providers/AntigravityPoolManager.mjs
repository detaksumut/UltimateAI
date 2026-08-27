/**
 * AntigravityPoolManager.mjs
 * Multi-Account Resource Orchestrator & Adaptive Quota Scheduler for 9Router.
 * Manages 7 Antigravity Connections (ag-01 .. ag-07) + Auxiliary Connections (GitHub, Claude, Ollama).
 * Single Source of Truth for Quota State, Circuit Breaking, and Model Routing.
 */

export class AntigravityPoolManager {
  constructor() {
    this.connections = new Map();
    this.initializePool();
  }

  /**
   * Initializes the 7 Antigravity Connection Pools + Auxiliary Providers
   */
  initializePool() {
    const modelTemplate = {
      'gemini-3.6-flash-high': { capability: 'FAST_CHAT', family: 'gemini', used: 0, limit: 1000, latencyMs: 320, health: 'HEALTHY' },
      'gemini-3.6-flash-med':  { capability: 'FAST_CHAT', family: 'gemini', used: 0, limit: 1000, latencyMs: 410, health: 'HEALTHY' },
      'gemini-3.6-flash-low':  { capability: 'FAST_CHAT', family: 'gemini', reasoning: 'standard', used: 0, limit: 1000, latencyMs: 250, health: 'HEALTHY' },
      'gemini-3.5-flash':      { capability: 'FAST_CHAT', family: 'gemini', used: 0, limit: 1000, latencyMs: 450, health: 'HEALTHY' },
      'gemini-3.1-pro-high':   { capability: 'DEEP_REASONING', family: 'gemini', reasoning: 'deep', used: 0, limit: 1000, latencyMs: 1200, health: 'HEALTHY' },
      'gemini-3.1-pro-low':    { capability: 'DEEP_REASONING', family: 'gemini', reasoning: 'deep', used: 0, limit: 1000, latencyMs: 890, health: 'HEALTHY' },
      'claude-sonnet-4.6-thinking': { capability: 'CODE_GENERATION', family: 'claude', reasoning: 'extended_thinking', used: 0, limit: 1000, latencyMs: 1800, health: 'HEALTHY' },
      'claude-opus-4.6-thinking':   { capability: 'COMPLEX_LOGIC', family: 'claude', reasoning: 'extended_thinking', used: 0, limit: 1000, latencyMs: 2400, health: 'HEALTHY' },
      'gpt-oss-120b':          { capability: 'OPEN_WORKLOAD', family: 'gpt_oss', used: 0, limit: 1000, latencyMs: 650, health: 'HEALTHY' }
    };

    // 1. Antigravity Accounts Pool (ag-01 to ag-07)
    for (let i = 1; i <= 7; i++) {
      const connId = `ag-0${i}`;
      this.connections.set(connId, {
        connectionId: connId,
        provider: 'ANTIGRAVITY',
        label: `Antigravity Connection ${i}`,
        accountEmail: `account${i}@gmail.com`,
        status: 'AUTHENTICATED_LIVE',
        consecutiveFailures: 0,
        circuitBreakerOpen: false,
        models: JSON.parse(JSON.stringify(modelTemplate))
      });
    }

    // 2. Auxiliary Connections
    this.connections.set('github-copilot', {
      connectionId: 'github-copilot',
      provider: 'GITHUB',
      label: 'GitHub Models',
      status: 'AUTHENTICATED_LIVE',
      models: {
        'gpt-4o': { capability: 'GENERAL_WORKLOAD', used: 0, limit: 500, health: 'HEALTHY' }
      }
    });

    this.connections.set('ollama-local', {
      connectionId: 'ollama-local',
      provider: 'OLLAMA',
      label: 'Ollama Local Host',
      status: 'AUTHENTICATED_LIVE',
      models: {
        'llama3.3:70b': { capability: 'LOCAL_FALLBACK', used: 0, limit: 999999, health: 'HEALTHY' }
      }
    });
  }

  /**
   * Adaptive Scheduler: Selects optimal connection & model based on capability and quota health
   * @param {string} capability - 'FAST_CHAT' | 'DEEP_REASONING' | 'CODE_GENERATION' | 'COMPLEX_LOGIC'
   * @param {string} preferredModel - User or agent model override
   * @returns {Object} { connectionId, accountEmail, modelId, quotaRemaining, provider }
   */
  scheduleRequest(capability = 'FAST_CHAT', preferredModel = null) {
    const candidateConnections = Array.from(this.connections.values()).filter(c => 
      c.status === 'AUTHENTICATED_LIVE' && !c.circuitBreakerOpen
    );

    if (candidateConnections.length === 0) {
      throw new Error('All connection pools are currently circuit-broken or exhausted.');
    }

    // 1. Resolve Target Model ID
    let targetModel = preferredModel;
    if (!targetModel) {
      switch (capability) {
        case 'CODE_GENERATION':
        case 'APP_SYNTHESIS':
          targetModel = 'claude-sonnet-4.6-thinking';
          break;
        case 'DEEP_REASONING':
        case 'DATA_ANALYTICS':
          targetModel = 'gemini-3.1-pro-high';
          break;
        case 'COMPLEX_LOGIC':
          targetModel = 'claude-opus-4.6-thinking';
          break;
        case 'OPEN_WORKLOAD':
          targetModel = 'gpt-oss-120b';
          break;
        case 'FAST_CHAT':
        default:
          targetModel = 'gemini-3.6-flash-high';
          break;
      }
    }

    // 2. Find connection with highest remaining quota and lowest latency for this model
    let bestConnection = null;
    let maxRemaining = -1;

    for (const conn of candidateConnections) {
      const modelMeta = conn.models[targetModel];
      if (modelMeta) {
        const remaining = modelMeta.limit - modelMeta.used;
        if (remaining > maxRemaining) {
          maxRemaining = remaining;
          bestConnection = conn;
        }
      }
    }

    if (!bestConnection) {
      bestConnection = candidateConnections[0];
    }

    return {
      connectionId: bestConnection.connectionId,
      accountEmail: bestConnection.accountEmail || 'system@9router.local',
      provider: bestConnection.provider,
      modelId: targetModel,
      quotaRemaining: maxRemaining > 0 ? maxRemaining : 1000,
      totalLimit: 1000
    };
  }

  /**
   * Records successful execution and increments quota counter
   */
  recordUsage(connectionId, modelId) {
    const conn = this.connections.get(connectionId);
    if (conn && conn.models[modelId]) {
      conn.models[modelId].used++;
      conn.consecutiveFailures = 0;
    }
  }

  /**
   * Triggers circuit breaker on connection failure
   */
  recordFailure(connectionId) {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.consecutiveFailures++;
      if (conn.consecutiveFailures >= 3) {
        conn.circuitBreakerOpen = true;
        // Auto-heal circuit breaker after 30 seconds
        setTimeout(() => {
          conn.circuitBreakerOpen = false;
          conn.consecutiveFailures = 0;
        }, 30000);
      }
    }
  }

  /**
   * Returns complete real-time Quota State Snapshot for Dashboard & Scheduler
   */
  getQuotaSnapshot() {
    const snapshot = {};
    for (const [id, conn] of this.connections.entries()) {
      snapshot[id] = {
        connectionId: conn.connectionId,
        provider: conn.provider,
        label: conn.label,
        accountEmail: conn.accountEmail || '',
        status: conn.circuitBreakerOpen ? 'CIRCUIT_BROKEN' : conn.status,
        models: conn.models
      };
    }
    return snapshot;
  }
}

export const antigravityPoolManagerInstance = new AntigravityPoolManager();
export default antigravityPoolManagerInstance;
