// src/production/logger/CanonicalSerializer.ts
/**
 * CanonicalSerializer – deterministic, pure serialization of a {@link LogEntry}.
 *
 * The serializer follows a strict set of rules (see documentation below) and does
 * **not** modify the input object. It produces a JSON string with lexicographically
 * sorted object keys, preserving array order, handling Unicode, dates, `null`,
 * and omitting `undefined` properties.
 */
import { LogEntry } from "./LogEntry";

/**
 * Serialization rules (canonical).
 * | Type          | Rule                                         |
 * |---------------|----------------------------------------------|
 * | Object        | Keys sorted lexicographically                |
 * | Array         | Preserve element order (recursively)         |
 * | String        | JSON.stringify (escapes as needed)          |
 * | Number        | JSON.stringify (preserves numeric format)   |
 * | Boolean       | JSON.stringify (true/false)                 |
 * | null          | Represented as `null`                        |
 * | undefined     | Omitted from objects (property removed)      |
 * | Date          | ISO‑8601 string via `toISOString()`          |
 * | Nested Object | Apply rules recursively                      |
 * | Nested Array  | Apply array rule recursively                 |
 */

/**
 * Convert a value to its canonical JSON representation according to the rules
 * above. Returns `undefined` for values that should be omitted (i.e., `undefined`
 * properties in objects).
 */
function canonicalStringify(value: unknown): string | undefined {
  if (value === undefined) {
    // Omit undefined properties completely.
    return undefined;
  }
  if (value === null) {
    return "null";
  }
  // Primitive types.
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    // Preserve order, serialize each element (undefined becomes null per JSON spec).
    const parts = value.map((elem) => {
      const serialized = canonicalStringify(elem);
      // JSON.stringify on undefined yields undefined, but in arrays it becomes null.
      return serialized === undefined ? "null" : serialized;
    });
    return "[" + parts.join(",") + "]";
  }
  if (type === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(); // lexicographic order.
    const parts = keys.map((k) => {
      const serialized = canonicalStringify(obj[k]);
      // Property is omitted if undefined; we filtered above, so always defined here.
      return JSON.stringify(k) + ":" + (serialized ?? "null");
    });
    return "{" + parts.join(",") + "}";
  }
  // Fallback – should not reach here.
  return JSON.stringify(value);
}

/**
 * Produce a deterministic JSON string for a {@link LogEntry}.
 *
 * The function is **pure** – it never mutates the supplied `entry`.
 */
export function canonicalSerialize(entry: LogEntry): string {
  const result = canonicalStringify(entry);
  // `canonicalStringify` always returns a string for objects, never undefined.
  return result as string;
}
