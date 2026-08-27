// src/production/logger/SerializedLog.ts
/**
 * SerializedLog – immutable data representation of a serialized log entry.
 * No business logic is included; it simply holds the identifier and the serialized payload.
 */
export type SerializedLog = Readonly<{
  /** Unique identifier for the log entry */
  id: string;
  /** Serialized payload (e.g., JSON string) */
  payload: string;
}>;

/**
 * Factory function that creates an immutable {@link SerializedLog} instance.
 * The returned object is `Object.freeze`‑ed to guarantee runtime immutability.
 */
export function createSerializedLog(id: string, payload: string): SerializedLog {
  return Object.freeze({ id, payload });
}
