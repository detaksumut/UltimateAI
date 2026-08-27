// src/production/logger/__tests__/DefaultSerializer.test.ts
/**
 * Unit tests for {@link DefaultSerializer}.
 *
 * Coverage goals:
 *   - Immutable SerializedLog (Object.isFrozen)
 *   - ICorrelationPolicy.computeCorrelationId called exactly once per serialize call
 *   - No mutation of the supplied LogEntry
 *   - Statelessness: consecutive calls produce identical results
 *   - Round‑trip determinism verification
 */
import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import { SerializedLog, createSerializedLog } from "../SerializedLog";
import { canonicalSerialize } from "../CanonicalSerializer";
import type { ICorrelationPolicy } from "../ICorrelationPolicy";

// Simple mock implementation of ICorrelationPolicy
class MockCorrelationPolicy implements ICorrelationPolicy {
  computeCorrelationId = jest.fn((entry: LogEntry) => {
    // deterministic id based on entityId for test purposes
    return `corr-${entry.entityId}`;
  });
}

describe("DefaultSerializer", () => {
  const entry: LogEntry = {
    timestamp: 1620000000000,
    type: "TEST_EVENT",
    entityId: "entity-42",
    payload: { a: 1, b: "text" },
    // optional fields omitted
  } as LogEntry;

  let serializer: DefaultSerializer;
  let policy: MockCorrelationPolicy;

  beforeEach(() => {
    policy = new MockCorrelationPolicy();
    serializer = new DefaultSerializer(policy);
  });

  test("returns an immutable SerializedLog", () => {
    const result = serializer.serialize(entry);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.id).toBe(`corr-${entry.entityId}`);
  });

  test("does not mutate the original LogEntry", () => {
    const before = { ...entry };
    serializer.serialize(entry);
    expect(entry).toEqual(before);
  });

  test("ICorrelationPolicy.computeCorrelationId is called exactly once per serialize", () => {
    serializer.serialize(entry);
    expect(policy.computeCorrelationId).toHaveBeenCalledTimes(1);
    expect(policy.computeCorrelationId).toHaveBeenCalledWith(entry);
  });

  test("consecutive serialize calls are independent (no hidden state)", () => {
    const first = serializer.serialize(entry);
    const second = serializer.serialize(entry);
    expect(first).toEqual(second);
    // ensure the mock was called twice in total (once per call)
    expect(policy.computeCorrelationId).toHaveBeenCalledTimes(2);
  });

  test("round‑trip determinism: payload JSON parses back to same canonical string", () => {
    const result = serializer.serialize(entry);
    const parsed = JSON.parse(result.payload);
    const canonical = canonicalSerialize(entry);
    // The canonical string produced directly should equal the payload string
    expect(result.payload).toBe(canonical);
    // Additionally, stringifying the parsed object should equal the canonical string
    // (JSON.parse + JSON.stringify may reorder keys; we compare via canonicalSerialize)
    expect(JSON.stringify(parsed)).toBe(canonical);
  });
});
