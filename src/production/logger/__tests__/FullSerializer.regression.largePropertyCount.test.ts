/**
 * Regression ID: REG-001
 * Requirement: SER-003
 * Sprint: M2
 * Purpose: Protect against future regressions in large property count handling.
 * Origin:
 *   Regression discovered during CanonicalSerializer development.
 *   Fixed in Sprint M2 Step 2.4.
 */

// src/production/logger/__tests__/FullSerializer.regression.largePropertyCount.test.ts
import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import { mockCorrelationPolicy, generatePayload } from "../test-utils/serializerTestHelpers";

describe("REG-001 – Large property count", () => {
  const serializer = new DefaultSerializer(mockCorrelationPolicy(true));

  test("serializes an entry with many properties without error", () => {
    const largePayload = generatePayload(5000); // approx 5KB payload => many properties
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Large payload test",
      ...largePayload,
    } as any;
    expect(() => serializer.serialize(entry)).not.toThrow();
    const serialized = serializer.serialize(entry);
    expect(serialized).toBeTruthy();
    const parsed = JSON.parse(serialized.payload);
    Object.keys(largePayload).forEach((k) => expect(parsed).toHaveProperty(k));
  });
});
