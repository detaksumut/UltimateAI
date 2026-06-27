// src/engine/models/aiContext.ts

/**
 * Immutable AIContext passed to every Engine operation.
 */

import { AICapability } from '../capability/types';

/** Domain‑specific metadata attached to a context. Extend as needed. */
export interface AIContextMetadata {
  // Future‑proof catch‑all; concrete fields can be added later.
  [key: string]: unknown;
}

/** Parameters required to construct an AIContext. */
export interface AIContextParams {
  requestId: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  correlationId?: string;
  /**
   * Set of capabilities required for this request.
   * Defaults to [AICapability.CHAT] if omitted.
   */
  requiredCapabilities?: Set<AICapability>;
  /** Typed metadata – replaces generic Record<string, unknown>. */
  metadata?: AIContextMetadata;
}

/** Immutable AIContext model. */
export class AIContext {
  public readonly requestId: string;
  public readonly userId?: string;
  public readonly sessionId?: string;
  public readonly traceId: string;
  public readonly correlationId?: string;
  public readonly requiredCapabilities: Set<AICapability>;
  public readonly metadata: AIContextMetadata;

  constructor(params: AIContextParams) {
    this.requestId = params.requestId;
    this.userId = params.userId;
    this.sessionId = params.sessionId;
    this.traceId = params.traceId ?? generateTraceId();
    this.correlationId = params.correlationId;
    this.requiredCapabilities =
      params.requiredCapabilities ?? new Set([AICapability.CHAT]);
    this.metadata = { ...(params.metadata ?? {}) };
    // Enforce immutability
    Object.freeze(this);
    Object.freeze(this.requiredCapabilities);
    Object.freeze(this.metadata);
  }

  /** Convenience check for required capabilities. */
  public hasCapability(capability: AICapability): boolean {
    return this.requiredCapabilities.has(capability);
  }
}

/** Simple UUID v4 generator for trace identifiers. */
function generateTraceId(): string {
  // Prefer native crypto.randomUUID if present (browser or recent Node globals)
  const globalCrypto = (globalThis as any).crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  // Fallback to Node's built‑in crypto module via require (CommonJS)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomUUID } = require('crypto');
    if (typeof randomUUID === 'function') {
      return randomUUID();
    }
  } catch {
    // ignore – module not available (e.g., browser bundler)
  }
  // Final fallback to the original Math.random based UUID generator
  return fallbackUuid();
}

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
