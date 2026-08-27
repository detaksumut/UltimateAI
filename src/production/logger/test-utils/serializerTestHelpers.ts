// src/production/logger/test-utils/serializerTestHelpers.ts
import { ICorrelationPolicy } from "../ICorrelationPolicy";
import { LogEntry } from "../LogEntry";

/**
 * Returns a mock ICorrelationPolicy.
 * If `valid` is true, returns a deterministic non‑empty correlation id.
 * If `valid` is false, returns an invalid value (empty string, whitespace, null, or undefined).
 */
export function mockCorrelationPolicy(valid: boolean): ICorrelationPolicy {
  return {
    computeCorrelationId: (entry: LogEntry): string => {
      if (!valid) {
        const invalidValues = ["", "   ", null as any, undefined as any];
        return invalidValues[Math.floor(Math.random() * invalidValues.length)];
      }
      // Use requestId if present, otherwise a constant deterministic id
      return (entry as any).requestId ?? "deterministic-correlation-id";
    },
  } as ICorrelationPolicy;
}

/** Generate a payload object approximating `sizeInBytes` bytes. */
export function generatePayload(sizeInBytes: number): any {
  const obj: any = {};
  const entrySize = 20; // approximate bytes per key/value pair
  const count = Math.max(1, Math.floor(sizeInBytes / entrySize));
  for (let i = 0; i < count; i++) {
    obj[`key${i}`] = i;
  }
  return obj;
}

/** Generate a nested object with the given depth. */
export function generateNestedObject(depth: number): any {
  let current: any = { leaf: true };
  for (let i = 0; i < depth; i++) {
    current = { nested: current };
  }
  return current;
}

/** Generate an array of objects each containing two keys (a,b). */
export function generateArrayOfObjects(count: number): any[] {
  const arr: any[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({ b: i + 1, a: i });
  }
  return arr;
}

/** Measure execution time of a function (ms). */
export function measurePerformance<T>(fn: () => T): number {
  const start = Date.now();
  fn();
  return Date.now() - start;
}

/** Deep‑freeze an object to enforce immutability in tests. */
export function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}
