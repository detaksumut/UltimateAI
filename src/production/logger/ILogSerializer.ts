// src/production/logger/ILogSerializer.ts
/**
 * ILogSerializer – contract for turning a {@link LogEntry} into a {@link SerializedLog}.
 *
 * The serializer must be **pure** and **stateless**: it may not mutate the supplied
 * {@link LogEntry}, maintain any internal state, or depend on external side‑effects.
 * Implementations are free to use dependency injection for ancillary services such as
 * {@link ICorrelationPolicy}, but the contract itself only defines a single method.
 */
export interface ILogSerializer {
  /**
   * Serialize a {@link LogEntry} into a {@link SerializedLog}.
   *
   * @param entry - The log entry to serialize. The method must not mutate this object.
   * @returns An immutable {@link SerializedLog} representing the serialized form of the entry.
   */
  serialize(entry: LogEntry): SerializedLog;
}

// Types imported from existing modules for clarity. These imports are re‑exported only for
// documentation purposes; they are not part of the runtime bundle.
import type { LogEntry } from "./LogEntry";
import type { SerializedLog } from "./SerializedLog";
