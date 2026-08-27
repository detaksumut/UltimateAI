// src/production/logger/__tests__/DefaultSerializer.failfast.test.ts
/**
 * Additional fail‑fast tests for {@link DefaultSerializer}.
 *
 * Scenarios covered:
 *   1. When the correlation ID is invalid, `canonicalSerialize` must **not** be called.
 *   2. When the correlation ID is valid, `canonicalSerialize` is called exactly once.
 *   3. The thrown error type must be {@link InvalidCorrelationIdError}.
 */
import { DefaultSerializer } from "../DefaultSerializer";
import type { ICorrelationPolicy } from "../ICorrelationPolicy";
import { InvalidCorrelationIdError } from "../InvalidCorrelationIdError";

// Mock the canonicalSerialize function
jest.mock("../CanonicalSerializer", () => ({
  canonicalSerialize: jest.fn(() => "{\"mock\":true}"),
}));

// Grab the mocked function for assertions
import { canonicalSerialize } from "../CanonicalSerializer";

// Helper LogEntry
const entry = {
  timestamp: 1620000000000,
  type: "TEST_EVENT",
  entityId: "entity-99",
  payload: { a: 1 },
} as any;

class MockPolicy implements ICorrelationPolicy {
  constructor(public returnValue: any) {}
  computeCorrelationId = jest.fn(() => this.returnValue);
}

describe("DefaultSerializer – fail‑fast behavior", () => {
  test("does NOT call canonicalSerialize when correlationId is invalid", () => {
    const policy = new MockPolicy(""); // empty string -> invalid
    const serializer = new DefaultSerializer(policy);
    expect(() => serializer.serialize(entry)).toThrow(InvalidCorrelationIdError);
    expect(policy.computeCorrelationId).toHaveBeenCalledTimes(1);
    expect(canonicalSerialize).not.toHaveBeenCalled();
  });

  test("calls canonicalSerialize exactly once when correlationId is valid", () => {
    const policy = new MockPolicy("corr-123");
    const serializer = new DefaultSerializer(policy);
    const result = serializer.serialize(entry);
    expect(result.id).toBe("corr-123");
    expect(policy.computeCorrelationId).toHaveBeenCalledTimes(1);
    expect(canonicalSerialize).toHaveBeenCalledTimes(1);
  });
});
