// src/production/logger/DefaultCorrelationPolicy.ts
import { createHash } from "crypto";
import { ICorrelationPolicy } from "./ICorrelationPolicy";
import { LogEntry } from "./LogEntry";

/**
 * DefaultCorrelationPolicy – deterministic correlation identifier generator.
 *
 * Implements {@link ICorrelationPolicy} using a SHA‑256 hash of stable fields.
 * The algorithm is pure, stateless and has no side‑effects.
 */
export class DefaultCorrelationPolicy implements ICorrelationPolicy {
  /**
   * Compute a deterministic correlation identifier.
   *
   * The identifier is derived from the first available combination of:
   *   1. requestId, workflowId, parentId (in that order, if present).
   *   2. fallback to `${entry.type}|${entry.entityId}`.
   *
   * The concatenated string is hashed with SHA‑256 and returned as a hex string.
   *
   * @param entry The LogEntry to correlate.
   * @returns Deterministic correlation identifier.
   */
  computeCorrelationId(entry: LogEntry): string {
    const parts: string[] = [];
    if (entry.requestId) parts.push(entry.requestId);
    if (entry.workflowId) parts.push(entry.workflowId);
    if (entry.parentId) parts.push(entry.parentId);

    // Fallback to stable type+entityId if no explicit IDs are present.
    if (parts.length === 0) {
      parts.push(entry.type, entry.entityId);
    }

    const raw = parts.join("|");
    return createHash("sha256").update(raw).digest("hex");
  }
}
