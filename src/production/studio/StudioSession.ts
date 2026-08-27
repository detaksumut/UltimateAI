import { StudioResult } from "./StudioContracts";
import * as crypto from "crypto";

export interface SessionPreferences {
  defaultPriority: "high" | "normal" | "low";
  maxTimeMs: number;
  tags: string[];
}

const DEFAULT_PREFERENCES: SessionPreferences = {
  defaultPriority: "normal",
  maxTimeMs: 120_000,
  tags: []
};

/**
 * StudioSession tracks context for a single user session:
 * request history, preferences, and active request tracking.
 */
export class StudioSession {
  readonly sessionId: string;
  readonly startedAt: string;
  private preferences: SessionPreferences;
  private readonly history: StudioResult[] = [];
  private readonly activeRequests = new Set<string>();

  constructor(preferences: Partial<SessionPreferences> = {}) {
    this.sessionId = `session-${crypto.randomUUID()}`;
    this.startedAt = new Date().toISOString();
    this.preferences = { ...DEFAULT_PREFERENCES, ...preferences };
  }

  recordResult(result: StudioResult): void {
    this.history.push(result);
    this.activeRequests.delete(result.requestId);
  }

  trackActiveRequest(requestId: string): void {
    this.activeRequests.add(requestId);
  }

  getHistory(): StudioResult[] {
    return [...this.history];
  }

  getActiveRequests(): string[] {
    return Array.from(this.activeRequests);
  }

  getPreferences(): SessionPreferences {
    return { ...this.preferences };
  }

  updatePreferences(update: Partial<SessionPreferences>): void {
    this.preferences = { ...this.preferences, ...update };
  }

  get requestCount(): number {
    return this.history.length;
  }

  get successCount(): number {
    return this.history.filter(r => r.status === "SUCCESS").length;
  }
}
