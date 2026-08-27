/**
 * ICorrelationPolicy – defines how a LogEntry is correlated within a workflow.
 * Implementations must be pure (no side‑effects) and deterministic.
 *
 * @interface ICorrelationPolicy
 */
import { LogEntry } from "./LogEntry";
export interface ICorrelationPolicy {
  /**
   * Compute a deterministic correlation identifier for a given LogEntry.
   * The algorithm must not depend on mutable fields such as `timestamp`.
   *
   * @param entry - The LogEntry to correlate.
   * @returns A deterministic string identifier.
   */
  computeCorrelationId(entry: LogEntry): string;
}
