// src/production/logger/__tests__/DefaultSerializer.correlation.test.ts
/**
 * Additional tests for {@link DefaultSerializer} focusing on correlation ID handling.
 *
 * Scenarios:
 *   1. Valid correlation ID is propagated to SerializedLog.id.
 *   2. Empty string, whitespace‑only, null, or undefined correlation IDs cause
 *      {@link InvalidCorrelationIdError} to be thrown.
 */
import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import type { ICorrelationPolicy } from "../ICorrelationPolicy";
import { InvalidCorrelationIdError } from "../InvalidCorrelationIdError";

// Helper to create a base LogEntry used in tests
const baseEntry: LogEntry = {
  timestamp: 1620000000000,
  type: "TEST_EVENT",
  entityId: "entity-99",
  payload: { data: "value" },
} as LogEntry;

// Mock policy that returns a configurable correlation ID
class ConfigurablePolicy implements ICorrelationPolicy {
  constructor(public returnValue: any) {}
  computeCorrelationId = jest.fn(() => this.returnValue);
}

describe("DefaultSerializer – correlation ID handling", () => {
  test("propagates valid correlation ID to SerializedLog.id", () => {
    const policy = new ConfigurablePolicy("corr-123");
    const serializer = new DefaultSerializer(policy);
    const result = serializer.serialize(baseEntry);
    expect(result.id).toBe("corr-123");
    expect(policy.computeCorrelationId).toHaveBeenCalledTimes(1);
    expect(policy.computeCorrelationId).toHaveBeenCalledWith(baseEntry);
  });

  const invalidValues = ["", "   ", undefined, null];
  invalidValues.forEach((invalid) => {
    test(`throws InvalidCorrelationIdError for correlationId=${JSON.stringify(invalid)}`, () => {
      const policy = new ConfigurablePolicy(invalid);
      const serializer = new DefaultSerializer(policy);
      expect(() => serializer.serialize(baseEntry)).toThrow(InvalidCorrelationIdError);
      expect(policy.computeCorrelationId).toHaveBeenCalledTimes(1);
    });
  });
});
